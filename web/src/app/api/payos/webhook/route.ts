import { NextRequest, NextResponse } from 'next/server'
import { handlePayosWebhook } from '@/lib/payos-webhook'
import { captureMessage } from '@/lib/monitoring'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body không phải JSON' }, { status: 400 })
  }

  const { status, body: payload } = await handlePayosWebhook(body)
  // PayOS chỉ gọi lại khi nhận 5xx; mỗi lần 5xx là một khoản tiền có thể chưa được ghi nhận nên cần người biết ngay
  if (status >= 500) {
    captureMessage('payos.webhook', 'Webhook PayOS trả lỗi 5xx', { status, error: payload.error }, { alert: true })
  } else if (status === 401) {
    captureMessage('payos.webhook', 'Webhook PayOS sai chữ ký hoặc thiếu khóa', { status, error: payload.error }, { level: 'warning' })
  }
  return NextResponse.json(payload, { status })
}
