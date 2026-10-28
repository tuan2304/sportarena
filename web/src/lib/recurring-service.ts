import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyUser } from '@/lib/notify'
import { enforceRateLimit } from '@/lib/rate-limit'
import { computePrice } from '@/lib/pricing'
import { clampFreeCancelHours } from '@/lib/cancellation'
import { performCancellation } from '@/lib/booking-cancel'
import { formatDate, formatTime } from '@/lib/format'
import {
  MAX_RECURRING_PER_USER,
  describeRecurring,
  fitsOpeningHours,
  minutesToTime,
  occurrenceDateKeys,
  occurrenceWindow,
  parseRecurringInput,
  todayKey,
  type RecurringInput,
} from '@/lib/recurring'
import type { Database } from '@/types/database'

type Admin = SupabaseClient<Database>

/**
 * Lịch cố định hằng tuần. Người chơi gửi yêu cầu → chủ sân duyệt → mỗi lần chạy tác vụ định kỳ (api/cron/tick) tự tạo
 * các đơn đặt sân 'confirmed' (cọc 0đ vì khách cố định thường trả tại sân) cho 4 tuần tới.
 * Mỗi tuần đúng một dòng bookings (chỉ mục duy nhất recurring_id + start_time), kể cả tuần bị hủy hoặc bị bỏ qua vì
 * trùng lịch, nên tác vụ chạy lại bao nhiêu lần cũng không tạo trùng hay "hồi sinh" một buổi đã hủy.
 */

export type ServiceResult = { error: string } | { success: true }

interface SeriesRow {
  id: string
  user_id: string
  court_id: string
  weekday: number
  start_time: string
  end_time: string
  starts_on: string
  ends_on: string | null
  court: {
    name: string
    is_active: boolean
    base_price_per_hour: number
    deposit_percentage: number
    club: { id: string; name: string; owner_id: string; open_time: string; close_time: string; is_active: boolean; free_cancel_hours: number } | null
    court_pricing_rules: Array<{ start_time: string; end_time: string; days_of_week: number[] | null; price_per_hour: number }>
  } | null
}

const SERIES_SELECT = `
  id, user_id, court_id, weekday, start_time, end_time, starts_on, ends_on,
  court:courts (
    name, is_active, base_price_per_hour, deposit_percentage,
    club:clubs ( id, name, owner_id, open_time, close_time, is_active, free_cancel_hours ),
    court_pricing_rules ( start_time, end_time, days_of_week, price_per_hour )
  )
`

const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

function revalidate() {
  revalidatePath('/recurring')
  revalidatePath('/my-bookings')
  revalidatePath('/owner/recurring')
  revalidatePath('/owner/schedule')
}

/** Người chơi gửi yêu cầu lịch cố định; chủ sân nhận thông báo để duyệt. */
export async function requestRecurring(userId: string, input: RecurringInput): Promise<ServiceResult> {
  const limited = await enforceRateLimit('recurring', userId)
  if (limited) return { error: limited }

  const parsed = parseRecurringInput(input, todayKey())
  if (!parsed.ok) return { error: parsed.error }
  const req = parsed.value

  const admin = createAdminClient()
  const { data: court } = await admin
    .from('courts')
    .select('id, name, is_active, club:clubs ( id, name, owner_id, open_time, close_time, is_active )')
    .eq('id', req.courtId)
    .maybeSingle()
  const club = court?.club as unknown as { id: string; name: string; owner_id: string; open_time: string; close_time: string; is_active: boolean } | null
  if (!court || !club) return { error: 'Không tìm thấy thông tin sân con' }
  if (!court.is_active) return { error: 'Sân này đang tạm ngưng hoạt động để bảo trì' }
  if (!club.is_active) return { error: 'Cụm sân này đang tạm ngưng nhận đặt' }
  if (!fitsOpeningHours(req.startMinutes, req.endMinutes, club.open_time, club.close_time)) {
    return { error: `Khung giờ nằm ngoài giờ mở cửa (${club.open_time.slice(0, 5)} - ${club.close_time.slice(0, 5)})` }
  }

  const { count } = await admin
    .from('recurring_bookings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', ['pending', 'active'])
  if ((count ?? 0) >= MAX_RECURRING_PER_USER) {
    return { error: `Bạn đang có tối đa ${MAX_RECURRING_PER_USER} lịch cố định. Hãy kết thúc bớt một lịch rồi đăng ký thêm.` }
  }

  const { data: dup } = await admin
    .from('recurring_bookings')
    .select('id')
    .eq('user_id', userId)
    .eq('court_id', req.courtId)
    .eq('weekday', req.weekday)
    .eq('start_time', minutesToTime(req.startMinutes))
    .in('status', ['pending', 'active'])
    .limit(1)
  if (dup?.length) return { error: 'Bạn đã có lịch cố định cho khung giờ này' }

  const { error } = await admin.from('recurring_bookings').insert({
    user_id: userId,
    court_id: req.courtId,
    weekday: req.weekday,
    start_time: minutesToTime(req.startMinutes),
    end_time: minutesToTime(req.endMinutes),
    starts_on: req.startsOn,
    ends_on: req.endsOn,
    note: req.note,
  })
  if (error) {
    console.error('requestRecurring: insert lỗi', error)
    return { error: 'Không thể gửi yêu cầu lịch cố định. Vui lòng thử lại.' }
  }

  await notifyUser({
    userId: club.owner_id,
    title: 'Có yêu cầu đặt lịch cố định mới',
    message: `Một khách muốn đặt cố định ${court.name} (${club.name}) vào ${describeRecurring(req.weekday, req.startMinutes, req.endMinutes)}. Bấm để xem và duyệt.`,
    type: 'booking',
    link: '/owner/recurring',
  })
  revalidate()
  return { success: true }
}

