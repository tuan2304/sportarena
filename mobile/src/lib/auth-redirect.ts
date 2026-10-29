/**
 * Đọc URL mà trình duyệt đăng nhập trả về app (sportarena://auth-callback...). Có ba dạng:
 *   - Google/Apple qua Supabase (luồng implicit): token nằm ở phần #fragment
 *   - Google/Apple qua Supabase (luồng PKCE): ?code=...
 *   - Zalo: ?ticket=... (vé mã hóa, xem web/src/lib/zalo-ticket.ts)
 * Hoặc ?error=... / #error=... khi người dùng từ chối hay có lỗi.
 */
export const AUTH_REDIRECT = 'sportarena://auth-callback'

export type AuthRedirect =
  | { kind: 'session'; accessToken: string; refreshToken: string }
  | { kind: 'code'; code: string }
  | { kind: 'ticket'; ticket: string }
  | { kind: 'error' }

function parts(url: string): URLSearchParams {
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1).split('#')[0] : ''
  const fragment = url.includes('#') ? url.slice(url.indexOf('#') + 1) : ''
  const merged = new URLSearchParams(query)
  for (const [k, v] of new URLSearchParams(fragment)) merged.set(k, v)
  return merged
}

export function parseAuthRedirect(url: string): AuthRedirect {
  if (!url.startsWith(AUTH_REDIRECT)) return { kind: 'error' }
  const p = parts(url)
  if (p.get('error') || p.get('error_description')) return { kind: 'error' }

  const ticket = p.get('ticket')
  if (ticket) return { kind: 'ticket', ticket }
  const accessToken = p.get('access_token')
  const refreshToken = p.get('refresh_token')
  if (accessToken && refreshToken) return { kind: 'session', accessToken, refreshToken }
  const code = p.get('code')
  if (code) return { kind: 'code', code }
  return { kind: 'error' }
}

/** Chuỗi hex ngẫu nhiên dài 2 × bytes ký tự (hex nằm trong bảng chữ cái base64url nên dùng được làm PKCE verifier 64 ký tự). */
export function hexFromBytes(bytes: ArrayLike<number>): string {
  return Array.from({ length: bytes.length }, (_, i) => bytes[i].toString(16).padStart(2, '0')).join('')
}

/** base64 chuẩn → base64url không đệm (khớp web/src/lib/zalo-ticket.ts) */
export function base64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Danh sách cách đăng nhập hiện nút, từ EXPO_PUBLIC_AUTH_PROVIDERS (vd. "google,apple,phone,zalo") */
export function parseProviders(raw: string | undefined): { google: boolean; apple: boolean; phone: boolean; zalo: boolean } {
  const set = new Set((raw ?? '').split(/[\s,;]+/).map((p) => p.trim().toLowerCase()).filter(Boolean))
  return { google: set.has('google'), apple: set.has('apple'), phone: set.has('phone'), zalo: set.has('zalo') }
}
