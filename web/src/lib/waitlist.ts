import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyUser } from '@/lib/notify'
import { enforceRateLimit } from '@/lib/rate-limit'
import { formatDate, formatTime } from '@/lib/format'
import type { Database } from '@/types/database'

/**
 * Danh sách chờ khung giờ: khung giờ đang kín thì người chơi đăng ký chờ, khi có người hủy hoặc hết hạn giữ chỗ
 * thì người đăng ký sớm nhất được báo (claim_free_waitlist_entries) và có HOLD phút để đặt trước khi đến lượt người kế.
 */
export const MAX_WAITLIST_PER_USER = 10
export const MAX_WAITLIST_HOURS = 6
export const MAX_WAITLIST_DAYS_AHEAD = 60

type Admin = SupabaseClient<Database>

export type WaitlistWindow = { ok: true; start: Date; end: Date } | { ok: false; error: string }

/** Kiểm tra khung giờ đăng ký chờ. Thuần túy để kiểm thử. */
export function validateWaitlistWindow(startISO: string, endISO: string, now = Date.now()): WaitlistWindow {
  const start = new Date(startISO)
  const end = new Date(endISO)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return { ok: false, error: 'Thời gian đặt sân không hợp lệ' }
  if (end <= start) return { ok: false, error: 'Giờ kết thúc phải sau giờ bắt đầu' }
  if (start.getTime() <= now) return { ok: false, error: 'Không thể đặt khung giờ đã qua' }
  if (start.getTime() > now + MAX_WAITLIST_DAYS_AHEAD * 24 * 60 * 60 * 1000) {
    return { ok: false, error: `Chỉ nhận đặt trước tối đa ${MAX_WAITLIST_DAYS_AHEAD} ngày` }
  }
  if ((end.getTime() - start.getTime()) / 3_600_000 > MAX_WAITLIST_HOURS) {
    return { ok: false, error: `Mỗi đơn đặt tối đa ${MAX_WAITLIST_HOURS} giờ` }
  }
  return { ok: true, start, end }
}

export type WaitlistResult = { error: string } | { success: true; id: string }

export async function joinWaitlist(userId: string, courtId: string, startISO: string, endISO: string): Promise<WaitlistResult> {
  const limited = await enforceRateLimit('waitlist', userId)
  if (limited) return { error: limited }

  const window = validateWaitlistWindow(startISO, endISO)
  if (!window.ok) return { error: window.error }

  const admin = createAdminClient()
  const { data: court } = await admin
    .from('courts')
    .select('id, is_active, club:clubs ( is_active )')
    .eq('id', courtId)
    .maybeSingle()
  const club = court?.club as unknown as { is_active: boolean } | null
  if (!court || !court.is_active || !club?.is_active) return { error: 'Không tìm thấy thông tin sân con' }

  // Chỉ chờ khung giờ đang kín; còn trống thì đặt luôn
  const { data: busy, error: busyError } = await admin.rpc('slot_is_busy', {
    p_court: courtId,
    p_start: window.start.toISOString(),
    p_end: window.end.toISOString(),
  })
  if (busyError) {
    console.error('joinWaitlist: không kiểm tra được khung giờ', busyError)
    return { error: 'Không thể đăng ký chờ. Vui lòng thử lại.' }
  }
  if (!busy) return { error: 'Khung giờ này đang trống, bạn có thể đặt ngay.' }

  const { count } = await admin
    .from('slot_waitlist')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', ['waiting', 'notified'])
  if ((count ?? 0) >= MAX_WAITLIST_PER_USER) {
    return { error: `Bạn đang chờ tối đa ${MAX_WAITLIST_PER_USER} khung giờ. Hãy rút bớt rồi đăng ký thêm.` }
  }

  const { data, error } = await admin
    .from('slot_waitlist')
    .insert({ user_id: userId, court_id: courtId, start_time: window.start.toISOString(), end_time: window.end.toISOString() })
    .select('id')
    .single()
  if (error || !data) {
    if (error?.code === '23505') return { error: 'Bạn đã đăng ký chờ khung giờ này rồi.' }
    console.error('joinWaitlist: insert lỗi', error)
    return { error: 'Không thể đăng ký chờ. Vui lòng thử lại.' }
  }
  return { success: true, id: data.id }
}

export async function leaveWaitlist(userId: string, entryId: string): Promise<{ error: string } | { success: true }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('slot_waitlist')
    .update({ status: 'cancelled' })
    .eq('id', entryId)
    .eq('user_id', userId)
    .in('status', ['waiting', 'notified'])
    .select('id')
  if (error) {
    console.error('leaveWaitlist lỗi', error)
    return { error: 'Không thể rút khỏi danh sách chờ. Vui lòng thử lại.' }
  }
  if (!data?.length) return { error: 'Không tìm thấy đăng ký chờ này' }
  return { success: true }
}

/** Người chơi đã đặt được khung giờ (hoặc khung giờ chồng lên) thì đóng đăng ký chờ của họ. */
export async function fulfillWaitlist(admin: Admin, userId: string, courtId: string, start: Date, end: Date) {
  const { error } = await admin
    .from('slot_waitlist')
    .update({ status: 'fulfilled' })
    .eq('user_id', userId)
    .eq('court_id', courtId)
    .in('status', ['waiting', 'notified'])
    .lt('start_time', end.toISOString())
    .gt('end_time', start.toISOString())
  if (error) console.error('fulfillWaitlist lỗi', error)
}

/** Báo cho những người chờ mà khung giờ đã trống. Trả về số người đã báo. */
export async function notifyFreedWaitlist(admin: Admin): Promise<number> {
  const { data, error } = await admin.rpc('claim_free_waitlist_entries', { p_hold: '15 minutes' })
  if (error) {
    console.error('notifyFreedWaitlist: không lấy được danh sách', error)
    return 0
  }
  const entries = data ?? []
  if (entries.length === 0) return 0

  const { data: courts } = await admin
    .from('courts')
    .select('id, name, club:clubs ( id, name )')
    .in('id', [...new Set(entries.map((e) => e.court_id))])
  const courtById = new Map(
    (courts ?? []).map((c) => [c.id, { name: c.name, club: c.club as unknown as { id: string; name: string } | null }])
  )

  const results = await Promise.all(
    entries.map((e) => {
      const court = courtById.get(e.court_id)
      return notifyUser({
        userId: e.user_id,
        title: 'Khung giờ bạn chờ đã trống 🎉',
        message: `${court?.name ?? 'Sân'} (${court?.club?.name ?? ''}) lúc ${formatTime(e.start_time)} - ${formatTime(e.end_time)} ngày ${formatDate(e.start_time)} vừa trống. Đặt ngay trong 15 phút kẻo người khác giành mất!`,
        type: 'booking',
        link: court?.club ? `/clubs/${court.club.id}` : '/clubs',
      })
    })
  )
  return results.filter(Boolean).length
}
