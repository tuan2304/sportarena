import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureMessage } from '@/lib/monitoring'

/**
 * Giới hạn tần suất theo cửa sổ cố định, đếm trong Postgres (hàm rate_limit_hit) thay vì trong bộ nhớ,
 * vì trên Vercel mỗi lần gọi có thể rơi vào một instance khác nhau nên bộ đếm trong RAM không đáng tin.
 *
 * Nếu hàm trong database chưa được áp hoặc gặp lỗi thì CHO QUA (fail-open) và ghi log: lỗi hạ tầng của lớp bảo vệ
 * này không được làm sập đăng nhập hay đặt sân.
 */
export interface RateRule {
  max: number
  windowSec: number
}

export const RATE_RULES = {
  loginByIp: { max: 30, windowSec: 300 },
  loginByEmail: { max: 8, windowSec: 300 },
  registerByIp: { max: 10, windowSec: 3600 },
  // Quên mật khẩu: mỗi lần gửi là một email thật, vừa tốn hạn mức gửi thư vừa dễ bị lợi dụng để spam hộp thư người khác
  forgotByIp: { max: 5, windowSec: 3600 },
  forgotByEmail: { max: 3, windowSec: 3600 },
  resetSessionByIp: { max: 20, windowSec: 600 },
  passwordUpdate: { max: 10, windowSec: 600 },
  booking: { max: 10, windowSec: 600 },
  chat: { max: 30, windowSec: 60 },
  ticket: { max: 5, windowSec: 3600 },
  ticketReply: { max: 20, windowSec: 600 },
  joinMatch: { max: 15, windowSec: 600 },
  createMatch: { max: 10, windowSec: 3600 },
  review: { max: 10, windowSec: 3600 },
  // Xóa tài khoản kèm nhập lại mật khẩu: chặn dò mật khẩu qua đường này; xuất dữ liệu gom nhiều bảng nên cũng hạn chế
  accountDelete: { max: 5, windowSec: 3600 },
  accountExport: { max: 5, windowSec: 3600 },
  waitlist: { max: 20, windowSec: 600 },
  recurring: { max: 10, windowSec: 3600 },
  // OTP điện thoại: mỗi tin nhắn là tiền thật và dễ bị lợi dụng để spam số người khác
  otpSendByIp: { max: 10, windowSec: 3600 },
  otpSendByPhone: { max: 3, windowSec: 600 },
  otpVerifyByIp: { max: 30, windowSec: 600 },
  otpVerifyByPhone: { max: 10, windowSec: 600 },
  zaloByIp: { max: 30, windowSec: 600 },
} satisfies Record<string, RateRule>

export type RateAction = keyof typeof RATE_RULES

/**
 * Địa chỉ IP của người gọi; không xác định được thì 'unknown'.
 *
 * Client tự đặt được x-forwarded-for, và mỗi proxy chỉ NỐI THÊM IP của bên gửi vào cuối. Vì vậy phần tử đầu tiên không
 * đáng tin (gửi `X-Forwarded-For: 1.1.1.1` là đổi được "IP" mỗi lần để né giới hạn). Ta lấy phần tử do proxy tin cậy
 * của mình ghi, đếm từ cuối: TRUSTED_PROXY_HOPS proxy (mặc định 1). Trên Vercel header chỉ có đúng một IP của người
 * gọi nên mặc định đúng; sau 2 lớp proxy (vd CDN rồi nginx) đặt TRUSTED_PROXY_HOPS=2.
 */
export function clientIp(
  h: { get(name: string): string | null },
  hops: number = Number(process.env.TRUSTED_PROXY_HOPS) || 1
): string {
  const parts = (h.get('x-forwarded-for') ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  const forwarded = parts[Math.max(0, parts.length - Math.max(1, Math.floor(hops)))]
  return forwarded || h.get('x-real-ip')?.trim() || 'unknown'
}

export function retryMessage(retryAfterSec: number): string {
  const s = Math.max(1, Math.ceil(retryAfterSec))
  const wait = s < 60 ? `${s} giây` : `${Math.ceil(s / 60)} phút`
  return `Bạn thao tác quá nhanh. Vui lòng thử lại sau ${wait}.`
}

/**
 * Ghi nhận một lần gọi và cho biết có vượt giới hạn không.
 * Trả null nếu được phép, hoặc thông báo lỗi để trả thẳng cho người dùng.
 */
export async function enforceRateLimit(action: RateAction, identity: string): Promise<string | null> {
  const rule = RATE_RULES[action]
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('rate_limit_hit', {
      p_key: `${action}:${identity}`.slice(0, 200),
      p_window_seconds: rule.windowSec,
      p_max: rule.max,
    })
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    if (row && row.allowed === false) return retryMessage(Number(row.retry_after) || rule.windowSec)
    return null
  } catch (err) {
    // Lớp chống spam/dò mật khẩu đang TẮT cho tới khi sửa (thường do chưa áp migration hoặc database lỗi): cần người biết
    captureMessage(
      'rate-limit.fail-open',
      `Bỏ qua kiểm tra giới hạn tần suất "${action}" do lỗi`,
      { action, error: err instanceof Error ? err.message : String(err) },
      { alert: true, level: 'warning' }
    )
    return null
  }
}

/** Dùng cho đăng nhập/đăng ký (chưa có user): giới hạn theo IP của người gọi. */
export async function enforceRateLimitByIp(action: RateAction): Promise<string | null> {
  return enforceRateLimit(action, clientIp(await headers()))
}
