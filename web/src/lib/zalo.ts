import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { resolveAppUrl } from '@/lib/app-url'

/**
 * Đăng nhập bằng Zalo. Zalo không phải nhà cung cấp có sẵn của Supabase Auth nên web tự làm luồng OAuth 2.0 + PKCE:
 *   /api/auth/zalo/start    → chuyển người dùng sang trang cấp quyền của Zalo
 *   /api/auth/zalo/callback → đổi code lấy access token, đọc hồ sơ Zalo, nối/tạo tài khoản rồi mở phiên Supabase
 * File này chỉ chứa phần thuần túy (dựng URL, PKCE, kiểm tra tham số) để kiểm thử được.
 */
export const ZALO_AUTH_URL = 'https://oauth.zaloapp.com/v4/permission'
export const ZALO_TOKEN_URL = 'https://oauth.zaloapp.com/v4/access_token'
export const ZALO_PROFILE_URL = 'https://graph.zalo.me/v2.0/me?fields=id,name,picture'
export const ZALO_STATE_COOKIE = 'sa-zalo-oauth'
export const ZALO_STATE_MAX_AGE = 10 * 60

export interface ZaloConfig {
  appId: string
  appSecret: string
}

export function zaloConfig(env: Record<string, string | undefined> = process.env): ZaloConfig | null {
  const appId = env.ZALO_APP_ID?.trim()
  const appSecret = env.ZALO_APP_SECRET?.trim()
  return appId && appSecret ? { appId, appSecret } : null
}

export function zaloCallbackUrl(env: Record<string, string | undefined> = process.env): string {
  return `${resolveAppUrl(env)}/api/auth/zalo/callback`
}

const base64url = (buf: Buffer) => buf.toString('base64url')

/** Cặp PKCE: verifier ngẫu nhiên (43 ký tự) và challenge = base64url(sha256(verifier)) */
export function createPkce(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32))
  return { verifier, challenge: pkceChallenge(verifier) }
}

export function pkceChallenge(verifier: string): string {
  return base64url(createHash('sha256').update(verifier).digest())
}

export function createState(): string {
  return base64url(randomBytes(24))
}

export function buildZaloAuthUrl(args: { appId: string; redirectUri: string; challenge: string; state: string }): string {
  const url = new URL(ZALO_AUTH_URL)
  url.searchParams.set('app_id', args.appId)
  url.searchParams.set('redirect_uri', args.redirectUri)
  url.searchParams.set('code_challenge', args.challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', args.state)
  return url.toString()
}

/** So sánh hai chuỗi không lộ độ dài phần khớp (state do kẻ tấn công điều khiển) */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export interface ZaloStateCookie {
  state: string
  verifier: string
  next: string
}

export function encodeStateCookie(value: ZaloStateCookie): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

export function decodeStateCookie(raw: string | undefined): ZaloStateCookie | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf-8')) as Partial<ZaloStateCookie>
    if (typeof parsed.state === 'string' && typeof parsed.verifier === 'string' && typeof parsed.next === 'string') {
      return { state: parsed.state, verifier: parsed.verifier, next: parsed.next }
    }
  } catch {
    // cookie hỏng → coi như không có
  }
  return null
}

export interface ZaloProfile {
  id: string
  name: string
  avatarUrl: string | null
}

/** Hồ sơ Zalo → dạng gọn; null nếu thiếu id hợp lệ (id Zalo là chuỗi số) */
export function parseZaloProfile(body: unknown): ZaloProfile | null {
  const b = body as { id?: unknown; name?: unknown; picture?: { data?: { url?: unknown } } } | null
  const id = typeof b?.id === 'string' || typeof b?.id === 'number' ? String(b.id) : ''
  if (!/^[0-9]{1,40}$/.test(id)) return null
  const name = typeof b?.name === 'string' ? b.name.trim().slice(0, 100) : ''
  const picture = b?.picture?.data?.url
  return { id, name, avatarUrl: typeof picture === 'string' && picture.startsWith('https://') ? picture : null }
}

/**
 * Email giả định danh duy nhất cho tài khoản Zalo (Supabase Auth cần email để mở phiên bằng magic link).
 * Miền mặc định lấy từ địa chỉ web; đặt ZALO_EMAIL_DOMAIN nếu Supabase từ chối miền đó.
 */
export function zaloEmail(zaloId: string, env: Record<string, string | undefined> = process.env): string {
  const domain = env.ZALO_EMAIL_DOMAIN?.trim() || new URL(resolveAppUrl(env)).hostname
  return `zalo-${zaloId}@${domain}`
}

/** Đường dẫn quay lại sau đăng nhập: chỉ nhận đường dẫn nội bộ ("/matches"), không nhận "//evil.com" hay URL đầy đủ. */
export function safeNextPath(next: string | null | undefined, fallback = '/'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback
  if (/[\r\n]/.test(next)) return fallback
  return next
}

/** Trang đích mặc định theo vai trò sau khi đăng nhập */
export function homeForRole(role: string | null | undefined): string {
  if (role === 'admin') return '/admin'
  if (role === 'owner') return '/owner/dashboard'
  return '/'
}
