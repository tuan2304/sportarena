import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyUser, pushAfterResponse } from '@/lib/notify'
import { notifyFreedWaitlist } from '@/lib/waitlist'
import { formatVnd } from '@/lib/format'
import { decideCancellation, isLateCancel, type CancelDecision, type CancelledBy } from '@/lib/cancellation'
import { revalidateBookingPages } from '@/lib/booking-service'
import type { Database } from '@/types/database'

type Admin = SupabaseClient<Database>

/**
 * Hủy đơn đặt sân và ghi nhận hoàn cọc. Dùng chung cho người chơi tự hủy, chủ sân hủy và API mobile.
 * Kiểm tra quyền (đúng người đặt / đúng chủ sân) do nơi gọi làm trước; ở đây chỉ áp quy tắc và ghi dữ liệu.
 */

/** Tổng tiền cọc thật đã nhận cho đơn (bỏ qua khoản giả lập ở môi trường dev). */
export async function paidDepositTotal(admin: Admin, bookingId: string): Promise<number> {
  const { data } = await admin.from('payments').select('amount, metadata').eq('booking_id', bookingId).eq('status', 'paid')
  return (data ?? [])
    .filter((p) => (p.metadata as { simulated?: boolean } | null)?.simulated !== true)
    .reduce((sum, p) => sum + Number(p.amount), 0)
}

interface LoadedBooking {
  id: string
  user_id: string
  status: string
  start_time: string
  court: { name: string; club: { id: string; name: string; owner_id: string; free_cancel_hours: number } | null } | null
}

async function loadBooking(admin: Admin, bookingId: string): Promise<LoadedBooking | null> {
  const { data } = await admin
    .from('bookings')
    .select('id, user_id, status, start_time, court:courts ( name, club:clubs ( id, name, owner_id, free_cancel_hours ) )')
    .eq('id', bookingId)
    .maybeSingle()
  return (data as unknown as LoadedBooking | null) ?? null
}

export type CancelOutcome =
  | { ok: false; error: string }
  | { ok: true; decision: Extract<CancelDecision, { allowed: true }>; booking: LoadedBooking }

/**
 * Áp quy tắc hủy lên một đơn và ghi vào database. Chỉ một yêu cầu thắng khi hai bên hủy cùng lúc
 * (điều kiện `status = trạng thái đã đọc` trong câu UPDATE).
 */
export async function performCancellation(
  admin: Admin,
  bookingId: string,
  by: CancelledBy,
  now = new Date()
): Promise<CancelOutcome> {
  const booking = await loadBooking(admin, bookingId)
  if (!booking || !booking.court?.club) return { ok: false, error: 'Không tìm thấy đơn đặt sân' }

  const paidAmount = booking.status === 'confirmed' ? await paidDepositTotal(admin, booking.id) : 0
  const decision = decideCancellation({
    status: booking.status,
    start: new Date(booking.start_time),
    now,
    paidAmount,
    freeCancelHours: booking.court.club.free_cancel_hours,
    by,
  })
  if (!decision.allowed) return { ok: false, error: decision.reason }

  const { data: updated, error } = await admin
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_by: by,
      cancelled_at: now.toISOString(),
      refund_amount: decision.refundAmount,
      refund_status: decision.refundStatus,
      late_cancel: isLateCancel({
        by,
        status: booking.status,
        hoursBeforeStart: decision.hoursBeforeStart,
        freeCancelHours: booking.court.club.free_cancel_hours,
      }),
    })
    .eq('id', booking.id)
    .eq('status', booking.status)
    .select('id')

  if (error) {
    console.error('performCancellation: không cập nhật được đơn', error)
    return { ok: false, error: 'Không thể hủy đơn. Vui lòng thử lại.' }
  }
  if (!updated || updated.length === 0) {
    return { ok: false, error: 'Đơn vừa được cập nhật ở nơi khác. Vui lòng tải lại trang.' }
  }

  await admin.from('payments').update({ status: 'cancelled' }).eq('booking_id', booking.id).eq('status', 'pending')

  // Kèo gắn với đơn bị hủy theo; báo cho các thành viên đã được duyệt (chủ kèo chính là người đặt nên đã biết)
  const { data: match } = await admin
    .from('matches')
    .update({ status: 'cancelled' })
    .eq('booking_id', booking.id)
    .in('status', ['open', 'full'])
    .select('id, title')
    .maybeSingle()
  if (match) {
    const { data: members } = await admin
      .from('match_participants')
      .select('user_id')
      .eq('match_id', match.id)
      .eq('status', 'accepted')
    await Promise.all(
      (members ?? []).map((m) =>
        notifyUser({
          userId: m.user_id,
          title: 'Kèo đã bị hủy',
          message: `Kèo "${match.title}" bị hủy vì đơn đặt sân đã được hủy.`,
          type: 'match',
          link: `/matches/${match.id}`,
        })
      )
    )
  }

  revalidateBookingPages()
  // Khung giờ vừa được nhả: báo ngay cho người đang chờ thay vì đợi lượt chạy định kỳ kế tiếp
  await pushAfterResponse(async () => {
    await notifyFreedWaitlist(admin)
  })
  return { ok: true, decision, booking }
}

