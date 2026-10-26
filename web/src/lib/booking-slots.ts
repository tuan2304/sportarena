import { getVnParts, vnDateTime } from './datetime'

export interface BusySlot {
  court_id: string
  start_time: string
  end_time: string
  status: string
}

/** Danh sách giờ bắt đầu hợp lệ từ giờ mở cửa đến trước giờ đóng cửa. */
export function hourRange(openTime: string, closeTime: string): number[] {
  const open = parseInt(openTime.slice(0, 2), 10) || 6
  const close = parseInt(closeTime.slice(0, 2), 10) || 23
  const hours: number[] = []
  for (let h = open; h < close; h++) hours.push(h)
  return hours
}

/** Khoảng [start, end) có chạm vào đơn nào còn hiệu lực của sân không (so theo thời điểm tuyệt đối). */
export function overlapsBusy(busy: BusySlot[], courtId: string, start: Date, end: Date): boolean {
  return busy.some(
    (b) =>
      b.court_id === courtId &&
      b.status !== 'cancelled' &&
      new Date(b.start_time) < end &&
      new Date(b.end_time) > start
  )
}

export function isHourBooked(busy: BusySlot[], courtId: string, dateKey: string, hour: number): boolean {
  return overlapsBusy(busy, courtId, vnDateTime(dateKey, hour), vnDateTime(dateKey, hour + 1))
}

/** Giờ bắt đầu đã trôi qua: qua 14:00 thì ô 14:00 bị gạch dù chưa ai đặt (chỉ áp dụng khi chọn hôm nay). */
export function isHourPast(dateKey: string, hour: number, nowMs: number): boolean {
  return vnDateTime(dateKey, hour).getTime() <= nowMs
}

export const DURATION_OPTIONS = [1, 1.5, 2, 2.5, 3] as const

/** Một thời lượng có thực hiện được không: không vượt giờ đóng cửa và không đè lên đơn khác. */
export function isDurationAvailable(args: {
  busy: BusySlot[]
  courtId: string
  dateKey: string
  startHour: number
  duration: number
  closeHour: number
}): boolean {
  const { busy, courtId, dateKey, startHour, duration, closeHour } = args
  if (startHour + duration > closeHour) return false
  const start = vnDateTime(dateKey, startHour)
  const end = new Date(start.getTime() + duration * 60 * 60 * 1000)
  return !overlapsBusy(busy, courtId, start, end)
}

/**
 * Các ô giờ (giờ VN) mà một đơn chiếm: từ `startHour` đến TRƯỚC `endHour`.
 * Đơn kết thúc 19:30 chiếm đến hết ô 19:00 (endHour = 20); kết thúc đúng 00:00 hôm sau tính là 24.
 */
export function vnHourSpan(startISO: string, endISO: string): { startHour: number; endHour: number } {
  const start = getVnParts(new Date(startISO))
  const end = getVnParts(new Date(endISO))
  const startHour = Math.floor(start.minutesOfDay / 60)
  const sameDay = start.dateKey === end.dateKey
  const endMinutes = sameDay ? end.minutesOfDay : 24 * 60
  return { startHour, endHour: Math.ceil(endMinutes / 60) }
}
