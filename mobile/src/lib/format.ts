import { getVnParts } from '../shared/datetime'

/** 1250000 -> "1.250.000 đ". Tự định dạng để không phụ thuộc Intl của thiết bị. */
export function formatVnd(n: number | string | null | undefined): string {
  const value = Math.round(Number(n ?? 0))
  const grouped = String(Math.abs(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${value < 0 ? '-' : ''}${grouped} đ`
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "19:30" theo giờ Việt Nam, bất kể múi giờ của điện thoại. */
export function formatTime(iso: string): string {
  const { minutesOfDay } = getVnParts(new Date(iso))
  return `${pad(Math.floor(minutesOfDay / 60))}:${pad(minutesOfDay % 60)}`
}

/** "5/11/2026" theo giờ Việt Nam. */
export function formatDate(iso: string): string {
  const [y, m, d] = getVnParts(new Date(iso)).dateKey.split('-').map(Number)
  return `${d}/${m}/${y}`
}

const WEEKDAYS = {
  vi: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
}

/** Nhãn ngắn cho ô chọn ngày: "T5 · 5/11". */
export function dayChipLabel(dateKey: string, lang: 'vi' | 'en' = 'vi'): string {
  const [, m, d] = dateKey.split('-').map(Number)
  const dow = new Date(Date.UTC(Number(dateKey.slice(0, 4)), m - 1, d)).getUTCDay()
  return `${WEEKDAYS[lang][dow]} · ${d}/${m}`
}

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
}
