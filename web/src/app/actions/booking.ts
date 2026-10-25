'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isPaymentSimulationEnabled } from '@/lib/payos'
import { settlePayment } from '@/lib/payments'
import { createBookingForUser, revalidateBookingPages, type CreateBookingResult, type MatchConfig } from '@/lib/booking-service'
import { tr, trResult } from '@/lib/localize-error'

export type { CreateBookingResult, MatchConfig }

export async function createBooking(
  courtId: string,
  startTimeISO: string,
  endTimeISO: string,
  note?: string,
  matchConfig?: MatchConfig
): Promise<CreateBookingResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: await tr('Vui lòng đăng nhập để tiến hành đặt sân') }
  }

  return trResult(await createBookingForUser(supabase, user, courtId, startTimeISO, endTimeISO, note, matchConfig))
}

/**
 * Được gọi khi đồng hồ đếm ngược về 0. Không tin client: chỉ hủy những đơn đã thật sự quá hạn
 * (cron trong database cũng làm việc này mỗi phút).
 */
export async function cancelExpiredBooking(bookingId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: await tr('Vui lòng đăng nhập') }

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, user_id')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking || booking.user_id !== user.id) {
    return { error: await tr('Không tìm thấy đơn đặt sân') }
  }

  const admin = createAdminClient()
  const { error } = await admin.rpc('expire_pending_bookings')
  if (error) {
    console.error('cancelExpiredBooking lỗi', error)
    return { error: await tr('Không thể cập nhật trạng thái đơn') }
  }

  revalidatePath(`/bookings/${bookingId}`)
  revalidateBookingPages()
  return { success: true }
}

/**
 * Chỉ dành cho môi trường phát triển khi chưa cấu hình PayOS: giả lập việc khách đã chuyển khoản.
 * Ở production hàm này luôn từ chối.
 */
export async function simulateDepositPayment(bookingId: string) {
  if (!isPaymentSimulationEnabled()) {
    return { error: await tr('Tính năng giả lập thanh toán không khả dụng') }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: await tr('Vui lòng đăng nhập') }

  const admin = createAdminClient()
  const { data: payment } = await admin
    .from('payments')
    .select('order_code, user_id, metadata')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!payment || payment.user_id !== user.id) {
    return { error: await tr('Không tìm thấy giao dịch của bạn') }
  }
  // Chỉ giả lập cho giao dịch được tạo ở chế độ giả lập, không bao giờ cho giao dịch PayOS thật
  if ((payment.metadata as { simulated?: boolean } | null)?.simulated !== true) {
    return { error: await tr('Giao dịch này là giao dịch thật, không thể giả lập') }
  }

  const result = await settlePayment({ orderCode: Number(payment.order_code), reference: `SIM_${Date.now()}` })
  if (!result.ok) return { error: await tr(result.error) }
  return { success: true }
}
