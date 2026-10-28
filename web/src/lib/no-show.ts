import { createAdminClient } from '@/lib/supabase/admin'
import { notifyUser } from '@/lib/notify'
import { formatDate, formatTime } from '@/lib/format'
import { revalidateBookingPages } from '@/lib/booking-service'
import { revalidatePath } from 'next/cache'

/**
 * Chủ sân báo người đặt không đến, hoặc chủ kèo báo thành viên đã được duyệt không đến. Mỗi lần báo cộng vào điểm uy tín
 * của người đó (get_player_reputation). Báo nhầm thì gỡ được. Kiểm tra quyền ở đây vì cột no_show_at chỉ service_role ghi.
 */

/** Chỉ báo trong vòng này sau khi buổi chơi kết thúc, để không ai bị "lục lại" chuyện cũ. */
export const NO_SHOW_WINDOW_DAYS = 14
const DAY_MS = 24 * 60 * 60 * 1000

/** Lỗi nếu chưa/không còn báo được không đến cho buổi chơi này; null nếu được. Thuần túy để kiểm thử. */
export function noShowError(startTime: string, endTime: string, now = Date.now()): string | null {
  if (new Date(startTime).getTime() > now) return 'Chưa đến giờ chơi nên chưa thể báo không đến'
  if (now - new Date(endTime).getTime() > NO_SHOW_WINDOW_DAYS * DAY_MS) {
    return `Đã quá ${NO_SHOW_WINDOW_DAYS} ngày kể từ buổi chơi nên không thể thay đổi báo không đến`
  }
  return null
}

type Result = { error: string } | { success: true }

interface BookingRow {
  id: string
  user_id: string
  status: string
  start_time: string
  end_time: string
  no_show_at: string | null
  court: { name: string; club: { name: string; owner_id: string } | null } | null
}

/** Chủ sân báo (flag = true) hoặc gỡ báo (flag = false) người đặt không đến. */
export async function setBookingNoShow(ownerId: string, bookingId: string, flag: boolean): Promise<Result> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('bookings')
    .select('id, user_id, status, start_time, end_time, no_show_at, court:courts ( name, club:clubs ( name, owner_id ) )')
    .eq('id', bookingId)
    .maybeSingle()
  const booking = data as unknown as BookingRow | null

  if (!booking || booking.court?.club?.owner_id !== ownerId) {
    return { error: 'Bạn không có quyền thao tác đơn đặt sân này' }
  }
  if (booking.status !== 'confirmed' && booking.status !== 'completed') {
    return { error: 'Chỉ báo không đến được với đơn đã xác nhận' }
  }
  const blocked = noShowError(booking.start_time, booking.end_time)
  if (blocked) return { error: blocked }
  if (flag === Boolean(booking.no_show_at)) return { success: true }

  const { data: updated, error } = await admin
    .from('bookings')
    .update({ no_show_at: flag ? new Date().toISOString() : null })
    .eq('id', bookingId)
    .in('status', ['confirmed', 'completed'])
    .select('id')
  if (error || !updated?.length) {
    if (error) console.error('setBookingNoShow lỗi', error)
    return { error: 'Không thể cập nhật. Vui lòng thử lại.' }
  }

  if (flag) {
    const when = `${formatTime(booking.start_time)} ${formatDate(booking.start_time)}`
    await notifyUser({
      userId: booking.user_id,
      title: 'Bạn bị ghi nhận không đến sân',
      message: `Chủ sân ${booking.court?.club?.name} ghi nhận bạn không đến ${booking.court?.name} lúc ${when}. Điều này ảnh hưởng điểm uy tín của bạn; hãy liên hệ chủ sân nếu có nhầm lẫn.`,
      type: 'booking',
      link: '/my-bookings',
    })
  }

  revalidateBookingPages()
  revalidatePath('/owner/schedule')
  return { success: true }
}

interface ParticipantRow {
  id: string
  user_id: string
  status: string
  no_show_at: string | null
  match: { id: string; title: string; creator_id: string; start_time: string; end_time: string } | null
}

/** Chủ kèo báo (flag = true) hoặc gỡ báo (flag = false) một thành viên đã được duyệt không đến. */
export async function setParticipantNoShow(hostId: string, participantId: string, flag: boolean): Promise<Result> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('match_participants')
    .select('id, user_id, status, no_show_at, match:matches ( id, title, creator_id, start_time, end_time )')
    .eq('id', participantId)
    .maybeSingle()
  const participant = data as unknown as ParticipantRow | null

  if (!participant?.match || participant.match.creator_id !== hostId) {
    return { error: 'Chỉ chủ phòng mới có quyền báo thành viên không đến' }
  }
  if (participant.status !== 'accepted') {
    return { error: 'Chỉ báo không đến được với thành viên đã được duyệt' }
  }
  const blocked = noShowError(participant.match.start_time, participant.match.end_time)
  if (blocked) return { error: blocked }
  if (flag === Boolean(participant.no_show_at)) return { success: true }

  const { data: updated, error } = await admin
    .from('match_participants')
    .update({ no_show_at: flag ? new Date().toISOString() : null })
    .eq('id', participantId)
    .eq('status', 'accepted')
    .select('id')
  if (error || !updated?.length) {
    if (error) console.error('setParticipantNoShow lỗi', error)
    return { error: 'Không thể cập nhật. Vui lòng thử lại.' }
  }

  if (flag) {
    await notifyUser({
      userId: participant.user_id,
      title: 'Bạn bị ghi nhận không đến kèo',
      message: `Chủ kèo ghi nhận bạn không đến kèo "${participant.match.title}". Điều này ảnh hưởng điểm uy tín của bạn.`,
      type: 'match',
      link: `/matches/${participant.match.id}`,
    })
  }

  revalidatePath(`/matches/${participant.match.id}`)
  return { success: true }
}
