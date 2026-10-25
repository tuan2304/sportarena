'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireClubOwner } from '@/lib/auth-guards'
import { createPaymentLink, getPlatformCredentials, isPaymentSimulationEnabled, PaymentGatewayError } from '@/lib/payos'
import { resolveAppUrl } from '@/lib/app-url'
import { getProMonthlyPrice, SUBSCRIPTION_MONTH_OPTIONS, subscriptionPrice } from '@/lib/billing'
import { settleSubscription } from '@/lib/subscriptions'
import { tr } from '@/lib/localize-error'

export interface SubscriptionCheckout {
  paymentId: string
  amount: number
  months: number
  qrImageUrl: string
  bankName: string
  accountNumber: string
  accountName: string
  transferContent: string
  /** true nếu là giao dịch mẫu ở môi trường dev */
  simulated: boolean
}

/** Tạo QR thanh toán thuê bao. Chủ sân trả cho NỀN TẢNG qua kênh PayOS của nền tảng. */
export async function createSubscriptionPayment(
  clubId: string,
  months: number
): Promise<{ error?: string; checkout?: SubscriptionCheckout }> {
  const auth = await requireClubOwner(clubId)
  if ('error' in auth) return { error: await tr(auth.error) }

  if (!(SUBSCRIPTION_MONTH_OPTIONS as readonly number[]).includes(months)) {
    return { error: await tr('Số tháng không hợp lệ') }
  }
  const amount = subscriptionPrice(months, getProMonthlyPrice())

  const admin = createAdminClient()
  const { data: orderCode, error: seqErr } = await admin.rpc('next_payos_order_code')
  if (seqErr || orderCode == null) {
    console.error('createSubscriptionPayment: không cấp được orderCode', seqErr)
    return { error: await tr('Không thể khởi tạo thanh toán. Vui lòng thử lại.') }
  }

  const appUrl = resolveAppUrl()
  let link
  try {
    link = await createPaymentLink(
      {
        orderCode: Number(orderCode),
        amount,
        description: `SUB ${orderCode}`,
        returnUrl: `${appUrl}/owner/billing`,
        cancelUrl: `${appUrl}/owner/billing`,
        expiredAt: Math.floor(Date.now() / 1000) + 30 * 60,
      },
      getPlatformCredentials()
    )
  } catch (err) {
    return { error: err instanceof PaymentGatewayError ? err.message : 'Không thể tạo mã thanh toán.' }
  }

  // Hủy các mã cũ chưa trả để tránh nhiều QR cùng hiệu lực cho một cụm sân
  await admin.from('subscription_payments').update({ status: 'cancelled' }).eq('club_id', clubId).eq('status', 'pending')

  const { data: row, error: insertErr } = await admin
    .from('subscription_payments')
    .insert({
      club_id: clubId,
      user_id: auth.user.id,
      order_code: Number(orderCode),
      amount,
      months,
      status: 'pending',
      checkout_url: link.checkoutUrl,
      qr_code_url: link.qrImageUrl,
      metadata: {
        bin: link.bin,
        account_number: link.accountNumber,
        account_name: link.accountName,
        description: link.description,
        simulated: link.simulated,
        channel: 'platform',
      },
    })
    .select('id')
    .single()

  if (insertErr || !row) {
    console.error('createSubscriptionPayment: lưu lỗi', insertErr)
    return { error: await tr('Không lưu được giao dịch. Vui lòng thử lại.') }
  }

  return {
    checkout: {
      paymentId: row.id,
      amount,
      months,
      qrImageUrl: link.qrImageUrl,
      bankName: link.bin,
      accountNumber: link.accountNumber,
      accountName: link.accountName,
      transferContent: link.description,
      simulated: link.simulated,
    },
  }
}

/** Hỏi trạng thái một giao dịch thuê bao (chủ sân xem được giao dịch của mình nhờ RLS). */
export async function getSubscriptionPaymentStatus(paymentId: string): Promise<{ status?: string; error?: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('subscription_payments').select('status').eq('id', paymentId).maybeSingle()
  if (error || !data) return { error: await tr('Không tìm thấy giao dịch') }
  return { status: data.status }
}

/** Chỉ cho môi trường dev khi nền tảng chưa có khóa PayOS. */
export async function simulateSubscriptionPayment(paymentId: string): Promise<{ error?: string; success?: boolean }> {
  if (!isPaymentSimulationEnabled()) return { error: await tr('Tính năng giả lập không khả dụng') }

  const supabase = await createClient()
  const { data: row } = await supabase
    .from('subscription_payments')
    .select('order_code, metadata')
    .eq('id', paymentId)
    .maybeSingle()
  if (!row) return { error: await tr('Không tìm thấy giao dịch của bạn') }
  if ((row.metadata as { simulated?: boolean } | null)?.simulated !== true) {
    return { error: await tr('Giao dịch này là giao dịch thật, không thể giả lập') }
  }

  const result = await settleSubscription({ orderCode: Number(row.order_code), reference: `SIM_${Date.now()}` })
  if (!result.ok) return { error: await tr(result.error) }
  revalidatePath('/owner/billing')
  return { success: true }
}
