import { addDaysToDateKey, getVnParts, vnDateKey, vnDateTime } from '@/lib/datetime'

/**
 * Phần thuần túy của lịch cố định hằng tuần ("thứ 3 hằng tuần 19h"): kiểm tra yêu cầu và tính các ngày diễn ra.
 * Phần ghi database nằm ở recurring-service.ts. Mọi giờ/ngày ở đây theo giờ Việt Nam.
 */
export const RECURRING_HORIZON_DAYS = 28
export const MAX_RECURRING_PER_USER = 3
export const MAX_RECURRING_START_DAYS_AHEAD = 60
export const MAX_RECURRING_SPAN_DAYS = 366
export const MIN_RECURRING_MINUTES = 60
export const MAX_RECURRING_MINUTES = 6 * 60

export interface RecurringInput {
  courtId: string
  /** 0 = Chủ nhật ... 6 = Thứ bảy */
  weekday: number
  /** "HH:MM" theo giờ VN */
  startTime: string
  /** "HH:MM" theo giờ VN (đến "24:00") */
  endTime: string
  /** yyyy-mm-dd; mặc định hôm nay */
  startsOn?: string
  /** yyyy-mm-dd; bỏ trống = không kết thúc */
  endsOn?: string | null
  note?: string
}

export interface RecurringRequest {
  courtId: string
  weekday: number
  startMinutes: number
  endMinutes: number
  startsOn: string
  endsOn: string | null
  note: string | null
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

/** "19:00" → 1140; "24:00" → 1440; sai dạng hoặc không nằm trên mốc 30 phút → null */
export function parseTimeOfDay(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::00)?$/.exec(value.trim())
  if (!m) return null
  const minutes = Number(m[1]) * 60 + Number(m[2])
  if (minutes > 24 * 60 || Number(m[2]) % 30 !== 0) return null
  return minutes
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function isValidDateKey(key: string): boolean {
  if (!DATE_KEY.test(key)) return false
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

/** Thứ trong tuần (0 = Chủ nhật) của một ngày yyyy-mm-dd */
export function weekdayOfDateKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export type ParsedRecurring = { ok: true; value: RecurringRequest } | { ok: false; error: string }

export function parseRecurringInput(input: RecurringInput, todayKey: string): ParsedRecurring {
  if (!input.courtId) return { ok: false, error: 'Vui lòng chọn sân' }
  if (!Number.isInteger(input.weekday) || input.weekday < 0 || input.weekday > 6) {
    return { ok: false, error: 'Thứ trong tuần không hợp lệ' }
  }

  const startMinutes = parseTimeOfDay(input.startTime ?? '')
  const endMinutes = parseTimeOfDay(input.endTime ?? '')
  if (startMinutes === null || endMinutes === null || startMinutes >= 24 * 60) {
    return { ok: false, error: 'Giờ chơi không hợp lệ (chọn theo mốc 30 phút)' }
  }
  if (endMinutes <= startMinutes) return { ok: false, error: 'Giờ kết thúc phải sau giờ bắt đầu' }
  if (endMinutes - startMinutes < MIN_RECURRING_MINUTES) return { ok: false, error: 'Mỗi buổi chơi tối thiểu 1 giờ' }
  if (endMinutes - startMinutes > MAX_RECURRING_MINUTES) return { ok: false, error: 'Mỗi buổi chơi tối đa 6 giờ' }

  const startsOn = input.startsOn || todayKey
  if (!isValidDateKey(startsOn)) return { ok: false, error: 'Ngày bắt đầu không hợp lệ' }
  if (startsOn < todayKey) return { ok: false, error: 'Ngày bắt đầu không được ở quá khứ' }
  if (startsOn > addDaysToDateKey(todayKey, MAX_RECURRING_START_DAYS_AHEAD)) {
    return { ok: false, error: `Chỉ nhận lịch cố định bắt đầu trong vòng ${MAX_RECURRING_START_DAYS_AHEAD} ngày tới` }
  }

  const endsOn = input.endsOn || null
  if (endsOn !== null) {
    if (!isValidDateKey(endsOn)) return { ok: false, error: 'Ngày kết thúc không hợp lệ' }
    if (endsOn < startsOn) return { ok: false, error: 'Ngày kết thúc phải sau ngày bắt đầu' }
    if (endsOn > addDaysToDateKey(startsOn, MAX_RECURRING_SPAN_DAYS)) {
      return { ok: false, error: 'Lịch cố định tối đa 1 năm. Hết hạn bạn có thể đăng ký lại.' }
    }
  }

  const note = input.note?.trim().slice(0, 500) || null
  return { ok: true, value: { courtId: input.courtId, weekday: input.weekday, startMinutes, endMinutes, startsOn, endsOn, note } }
}

/**
 * Các ngày (yyyy-mm-dd) của một lịch cố định rơi vào khoảng [fromKey, fromKey + horizonDays), nằm trong
 * [startsOn, endsOn] và đúng thứ `weekday`.
 */
export function occurrenceDateKeys(args: {
  weekday: number
  startsOn: string
  endsOn: string | null
  fromKey: string
  horizonDays?: number
}): string[] {
  const { weekday, startsOn, endsOn, fromKey, horizonDays = RECURRING_HORIZON_DAYS } = args
  const out: string[] = []
  for (let i = 0; i < horizonDays; i++) {
    const key = addDaysToDateKey(fromKey, i)
    if (key < startsOn) continue
    if (endsOn !== null && key > endsOn) break
    if (weekdayOfDateKey(key) === weekday) out.push(key)
  }
  return out
}

/** Thời điểm bắt đầu và kết thúc tuyệt đối của một buổi (kết thúc = bắt đầu + thời lượng). */
export function occurrenceWindow(dateKey: string, startMinutes: number, endMinutes: number): { start: Date; end: Date } {
  const start = vnDateTime(dateKey, Math.floor(startMinutes / 60), startMinutes % 60)
  return { start, end: new Date(start.getTime() + (endMinutes - startMinutes) * 60_000) }
}

/** Khung giờ nằm trong giờ mở cửa của cụm sân (đóng cửa 24:00 hợp lệ) */
export function fitsOpeningHours(startMinutes: number, endMinutes: number, openTime: string, closeTime: string): boolean {
  const toMin = (t: string, fallback: number) => {
    const [h, m] = (t ?? '').split(':').map(Number)
    return Number.isFinite(h) ? h * 60 + (m || 0) : fallback
  }
  return startMinutes >= toMin(openTime, 0) && endMinutes <= toMin(closeTime, 24 * 60)
}

/** "Thứ 3 hằng tuần, 19:00 - 20:00" — nhãn tiếng Việt cho thông báo; giao diện dùng bản dịch riêng. */
export function describeRecurring(weekday: number, startMinutes: number, endMinutes: number): string {
  const day = weekday === 0 ? 'Chủ nhật' : `Thứ ${weekday + 1}`
  return `${day} hằng tuần, ${minutesToTime(startMinutes)} - ${minutesToTime(endMinutes)}`
}

/** Hôm nay theo giờ VN, dùng làm mốc mặc định */
export function todayKey(now: number | Date = Date.now()): string {
  return vnDateKey(now)
}

/** Thứ trong tuần theo giờ VN của một thời điểm */
export function vnWeekday(date: Date): number {
  return getVnParts(date).dayOfWeek
}
