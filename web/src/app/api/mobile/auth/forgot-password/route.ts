import type { NextRequest } from 'next/server'
import { errorResponse, jsonResponse, readJsonBody } from '@/lib/mobile-auth'
import { parseForgotPasswordBody } from '@/lib/mobile-api'
import { enforceRateLimit, enforceRateLimitByIp } from '@/lib/rate-limit'
import { sendPasswordResetEmail } from '@/lib/password-reset-server'

/**
 * App mobile gửi thư đặt lại mật khẩu (chưa đăng nhập nên không có Bearer token). Liên kết trong thư mở trang
 * /reset-password của web ngay trên trình duyệt điện thoại. Luôn trả thành công dù email có tài khoản hay không;
 * giới hạn tần suất theo IP và theo email vì mỗi lần gọi là một email thật.
 */
export async function POST(request: NextRequest) {
  const raw = await readJsonBody(request)
  if (!raw.ok) return raw.response
  const parsed = parseForgotPasswordBody(raw.body)
  if (!parsed.ok) return errorResponse(request, parsed.error, 400)

  const limited = (await enforceRateLimitByIp('forgotByIp')) ?? (await enforceRateLimit('forgotByEmail', parsed.value.email))
  if (limited) return errorResponse(request, limited, 429)

  const sent = await sendPasswordResetEmail(parsed.value.email)
  if (!sent.ok) return errorResponse(request, sent.error, 503)
  return jsonResponse({ success: true })
}
