/** Ngôn ngữ giao diện. Lưu trong cookie (không đổi URL) để mọi đường dẫn, liên kết thông báo và SEO giữ nguyên. */
export const LOCALES = ['vi', 'en'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'vi'
export const LOCALE_COOKIE = 'sa-lang'
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

/**
 * Chọn ngôn ngữ: cookie do người dùng tự chọn đi trước; chưa chọn thì theo Accept-Language của trình duyệt
 * (tiếng Anh nếu ngôn ngữ ưu tiên cao nhất là en*, còn lại tiếng Việt vì đây là thị trường chính).
 */
export function resolveLocale(cookie: string | undefined | null, acceptLanguage: string | undefined | null): Locale {
  if (isLocale(cookie)) return cookie

  const ranked = (acceptLanguage ?? '')
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';')
      const q = Number(params.find((p) => p.trim().startsWith('q='))?.split('=')[1] ?? 1)
      return { lang: tag.trim().toLowerCase().split('-')[0], q: Number.isFinite(q) ? q : 0 }
    })
    .filter((x) => x.lang && x.q > 0)
    .sort((a, b) => b.q - a.q)

  const first = ranked.find((x) => isLocale(x.lang))
  return first && isLocale(first.lang) ? first.lang : DEFAULT_LOCALE
}

/** Mã ngôn ngữ BCP 47 cho Intl / toLocaleString */
export function intlLocale(locale: Locale): string {
  return locale === 'en' ? 'en-GB' : 'vi-VN'
}
