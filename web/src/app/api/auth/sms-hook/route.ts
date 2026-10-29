import { NextResponse, type NextRequest } from 'next/server'
import { parseHookPayload, sendOtpSms, smsProvider, verifyHook } from '@/lib/sms-hook'

/**
 * Send SMS hook của Supabase Auth (Authentication → Hooks → Send SMS → HTTPS). Chỉ nhận yêu cầu có chữ ký hợp lệ từ
 * Supabase (SEND_SMS_HOOK_SECRET). Lỗi trả theo định dạng Supabase mong đợi: { error: { http_code, message } }.
 */
export const dynamic = 'force-dynamic'

const fail = (status: number, message: string) =>
  NextResponse.json({ error: { http_code: status, message } }, { status })

export async function POST(request: NextRequest) {
  const secret = process.env.SEND_SMS_HOOK_SECRET
  if (!secret || !smsProvider()) return fail(503, 'SMS hook chưa được cấu hình')

  // Phải đọc thân dạng chuỗi gốc để kiểm tra chữ ký
  const raw = await request.text()
  const valid = verifyHook(
    secret,
    {
      id: request.headers.get('webhook-id'),
      timestamp: request.headers.get('webhook-timestamp'),
      signature: request.headers.get('webhook-signature'),
    },
    raw
  )
  if (!valid) return fail(401, 'Chữ ký không hợp lệ')

  let payload
  try {
    payload = parseHookPayload(JSON.parse(raw))
  } catch {
    payload = null
  }
  if (!payload) return fail(400, 'Dữ liệu không hợp lệ')

  try {
    if (!(await sendOtpSms(payload))) return fail(502, 'Không gửi được tin nhắn')
  } catch (err) {
    console.error('sms-hook lỗi:', err instanceof Error ? err.message : err)
    return fail(502, 'Không gửi được tin nhắn')
  }
  return NextResponse.json({})
}
