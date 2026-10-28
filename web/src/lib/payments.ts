import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyUser } from '@/lib/notify'
import { captureError } from '@/lib/monitoring'
import { formatNumber as money } from '@/lib/format'

export type SettleResult =
  | { ok: true; alreadyPaid?: boolean; needsRefund?: boolean }
  | { ok: false; status: 400 | 404 | 500; error: string }

interface SettleInput {
  orderCode: number
  /** Số tiền thực nhận từ PayOS; bỏ trống nếu không có (chỉ dùng cho giả lập dev) */
  paidAmount?: number
  reference: string
}


/**
 * Ghi nhận một khoản cọc đã được thanh toán. Dùng chung cho webhook PayOS và giả lập khi dev.
 * An toàn khi bị gọi lặp (PayOS có thể gửi lại webhook): chỉ lần đầu tiên chuyển pending → paid.
 */
export async function settlePayment({ orderCode, paidAmount, reference }: SettleInput): Promise<SettleResult> {
  const admin = createAdminClient()

  const { data: payment, error: findErr } = await admin
    .from('payments')
    .select(`
      id, booking_id, user_id, amount, status, metadata,
      booking:bookings (
        id, status,
        court:courts ( name, club:clubs ( name, owner_id ) )
      )
    `)
    .eq('order_code', orderCode)
    .maybeSingle()

  if (findErr) {
    console.error('settlePayment: lỗi tra cứu payment', findErr)
    return { ok: false, status: 500, error: 'Không tra cứu được giao dịch' }
  }
  if (!payment) {
    return { ok: false, status: 404, error: `Không tìm thấy đơn thanh toán ${orderCode}` }
  }
  if (payment.status === 'paid') {
    return { ok: true, alreadyPaid: true }
  }

  // Chặn trường hợp chuyển thiếu tiền
  if (paidAmount !== undefined && paidAmount < Number(payment.amount)) {
    console.warn(`settlePayment: đơn ${orderCode} chuyển thiếu (${paidAmount} < ${payment.amount})`)
    return { ok: false, status: 400, error: 'Số tiền thanh toán không khớp với đơn' }
  }

  // Payment → paid, booking → confirmed và mở lại kèo chạy trong MỘT transaction của Postgres, nên tiến trình có chết
  // giữa chừng cũng không để lại "đã cọc nhưng đơn chưa xác nhận" (webhook gọi lại sẽ tưởng đã xong và bỏ qua).
  // Chỉ một request giành được pending → paid. Nếu tiền về sau khi đơn hết hạn mà sân đã có người khác đặt thì hàm
  // giữ lại bằng chứng (needs_refund) để hoàn tiền thủ công.
  const { data: outcome, error: settleErr } = await admin.rpc('settle_booking_payment', {
    p_payment_id: payment.id,
    p_reference: reference,
  })
  if (settleErr) {
    // Lỗi đã hoàn tác toàn bộ nên payment vẫn pending: trả 500 để PayOS gọi lại và xử lý lại từ đầu
    captureError('payments.settle', settleErr, { paymentId: payment.id, orderCode })
    return { ok: false, status: 500, error: 'Không xác nhận được lịch đặt' }
  }
  if (outcome === 'already_paid') {
    return { ok: true, alreadyPaid: true }
  }
  const needsRefund = outcome === 'slot_taken'

  const booking = payment.booking as unknown as {
    id: string
    status: string
    court: { name: string; club: { name: string; owner_id: string } | null } | null
  } | null

  const courtName = booking?.court?.name || 'Sân'
  const clubName = booking?.court?.club?.name || 'Cụm sân'
  const ownerId = booking?.court?.club?.owner_id

  if (needsRefund) {
    await notifyUser({
      userId: payment.user_id,
      title: 'Đã nhận cọc nhưng khung giờ không còn',
      message: `Chúng tôi đã nhận ${money(payment.amount)} đ nhưng khung giờ ${courtName} (${clubName}) đã có người khác đặt trong lúc đơn hết hạn. Vui lòng liên hệ để được hoàn tiền.`,
      type: 'payment',
      link: `/bookings/${payment.booking_id}`,
    })
  } else {
    await notifyUser({
      userId: payment.user_id,
      title: 'Thanh toán cọc thành công! 🎉',
      message: `Bạn đã cọc ${money(payment.amount)} đ cho sân ${courtName} (${clubName}). Sân đã được khóa lịch cho bạn!`,
      type: 'payment',
      link: `/bookings/${payment.booking_id}`,
    })
    if (ownerId) {
      await notifyUser({
        userId: ownerId,
        title: 'Có đơn đặt sân mới! 💰',
        message: `Khách vừa chuyển cọc ${money(payment.amount)} đ cho ${courtName} (${clubName}).`,
        type: 'booking',
        link: '/owner/schedule',
      })
    }
  }

  revalidatePath(`/bookings/${payment.booking_id}`)
  revalidatePath('/my-bookings')
  revalidatePath('/owner/schedule')
  revalidatePath('/owner/dashboard')

  return { ok: true, needsRefund }
}
