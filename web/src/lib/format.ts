import { VN_TIMEZONE } from '@/lib/datetime'
import { intlLocale, type Locale } from '@/i18n/config'

// Tất cả hiển thị giờ/ngày đều ép múi giờ Việt Nam. Trước đây các trang server dùng múi giờ của máy chủ
// (UTC trên Vercel) nên giờ hiện lệch 7 tiếng so với người dùng.

type DateInput = Date | string | number

const toDate = (d: DateInput) => (d instanceof Date ? d : new Date(d))

/** 1500000 → "1.500.000" */
export function formatNumber(n: number | string | null | undefined): string {
  return Number(n ?? 0).toLocaleString('vi-VN')
}

/** 1500000 → "1.500.000 đ" */
export function formatVnd(n: number | string | null | undefined): string {
  return `${formatNumber(n)} đ`
}

/** "18:30" */
export function formatTime(d: DateInput): string {
  return toDate(d).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: VN_TIMEZONE })
}

/** "18:00 - 20:00" */
export function formatTimeRange(start: DateInput, end: DateInput): string {
  return `${formatTime(start)} - ${formatTime(end)}`
}

/** "23/10/2026" */
export function formatDate(d: DateInput): string {
  return toDate(d).toLocaleDateString('vi-VN', { timeZone: VN_TIMEZONE })
}

/** "T6, 23/10" (hoặc "Fri, 23/10" khi lang = 'en') */
export function formatShortDate(d: DateInput, lang: Locale = 'vi'): string {
  return toDate(d).toLocaleDateString(intlLocale(lang), {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    timeZone: VN_TIMEZONE,
  })
}

/** "Thứ Sáu, 23 tháng 10, 2026" (hoặc "Friday 23 October 2026" khi lang = 'en') */
export function formatLongDate(d: DateInput, lang: Locale = 'vi'): string {
  return toDate(d).toLocaleDateString(intlLocale(lang), {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: VN_TIMEZONE,
  })
}