/** Chủ sân duyệt hoặc từ chối yêu cầu. Duyệt xong tạo ngay các buổi của 4 tuần tới. */
export async function decideRecurring(ownerId: string, seriesId: string, decision: 'approve' | 'reject'): Promise<ServiceResult> {
  const admin = createAdminClient()
  const series = await loadSeries(admin, seriesId)
  if (!series?.court?.club || series.court.club.owner_id !== ownerId) {
    return { error: 'Bạn không có quyền thao tác lịch cố định này' }
  }

  const { data: updated, error } = await admin
    .from('recurring_bookings')
    .update({ status: decision === 'approve' ? 'active' : 'rejected', decided_at: new Date().toISOString() })
    .eq('id', seriesId)
    .eq('status', 'pending')
    .select('id')
  if (error) {
    console.error('decideRecurring lỗi', error)
    return { error: 'Không thể cập nhật. Vui lòng thử lại.' }
  }
  if (!updated?.length) return { error: 'Yêu cầu này đã được xử lý trước đó' }

  const label = describeRecurring(series.weekday, toMinutes(series.start_time), toMinutes(series.end_time))
  if (decision === 'reject') {
    await notifyUser({
      userId: series.user_id,
      title: 'Yêu cầu lịch cố định bị từ chối',
      message: `Chủ sân ${series.court.club.name} đã từ chối lịch cố định ${label} tại ${series.court.name}.`,
      type: 'booking',
      link: '/recurring',
    })
  } else {
    const result = await generateOccurrences(admin, series)
    await notifyUser({
      userId: series.user_id,
      title: 'Lịch cố định đã được duyệt 🎉',
      message: `Chủ sân ${series.court.club.name} đã duyệt lịch cố định ${label} tại ${series.court.name}. Đã giữ ${result.created} buổi sắp tới, các buổi sau sẽ tự được giữ mỗi tuần.`,
      type: 'booking',
      link: '/my-bookings',
    })
  }
  revalidate()
  return { success: true }
}

/**
 * Kết thúc lịch cố định.
 * - Người chơi kết thúc: các buổi còn trong thời hạn hủy miễn phí của cụm sân vẫn giữ nguyên (đã sát giờ, cần hủy riêng
 *   từng buổi nếu không đến được), các buổi xa hơn được hủy.
 * - Chủ sân kết thúc: hủy mọi buổi sắp tới, khách không bị tính hủy muộn.
 */
export async function endRecurring(actor: { id: string; as: 'player' | 'owner' }, seriesId: string): Promise<ServiceResult> {
  const admin = createAdminClient()
  const series = await loadSeries(admin, seriesId)
  if (!series?.court?.club) return { error: 'Không tìm thấy lịch cố định này' }

  const isOwner = series.court.club.owner_id === actor.id
  const isPlayer = series.user_id === actor.id
  if ((actor.as === 'owner' && !isOwner) || (actor.as === 'player' && !isPlayer)) {
    return { error: 'Bạn không có quyền thao tác lịch cố định này' }
  }

  const { data: updated, error } = await admin
    .from('recurring_bookings')
    .update({ status: 'cancelled', decided_at: new Date().toISOString() })
    .eq('id', seriesId)
    .in('status', ['pending', 'active'])
    .select('id')
  if (error) {
    console.error('endRecurring lỗi', error)
    return { error: 'Không thể cập nhật. Vui lòng thử lại.' }
  }
  if (!updated?.length) return { error: 'Lịch cố định này đã kết thúc' }

  const now = new Date()
  const cutoff =
    actor.as === 'player'
      ? new Date(now.getTime() + clampFreeCancelHours(series.court.club.free_cancel_hours) * 3_600_000)
      : now
  const { data: upcoming } = await admin
    .from('bookings')
    .select('id')
    .eq('recurring_id', seriesId)
    .eq('status', 'confirmed')
    .gt('start_time', cutoff.toISOString())
  for (const b of upcoming ?? []) {
    // Người chơi kết thúc cả chuỗi không bị tính "hủy muộn" ở các buổi đã lọc ở trên (đều còn xa giờ chơi)
    await performCancellation(admin, b.id, actor.as)
  }

  if (actor.as === 'owner') {
    await notifyUser({
      userId: series.user_id,
      title: 'Lịch cố định đã bị chủ sân kết thúc',
      message: `Chủ sân ${series.court.club.name} đã kết thúc lịch cố định ${describeRecurring(series.weekday, toMinutes(series.start_time), toMinutes(series.end_time))} tại ${series.court.name}; các buổi sắp tới đã được hủy.`,
      type: 'booking',
      link: '/recurring',
    })
  }
  revalidate()
  return { success: true }
}

