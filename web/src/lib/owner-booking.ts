import type { SupabaseClient, User } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyUser } from '@/lib/notify'
import { cancelBookingAsOwner } from '@/lib/booking-cancel'
import { isManualPayment, latestPayment } from '@/lib/manual-payment'
import { settlePayment } from '@/lib/payments'
import type { Database } from '@/types/database'

/**
 * Chủ sân đổi trạng thái đơn đặt sân (xác nhận cọc, hoàn tất, hủy). Dùng chung cho Server Action của web và API của
 * ứng dụng mobile. Trả lỗi bằng tiếng Việt (nơi gọi dịch), không ném lỗi.
 */
export type OwnerBookingStatus = 'confirmed' | 'cancelled' | 'completed'
export const OWNER_BOOKING_STATUSES: readonly OwnerBookingStatus[] = ['confirmed', 'cancelled', 'completed']

export function isOwnerBookingStatus(value: unknown): value is OwnerBookingStatus {
  return (OWNER_BOOKING_STATUSES as readonly unknown[]).includes(value)
}

const ALLOWED: Record<string, readonly OwnerBookingStatus[]> = {
  pending: ['confirmed', 'cancelled'], // chủ sân nhận cọc tiền mặt / từ chối
  confirmed: ['completed', 'cancelled'],
}

/** Lỗi nếu không được chuyển từ trạng thái hiện tại sang trạng thái mới; null nếu được. Thuần túy để dễ kiểm thử. */
export function transitionError(current: string, next: OwnerBookingStatus, startTime: string, now = Date.now()): string | null {
  if (!ALLOWED[current]?.includes(next)) return 'Không thể chuyển đơn từ trạng thái hiện tại sang trạng thái này'
  if (next === 'completed' && new Date(startTime).getTime() > now) return 'Chưa đến giờ chơi nên chưa thể đánh dấu hoàn thành'
  return null
}

export type OwnerBookingResult = { error: string } | { success: true; refundAmount?: number }

function revalidateOwnerPages() {
  revalidatePath('/owner/schedule')
  revalidatePath('/owner/dashboard')
  revalidatePath('/owner/refunds')
  revalidatePath('/my-bookings')
}

export async function updateBookingStatusForOwner(
  supabase: SupabaseClient<Database>,
  user: Pick<User, 'id'>,
  bookingId: string,
  status: OwnerBookingStatus
): Promise<OwnerBookingResult> {
  // RLS cho cả người đặt lẫn chủ sân xem được đơn, nên phải kiểm tra rõ ràng đây là chủ cụm sân
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, user_id, status, start_time, court:courts ( name, club:clubs ( name, owner_id ) )')
    .eq('id', bookingId)
    .maybeSingle()

  const court = booking?.court as unknown as { name: string; club: { name: string; owner_id: string } | null } | null
  if (!booking || court?.club?.owner_id !== user.id) {
    return { error: 'Bạn không có quyền thao tác đơn đặt sân này' }
  }

  const blocked = transitionError(booking.status, status, booking.start_time)
  if (blocked) return { error: blocked }

  // Hủy: đi qua quy tắc hoàn cọc (chủ sân hủy thì luôn hoàn đủ) và tự báo cho người đặt
  if (status === 'cancelled') {
    const outcome = await cancelBookingAsOwner(bookingId)
    if (!outcome.ok) return { error: outcome.error }
    revalidateOwnerPages()
    return { success: true, refundAmount: outcome.decision.refundAmount }
  }

  // Xác nhận đơn thanh toán bằng chuyển khoản thủ công: ghi nhận khoản cọc như một khoản đã thanh toán thật
  if (status === 'confirmed' && booking.status === 'pending') {
    const payment = await latestPayment(bookingId)
    if (payment && isManualPayment(payment) && payment.status !== 'paid') {
      const settled = await settlePayment({ orderCode: payment.order_code, reference: `MANUAL_${Date.now()}` })
      if (!settled.ok) return { error: settled.error }
      revalidateOwnerPages()
      return { success: true }
    }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('bookings').update({ status }).eq('id', bookingId)
  if (error) {
    console.error('updateBookingStatus lỗi', error)
    return { error: 'Không thể cập nhật đơn đặt sân' }
  }

  const confirmed = status === 'confirmed'
  await notifyUser({
    userId: booking.user_id,
    title: confirmed ? 'Đơn đặt sân đã được xác nhận' : 'Đơn đặt sân đã hoàn thành',
    message: confirmed
      ? `Đơn đặt ${court.name} (${court.club?.name}) đã được xác nhận.`
      : `Đơn đặt ${court.name} (${court.club?.name}) đã hoàn thành.`,
    type: 'booking',
    link: `/bookings/${bookingId}`,
  })

  revalidateOwnerPages()
  return { success: true }
}
