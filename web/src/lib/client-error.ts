/**
 * Báo cáo lỗi từ trình duyệt và app mobile. Endpoint này không cần đăng nhập (lỗi có thể xảy ra ngay ở màn hình đăng nhập)
 * nên mọi trường đều bị giới hạn kích thước và làm sạch trước khi vào hệ thống giám sát.
 */
export const CLIENT_ERROR_SOURCES = ['web', 'mobile'] as const
export type ClientErrorSource = (typeof CLIENT_ERROR_SOURCES)[number]

export interface ClientErrorReport {
  source: ClientErrorSource
  message: string
  stack?: string
  path?: string
  digest?: string
  appVersion?: string
}

const MAX_MESSAGE = 300
const MAX_STACK = 2000
const MAX_SHORT = 100

const clip = (v: unknown, max: number): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined

/** Bỏ query và fragment của đường dẫn (có thể mang token đặt lại mật khẩu) và chỉ giữ phần đường dẫn. */
export function sanitizePath(value: unknown): string | undefined {
  const raw = clip(value, 300)
  if (!raw) return undefined
  const path = raw.split(/[?#]/)[0]
  return path.startsWith('/') ? path : undefined
}

/** Che các chuỗi trông như email hoặc token dài trong thông báo lỗi, để dữ liệu cá nhân không đi vào Sentry. */
export function scrubText(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/\b(?:eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{5,}|[A-Za-z0-9_-]{32,})\b/g, '[token]')
}

export function parseClientError(body: unknown): ClientErrorReport | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null
  const b = body as Record<string, unknown>
  if (!(CLIENT_ERROR_SOURCES as readonly unknown[]).includes(b.source)) return null
  const message = clip(b.message, MAX_MESSAGE)
  if (!message) return null
  const stack = clip(b.stack, MAX_STACK)
  return {
    source: b.source as ClientErrorSource,
    message: scrubText(message),
    ...(stack ? { stack: scrubText(stack) } : {}),
    path: sanitizePath(b.path),
    digest: clip(b.digest, MAX_SHORT),
    appVersion: clip(b.appVersion, 32),
  }
}
