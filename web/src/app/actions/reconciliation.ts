'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth-guards'
import { notifyUser } from '@/lib/notify'
import { isUuid } from '@/lib/mobile-api'
import { formatNumber } from '@/lib/format'
import { captureError } from '@/lib/monitoring'
import { enforceRateLimit } from '@/lib/rate-limit'
import { tr } from '@/lib/localize-error'

export type ReconcileResult = { error?: string; success?: boolean; outcome?: 'confirmed' | 'slot_taken' }

function refresh() {
  revalidatePath('/admin/payments')
  revalidatePath('/admin')
}

async function loadPayment(paymentId: string) {
  const { data } = await createAdminClient()
    .from('payments')
    .select('id, user_id, amount, booking:bookings(court:courts(club:clubs(name)))')
    .eq('id', paymentId)
    .maybeSingle()
  return data as unknown as {
    id: string
    user_id: string
    amount: number
    booking: { court: { club: { name: string } | null } | null } | null
  } | null
}

/** Quản trị đã chuyển trả cọc cho khách ngoài hệ thống: đóng khoản "cần hoàn tiền" và báo cho khách. */
export async function markPaymentRefunded(paymentId: string, note: string): Promise<ReconcileResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: await tr(auth.error) }
  if (!isUuid(paymentId)) return { error: await tr('Mã giao dịch không hợp lệ') }
  const trimmed = (note ?? '').trim()
  if (trimmed.length > 500) return { error: await tr('Ghi chú tối đa 500 ký tự') }

  const payment = await loadPayment(paymentId)
  if (!payment) return { error: await tr('Không tìm thấy giao dịch') }

  const { data, error } = await createAdminClient().rpc('admin_mark_payment_refunded', {
    p_payment_id: paymentId,
    p_admin: auth.user.id,
    p_note: trimmed || undefined,
  })
  if (error) {
    captureError('admin.reconcile', error, { paymentId, action: 'refund' })
    return { error: await tr('Không cập nhật được giao dịch. Vui lòng thử lại.') }
  }
  if (data !== 'refunded') return { error: await tr('Giao dịch này đã được xử lý trước đó') }

  await notifyUser({
    userId: payment.user_id,
    title: 'Tiền cọc đã được hoàn',
    message: `Khoản cọc ${formatNumber(payment.amount)}đ cho "${payment.booking?.court?.club?.name ?? 'cụm sân'}" đã được hoàn lại cho bạn.`,
    type: 'payment',
  })
  refresh()
  return { success: true }
}

/** Đơn kẹt: khách đã trả cọc nhưng đơn chưa xác nhận. Xác nhận lại đơn; nếu sân đã có người khác đặt thì chuyển sang diện hoàn tiền. */
export async function repairStuckPayment(paymentId: string): Promise<ReconcileResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: await tr(auth.error) }
  if (!isUuid(paymentId)) return { error: await tr('Mã giao dịch không hợp lệ') }

  const payment = await loadPayment(paymentId)
  if (!payment) return { error: await tr('Không tìm thấy giao dịch') }

  const { data, error } = await createAdminClient().rpc('admin_repair_paid_payment', {
    p_payment_id: paymentId,
    p_admin: auth.user.id,
  })
  if (error) {
    captureError('admin.reconcile', error, { paymentId, action: 'repair' })
    return { error: await tr('Không cập nhật được giao dịch. Vui lòng thử lại.') }
  }
  if (data === 'not_stuck') return { error: await tr('Giao dịch này đã được xử lý trước đó') }

  if (data === 'confirmed') {
    await notifyUser({
      userId: payment.user_id,
      title: 'Đặt sân đã được xác nhận',
      message: `Khoản cọc của bạn cho "${payment.booking?.court?.club?.name ?? 'cụm sân'}" đã được ghi nhận và lịch đặt đã được xác nhận.`,
      type: 'booking',
      link: '/my-bookings',
    })
  }
  refresh()
  // slot_taken: khoản cọc đã chuyển sang danh sách cần hoàn tiền để quản trị hoàn cho khách
  return { success: true, outcome: data === 'slot_taken' ? 'slot_taken' : 'confirmed' }
}

/** Nhắc chủ sân chuyển trả cọc cho khách đã hủy hợp lệ. Mỗi đơn chỉ nhắc được một lần mỗi ngày để không làm phiền chủ sân. */
export async function remindOwnerAboutRefund(bookingId: string): Promise<ReconcileResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: await tr(auth.error) }
  if (!isUuid(bookingId)) return { error: await tr('Mã đơn không hợp lệ') }

  const { data } = await createAdminClient()
    .from('bookings')
    .select('id, refund_status, refund_amount, court:courts(club:clubs(name, owner_id))')
    .eq('id', bookingId)
    .maybeSingle()
  const booking = data as unknown as {
    refund_status: string
    refund_amount: number
    court: { club: { name: string; owner_id: string } | null } | null
  } | null
  const club = booking?.court?.club
  if (!booking || !club) return { error: await tr('Không tìm thấy đơn đặt sân') }
  if (booking.refund_status !== 'pending') return { error: await tr('Khoản hoàn cọc này đã được xử lý') }

  const limited = await enforceRateLimit('refundReminder', bookingId)
  if (limited) return { error: await tr('Đã nhắc chủ sân trong hôm nay. Vui lòng thử lại vào ngày mai.') }

  await notifyUser({
    userId: club.owner_id,
    title: 'Nhắc hoàn cọc cho khách',
    message: `Cụm sân "${club.name}" còn khoản hoàn cọc ${formatNumber(booking.refund_amount)}đ cho khách đã hủy đơn. Vui lòng chuyển trả và bấm "Đã hoàn cọc".`,
    type: 'payment',
    link: '/owner/refunds',
  })
  return { success: true }
}
