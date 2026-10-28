import { zaloConfig } from '@/lib/zalo'

/**
 * Các cách đăng nhập ngoài email + mật khẩu mà trang đăng nhập hiện nút.
 * Google, Apple và OTP điện thoại do Supabase Auth cung cấp nhưng bật/tắt trong Supabase Dashboard (web không đọc được
 * cấu hình đó), nên khai báo ở biến AUTH_PROVIDERS, ví dụ: AUTH_PROVIDERS=google,apple,phone. Chỉ khai báo sau khi đã bật
 * nhà cung cấp tương ứng ở Dashboard, nếu không nút sẽ báo lỗi khi bấm. Zalo tự bật khi có đủ ZALO_APP_ID và ZALO_APP_SECRET.
 */
export interface AuthProviders {
  google: boolean
  apple: boolean
  phone: boolean
  zalo: boolean
}

export function enabledAuthProviders(env: Record<string, string | undefined> = process.env): AuthProviders {
  const listed = new Set((env.AUTH_PROVIDERS ?? '').split(/[\s,;]+/).map((p) => p.trim().toLowerCase()).filter(Boolean))
  return {
    google: listed.has('google'),
    apple: listed.has('apple'),
    phone: listed.has('phone'),
    zalo: zaloConfig(env) !== null,
  }
}

export function hasAnyProvider(p: AuthProviders): boolean {
  return p.google || p.apple || p.phone || p.zalo
}

/** Mã lỗi trong ?error= của trang đăng nhập → khóa thông báo trong messages (auth.errors.*) */
export const LOGIN_ERROR_CODES = ['oauth', 'zalo', 'zalo_unavailable'] as const
export type LoginErrorCode = (typeof LOGIN_ERROR_CODES)[number]

export function parseLoginError(raw: string | string[] | undefined): LoginErrorCode | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  return (LOGIN_ERROR_CODES as readonly string[]).includes(value ?? '') ? (value as LoginErrorCode) : null
}