async function loadSeries(admin: Admin, id: string): Promise<SeriesRow | null> {
  const { data } = await admin.from('recurring_bookings').select(SERIES_SELECT).eq('id', id).maybeSingle()
  return (data as unknown as SeriesRow | null) ?? null
}

export interface GenerateResult {
  created: number
  skipped: number
}

/** Tạo các buổi của 4 tuần tới cho một lịch cố định đang chạy. Chạy lại bao nhiêu lần cũng an toàn. */
export async function generateOccurrences(admin: Admin, series: SeriesRow, now = new Date()): Promise<GenerateResult> {
  const court = series.court
  const club = court?.club
  const result: GenerateResult = { created: 0, skipped: 0 }
  if (!court || !club || !court.is_active || !club.is_active) return result

  const startMinutes = toMinutes(series.start_time)
  const endMinutes = toMinutes(series.end_time)
  // Cụm sân đổi giờ mở cửa sau khi duyệt: không tạo thêm buổi nằm ngoài giờ (chủ sân nên liên hệ khách)
  if (!fitsOpeningHours(startMinutes, endMinutes, club.open_time, club.close_time)) return result

  const dates = occurrenceDateKeys({ weekday: series.weekday, startsOn: series.starts_on, endsOn: series.ends_on, fromKey: todayKey(now) })
  for (const dateKey of dates) {
    const { start, end } = occurrenceWindow(dateKey, startMinutes, endMinutes)
    if (start.getTime() <= now.getTime()) continue

    const { totalPrice } = computePrice({
      start,
      end,
      basePricePerHour: court.base_price_per_hour,
      depositPercentage: 0,
      rules: court.court_pricing_rules,
    })
    const row = {
      court_id: series.court_id,
      user_id: series.user_id,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      total_price: totalPrice,
      deposit_amount: 0,
      recurring_id: series.id,
    }

    const { error } = await admin.from('bookings').insert({ ...row, status: 'confirmed' })
    if (!error) {
      result.created++
      continue
    }
    // Buổi này đã được tạo (hoặc đã bị hủy/bỏ qua trước đó): giữ nguyên
    if (error.code === '23505') continue

    if (error.code === '23P01') {
      // Khung giờ đã có người đặt: ghi một dòng "đã bỏ qua" để lần sau không thử và không báo lại
      const { error: placeholderError } = await admin.from('bookings').insert({
        ...row,
        status: 'cancelled',
        cancelled_by: 'system',
        cancelled_at: now.toISOString(),
        note: 'Bỏ qua: khung giờ đã có người đặt',
      })
      if (placeholderError && placeholderError.code !== '23505') {
        console.error('generateOccurrences: không ghi được buổi bị bỏ qua', placeholderError)
        continue
      }
      if (!placeholderError) {
        result.skipped++
        await notifyUser({
          userId: series.user_id,
          title: 'Lịch cố định bị bỏ qua một buổi',
          message: `Buổi ${formatTime(start)} ngày ${formatDate(start)} tại ${court.name} (${club.name}) bị bỏ qua vì khung giờ đã có người đặt.`,
          type: 'booking',
          link: '/recurring',
        })
      }
      continue
    }
    console.error('generateOccurrences: insert lỗi', error)
  }
  return result
}

/** Tác vụ định kỳ: duyệt mọi lịch cố định đang chạy, sinh thêm buổi và đóng lịch đã hết hạn. */
export async function generateAllActive(admin: Admin, now = new Date()): Promise<GenerateResult & { series: number }> {
  const total = { created: 0, skipped: 0, series: 0 }
  const today = todayKey(now)

  // Lịch đã hết hạn (qua ngày kết thúc) thì đóng
  await admin.from('recurring_bookings').update({ status: 'cancelled' }).eq('status', 'active').lt('ends_on', today)

  const { data, error } = await admin.from('recurring_bookings').select(SERIES_SELECT).eq('status', 'active').limit(1000)
  if (error) {
    console.error('generateAllActive: không đọc được danh sách', error)
    return total
  }
  for (const series of (data ?? []) as unknown as SeriesRow[]) {
    const r = await generateOccurrences(admin, series, now)
    total.series++
    total.created += r.created
    total.skipped += r.skipped
  }
  return total
}
