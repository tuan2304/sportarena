import { createAdminClient } from '@/lib/supabase/admin'
import { getPlatformCredentials, verifyPaymentWebhook } from '@/lib/payos'
import { credentialsForStoredChannel } from '@/lib/payment-channel'
import { settlePayment } from '@/lib/payments'
import { settleSubscription } from '@/lib/subscriptions'
import { captureError } from '@/lib/monitoring'

export interface WebhookResponse {
  status: number
  body: Record<string, unknown>
}

/**
 * Xử lý webhook PayOS chung cho mọi kênh.
 *
 * Mỗi kênh PayOS (nền tảng, từng cụm sân) ký webhook bằng checksum key riêng, nên phải biết đơn thuộc kênh nào
 * TRƯỚC khi kiểm tra chữ ký. Làm như sau: đọc orderCode (chưa tin) → tra bảng để lấy kênh → kiểm tra chữ ký bằng
 * khóa của kênh đó. Dữ liệu chưa tin chỉ dùng để chọn khóa, mọi thay đổi chỉ xảy ra sau khi chữ ký hợp lệ.
 */
export async function handlePayosWebhook(body: unknown): Promise<WebhookResponse> {
  const orderCode = Number((body as { data?: { orderCode?: unknown } } | null)?.data?.orderCode)
  if (!Number.isSafeInteger(orderCode) || orderCode <= 0) {
    // Không có đơn nào để xử lý (vd. payload thử khi đăng ký URL): trả 200 để PayOS không coi webhook là hỏng
    return { status: 200, body: { success: true, message: 'Bỏ qua: không có orderCode' } }
  }

  const admin = createAdminClient()

  const { data: payment } = await admin
    .from('payments')
    .select('id, metadata')
    .eq('order_code', orderCode)
    .maybeSingle()

  let kind: 'booking' | 'subscription'
  let creds
  if (payment) {
    kind = 'booking'
    const meta = (payment.metadata ?? {}) as { channel?: string; club_id?: string }
    try {
      creds = await credentialsForStoredChannel(admin, meta.channel, meta.club_id)
    } catch (err) {
      captureError('payos.webhook', err, { orderCode, channel: meta.channel })
      return { status: 500, body: { error: 'Không đọc được cấu hình kênh thanh toán' } }
    }
  } else {
    const { data: sub } = await admin.from('subscription_payments').select('id').eq('order_code', orderCode).maybeSingle()
    if (!sub) {
      // Không biết đơn nào (vd. PayOS gửi payload thử khi chủ sân đăng ký URL): không có gì để thay đổi nên trả 200
      return { status: 200, body: { success: true, message: 'Bỏ qua: không có đơn tương ứng' } }
    }
    kind = 'subscription'
    creds = getPlatformCredentials()
  }

  if (!creds) {
    return { status: 401, body: { error: 'Không có khóa để xác thực chữ ký' } }
  }

  const verified = await verifyPaymentWebhook(body, creds)
  if (!verified || verified.orderCode !== orderCode) {
    return { status: 401, body: { error: 'Chữ ký không hợp lệ' } }
  }
  if (!verified.success) {
    return { status: 200, body: { success: true, message: 'Bỏ qua giao dịch không thành công' } }
  }

  const input = { orderCode, paidAmount: verified.amount, reference: verified.reference }
  const result = kind === 'booking' ? await settlePayment(input) : await settleSubscription(input)

  if (!result.ok) {
    return { status: result.status, body: { error: result.error } }
  }
  return { status: 200, body: { success: true, alreadyPaid: result.alreadyPaid ?? false } }
}