export interface PlayerCancelResult {
  error?: string
  success?: boolean
  refundAmount?: number
  forfeited?: boolean
}

/** Người chơi tự hủy đơn của chính mình. */
export async function cancelBookingAsPlayer(userId: string, bookingId: string): Promise<PlayerCancelResult> {
  const admin = createAdminClient()
  const { data: owned } = await admin.from('bookings').select('user_id').eq('id', bookingId).maybeSingle()
  if (!owned || owned.user_id !== userId) return { error: 'Không tìm thấy đơn đặt sân' }

  const outcome = await performCancellation(admin, bookingId, 'player')
  if (!outcome.ok) return { error: outcome.error }

  const { decision, booking } = outcome
  const courtName = booking.court?.name ?? 'sân'
  const clubName = booking.court?.club?.name ?? ''

  if (booking.court?.club) {
    await notifyUser({
      userId: booking.court.club.owner_id,
      title: decision.refundStatus === 'pending' ? 'Khách hủy đơn, cần hoàn cọc' : 'Khách đã hủy đơn đặt sân',
      message:
        decision.refundStatus === 'pending'
          ? `Đơn ${courtName} (${clubName}) đã bị khách hủy trong hạn miễn phí. Vui lòng hoàn ${formatVnd(decision.refundAmount)} cho khách.`
          : decision.forfeited
            ? `Đơn ${courtName} (${clubName}) đã bị khách hủy muộn, bạn giữ lại tiền cọc theo chính sách.`
            : `Đơn ${courtName} (${clubName}) đã bị khách hủy (chưa có khoản cọc).`,
      type: 'booking',
      link: decision.refundStatus === 'pending' ? '/owner/refunds' : '/owner/schedule',
    })
  }

  return { success: true, refundAmount: decision.refundAmount, forfeited: decision.forfeited }
}

/** Chủ sân hủy: người đặt luôn được hoàn đủ khoản đã cọc. */
export async function cancelBookingAsOwner(bookingId: string) {
  const admin = createAdminClient()
  const outcome = await performCancellation(admin, bookingId, 'owner')
  if (!outcome.ok) return outcome

  const { decision, booking } = outcome
  await notifyUser({
    userId: booking.user_id,
    title: 'Đơn đặt sân đã bị chủ sân hủy',
    message:
      decision.refundStatus === 'pending'
        ? `Đơn đặt ${booking.court?.name} (${booking.court?.club?.name}) đã bị chủ sân hủy. Bạn sẽ được hoàn ${formatVnd(decision.refundAmount)} tiền cọc.`
        : `Đơn đặt ${booking.court?.name} (${booking.court?.club?.name}) đã bị chủ sân hủy.`,
    type: 'booking',
    link: '/my-bookings',
  })
  return outcome
}

/** Chủ sân đã chuyển trả tiền cọc cho khách. */
export async function markRefundedAsOwner(ownerId: string, bookingId: string): Promise<{ error?: string; success?: boolean }> {
  const admin = createAdminClient()
  const booking = await loadBooking(admin, bookingId)
  if (!booking || booking.court?.club?.owner_id !== ownerId) return { error: 'Bạn không có quyền thao tác đơn đặt sân này' }

  const { data: updated, error } = await admin
    .from('bookings')
    .update({ refund_status: 'refunded', refunded_at: new Date().toISOString() })
    .eq('id', bookingId)
    .eq('refund_status', 'pending')
    .select('refund_amount')
  if (error) {
    console.error('markRefunded lỗi', error)
    return { error: 'Không thể cập nhật. Vui lòng thử lại.' }
  }
  if (!updated || updated.length === 0) return { error: 'Đơn này không còn ở trạng thái chờ hoàn cọc' }

  await admin.from('payments').update({ status: 'refunded' }).eq('booking_id', bookingId).eq('status', 'paid')
  await notifyUser({
    userId: booking.user_id,
    title: 'Bạn đã được hoàn cọc',
    message: `Chủ sân ${booking.court?.club?.name} đã hoàn ${formatVnd(Number(updated[0].refund_amount))} tiền cọc cho đơn ${booking.court?.name}.`,
    type: 'payment',
    link: '/my-bookings',
  })
  return { success: true }
}
