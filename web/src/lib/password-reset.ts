/**
 * Phần thuần túy của luồng quên mật khẩu (không phụ thuộc Supabase để trình duyệt cũng dùng được và dễ kiểm thử).
 *
 * Luồng: người dùng nhập email → Supabase gửi thư có liên kết → liên kết đưa về /reset-password với phiên khôi phục nằm trong
 * phần sau dấu # của URL (flow "implicit", không cần cookie của đúng trình duyệt đã yêu cầu nên mở thư trên máy khác vẫn được)
 * → trang gửi token cho server dựng phiên bằng cookie → người dùng đặt mật khẩu mới.
 */
export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 72 // bcrypt chỉ dùng 72 byte đầu, dài hơn là vô nghĩa

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Email đã chuẩn hóa (cắt khoảng trắng, chữ thường), hoặc null nếu không hợp lệ. */
export function parseResetEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const email = raw.trim().toLowerCase()
  return email.length <= 254 && EMAIL.test(email) ? email : null
}

/** Lỗi (tiếng Việt gốc) nếu mật khẩu mới không dùng được, null nếu được. */
export function validateNewPassword(password: unknown, confirm: unknown): string | null {
  if (typeof password !== 'string' || password.length === 0) return 'Vui lòng nhập mật khẩu mới'
  if (password.length < MIN_PASSWORD_LENGTH) return 'Mật khẩu phải có ít nhất 8 ký tự'
  if (password.length > MAX_PASSWORD_LENGTH) return `Mật khẩu tối đa ${MAX_PASSWORD_LENGTH} ký tự`
  if (password !== confirm) return 'Mật khẩu nhập lại không khớp'
  return null
}

const JWT = /^[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]*$/
const REFRESH_TOKEN = /^[A-Za-z0-9._-]{4,512}$/

/** Token có hình dạng hợp lý không (chỉ để chặn rác sớm; Supabase mới là nơi xác thực thật). */
export function isPlausibleRecoveryTokens(accessToken: unknown, refreshToken: unknown): boolean {
  return (
    typeof accessToken === 'string' &&
    typeof refreshToken === 'string' &&
    accessToken.length <= 4096 &&
    JWT.test(accessToken) &&
    REFRESH_TOKEN.test(refreshToken)
  )
}

export type RecoveryHash =
  | { kind: 'session'; accessToken: string; refreshToken: string }
  | { kind: 'error' }
  | { kind: 'none' }

/**
 * Đọc phần sau dấu # của URL mà Supabase chuyển về. Có access_token + refresh_token và type=recovery thì là phiên khôi phục;
 * có error (liên kết hết hạn, đã dùng) thì báo lỗi; còn lại là không có gì (vd. tải lại trang sau khi đã xóa phần #).
 */
export function parseRecoveryHash(hash: string): RecoveryHash {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  if (params.has('error') || params.has('error_code') || params.has('error_description')) return { kind: 'error' }

  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  if (params.get('type') === 'recovery' && accessToken && refreshToken) {
    return isPlausibleRecoveryTokens(accessToken, refreshToken) ? { kind: 'session', accessToken, refreshToken } : { kind: 'error' }
  }
  return { kind: 'none' }
}

/** Liên kết trong thư chỉ có hiệu lực khoảng 1 giờ; phiên tạo từ liên kết cũng chỉ được dùng để đổi mật khẩu trong chừng đó. */
export const RECOVERY_WINDOW_SEC = 3600

/**
 * Phiên hiện tại có vừa được tạo từ liên kết trong thư (đã chứng minh sở hữu email) không, theo claim `amr` của JWT.
 * GoTrue ghi phương thức là "otp" cho phiên từ liên kết khôi phục (một số phiên bản ghi "recovery"); đăng nhập bằng mật khẩu
 * là "password". Phải còn mới (trong RECOVERY_WINDOW_SEC) để một phiên cũ còn sống không đổi được mật khẩu mà không biết mật khẩu cũ.
 * Ứng dụng không dùng magic link nên "otp" ở đây chỉ đến từ liên kết khôi phục (hoặc xác nhận email), đều đã chứng minh sở hữu email.
 */
export function isRecoveryClaims(claims: { amr?: unknown } | null | undefined, nowSec = Date.now() / 1000): boolean {
  const amr = claims?.amr
  if (!Array.isArray(amr)) return false
  return amr.some((entry) => {
    if (typeof entry !== 'object' || entry === null) return false
    const { method, timestamp } = entry as { method?: unknown; timestamp?: unknown }
    if (method !== 'recovery' && method !== 'otp') return false
    return typeof timestamp === 'number' && timestamp <= nowSec + 60 && nowSec - timestamp <= RECOVERY_WINDOW_SEC
  })
}
