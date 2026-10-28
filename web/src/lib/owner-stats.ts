import { addDaysToDateKey, getVnParts, vnDateTime } from '@/lib/datetime'

/**
 * Thống kê cho chủ sân: doanh thu, tỉ lệ lấp đầy, giờ cao điểm. Thuần túy (không đụng database) để kiểm thử mọi nhánh.
 * Mọi ngày/giờ tính theo giờ Việt Nam.
 *
 * Quy ước:
 * - "Đơn tính doanh thu": trạng thái đã xác nhận hoặc hoàn thành và không bị báo không đến. Doanh thu = tổng giá thuê
 *   (total_price) của các đơn đó, tính vào ngày chơi — không phải số tiền cọc đã thu.
 * - Đơn hủy do hệ thống (buổi lịch cố định bị bỏ qua vì trùng lịch) không tính là khách hủy.
 * - Giờ đã đặt tính theo từng phút thực tế của đơn, chia vào đúng khung giờ trong ngày.
 * - Giờ khả dụng = (giờ đóng - giờ mở) × số ngày × số sân đang hoạt động.
 */
export interface StatBooking {
  id: string
  courtId: string
  courtName: string
  clubName: string
  customer: string
  startTime: string
  endTime: string
  totalPrice: number
  depositAmount: number
  status: string
  cancelledBy: string | null
  noShow: boolean
  lateCancel: boolean
  refundAmount: number
  refundStatus: string
  recurring: boolean
}

export interface StatCourt {
  id: string
  name: string
  clubName: string
  openTime: string
  closeTime: string
  /** Sân tạm ngưng không tính giờ khả dụng (vẫn tính doanh thu của các đơn đã có); mặc định là đang hoạt động */
  active?: boolean
}

export interface DayStat {
  date: string
  revenue: number
  bookedHours: number
}

export interface CourtStat {
  courtId: string
  name: string
  clubName: string
  revenue: number
  bookings: number
  bookedHours: number
  availableHours: number
  occupancy: number
}

export interface PeakCell {
  weekday: number
  hour: number
  hours: number
}

export interface OwnerStats {
  revenue: number
  /** Số đơn tính doanh thu */
  bookings: number
  cancelled: number
  noShows: number
  /** Tỉ lệ khách hủy hoặc không đến trên tổng đơn phát sinh, 0..1 */
  cancelRate: number
  bookedHours: number
  availableHours: number
  /** 0..1 */
  occupancy: number
  averageBooking: number
  daily: DayStat[]
  byCourt: CourtStat[]
  /** heatmap[thứ 0=CN..6][giờ 0..23] = số giờ đã đặt cộng dồn trong khoảng */
  heatmap: number[][]
  hourTotals: number[]
  peaks: PeakCell[]
  /** Giờ trong ngày có tổng giờ đặt cao nhất, null nếu chưa có đơn */
  peakHour: number | null
}

const HOUR_MS = 3_600_000

export function countsAsRevenue(b: Pick<StatBooking, 'status' | 'noShow'>): boolean {
  return (b.status === 'confirmed' || b.status === 'completed') && !b.noShow
}

function minutesOf(time: string, fallback: number): number {
  const [h, m] = (time ?? '').split(':').map(Number)
  return Number.isFinite(h) ? h * 60 + (m || 0) : fallback
}

/** Các ngày yyyy-mm-dd từ fromKey đến toKey (gồm cả hai đầu) */
export function dateKeysBetween(fromKey: string, toKey: string): string[] {
  const out: string[] = []
  for (let key = fromKey; key <= toKey && out.length < 800; key = addDaysToDateKey(key, 1)) out.push(key)
  return out
}

/** Chia [start, end) theo từng giờ (theo giờ VN) và gọi `visit` với số giờ (phần lẻ) rơi vào mỗi khung. */
function eachHourSlice(start: number, end: number, visit: (dateKey: string, weekday: number, hour: number, hours: number) => void) {
  // UTC+7 là số giờ nguyên nên ranh giới giờ VN trùng ranh giới giờ UTC
  for (let cur = start; cur < end; ) {
    const next = Math.min(end, (Math.floor(cur / HOUR_MS) + 1) * HOUR_MS)
    const parts = getVnParts(new Date(cur))
    visit(parts.dateKey, parts.dayOfWeek, Math.floor(parts.minutesOfDay / 60), (next - cur) / HOUR_MS)
    cur = next
  }
}

export function computeOwnerStats(args: { bookings: StatBooking[]; courts: StatCourt[]; fromKey: string; toKey: string }): OwnerStats {
  const { bookings, courts, fromKey, toKey } = args
  const dates = dateKeysBetween(fromKey, toKey)
  const inRange = new Set(dates)

  const daily = new Map<string, DayStat>(dates.map((date) => [date, { date, revenue: 0, bookedHours: 0 }]))
  const courtStats = new Map<string, CourtStat>(
    courts.map((c) => {
      const open = minutesOf(c.openTime, 0)
      const close = minutesOf(c.closeTime, 24 * 60)
      const availableHours = c.active === false ? 0 : Math.max(0, (close - open) / 60) * dates.length
      return [c.id, { courtId: c.id, name: c.name, clubName: c.clubName, revenue: 0, bookings: 0, bookedHours: 0, availableHours, occupancy: 0 }]
    })
  )
  const heatmap = Array.from({ length: 7 }, () => Array<number>(24).fill(0))

  let revenue = 0
  let counted = 0
  let cancelled = 0
  let noShows = 0
  let bookedHours = 0

  for (const b of bookings) {
    const startMs = new Date(b.startTime).getTime()
    const endMs = new Date(b.endTime).getTime()
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue
    const startKey = getVnParts(new Date(startMs)).dateKey
    if (!inRange.has(startKey)) continue

    if (b.noShow) noShows++
    if (b.status === 'cancelled') {
      if (b.cancelledBy !== 'system') cancelled++
      continue
    }
    if (!countsAsRevenue(b)) continue

    counted++
    revenue += b.totalPrice
    const day = daily.get(startKey)
    if (day) day.revenue += b.totalPrice
    const court = courtStats.get(b.courtId)
    if (court) {
      court.revenue += b.totalPrice
      court.bookings++
    }

    eachHourSlice(startMs, endMs, (dateKey, weekday, hour, hours) => {
      if (!inRange.has(dateKey)) return
      bookedHours += hours
      heatmap[weekday][hour] += hours
      const d = daily.get(dateKey)
      if (d) d.bookedHours += hours
      if (court) court.bookedHours += hours
    })
  }

  const byCourt = [...courtStats.values()]
    .map((c) => ({ ...c, occupancy: c.availableHours > 0 ? Math.min(1, c.bookedHours / c.availableHours) : 0 }))
    .sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name))
  const availableHours = byCourt.reduce((sum, c) => sum + c.availableHours, 0)

  const hourTotals = Array.from({ length: 24 }, (_, h) => heatmap.reduce((sum, row) => sum + row[h], 0))
  const peakHourTotal = Math.max(...hourTotals)
  const peaks: PeakCell[] = heatmap
    .flatMap((row, weekday) => row.map((hours, hour) => ({ weekday, hour, hours })))
    .filter((c) => c.hours > 0)
    .sort((a, b) => b.hours - a.hours || a.weekday - b.weekday || a.hour - b.hour)
    .slice(0, 5)

  const round = (n: number) => Math.round(n * 100) / 100
  const incidents = counted + cancelled + noShows
  return {
    revenue,
    bookings: counted,
    cancelled,
    noShows,
    cancelRate: incidents > 0 ? (cancelled + noShows) / incidents : 0,
    bookedHours: round(bookedHours),
    availableHours: round(availableHours),
    occupancy: availableHours > 0 ? Math.min(1, bookedHours / availableHours) : 0,
    averageBooking: counted > 0 ? Math.round(revenue / counted) : 0,
    daily: [...daily.values()].map((d) => ({ ...d, bookedHours: round(d.bookedHours) })),
    byCourt: byCourt.map((c) => ({ ...c, bookedHours: round(c.bookedHours), availableHours: round(c.availableHours) })),
    heatmap: heatmap.map((row) => row.map(round)),
    hourTotals: hourTotals.map(round),
    peaks: peaks.map((p) => ({ ...p, hours: round(p.hours) })),
    peakHour: peakHourTotal > 0 ? hourTotals.indexOf(peakHourTotal) : null,
  }
}

/** Gộp chuỗi theo ngày thành theo tuần (bắt đầu từ thứ Hai) khi khoảng dài, để biểu đồ không quá dày. */
export function groupDailyByWeek(daily: DayStat[]): DayStat[] {
  const out = new Map<string, DayStat>()
  for (const d of daily) {
    const [y, m, day] = d.date.split('-').map(Number)
    const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay() // 0 = CN
    const monday = addDaysToDateKey(d.date, -((dow + 6) % 7))
    const bucket = out.get(monday) ?? { date: monday, revenue: 0, bookedHours: 0 }
    bucket.revenue += d.revenue
    bucket.bookedHours += d.bookedHours
    out.set(monday, bucket)
  }
  return [...out.values()].sort((a, b) => a.date.localeCompare(b.date))
}

// ---------------------------------------------------------------- Khoảng thời gian

export const RANGE_OPTIONS = [7, 30, 90, 365] as const
export type RangeDays = (typeof RANGE_OPTIONS)[number]

export function parseRangeDays(raw: string | string[] | undefined | null): RangeDays {
  const n = Number(Array.isArray(raw) ? raw[0] : raw)
  return (RANGE_OPTIONS as readonly number[]).includes(n) ? (n as RangeDays) : 30
}

/** Khoảng `days` ngày kết thúc ở `todayKey` (gồm hôm nay), và mốc thời gian tuyệt đối [from, to) để truy vấn. */
export function rangeFor(todayKey: string, days: number): { fromKey: string; toKey: string; from: Date; to: Date } {
  const fromKey = addDaysToDateKey(todayKey, -(days - 1))
  return { fromKey, toKey: todayKey, from: vnDateTime(fromKey, 0), to: vnDateTime(addDaysToDateKey(todayKey, 1), 0) }
}

// ---------------------------------------------------------------- CSV

const FORMULA_START = /^[=+\-@\t\r]/

/** Một ô CSV: bọc nháy khi cần, và chặn "CSV injection" (ô bắt đầu bằng = + - @ bị Excel hiểu là công thức). */
export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  let text = String(value)
  if (FORMULA_START.test(text)) text = `'${text}`
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export type CsvLang = 'vi' | 'en'

const HEADERS: Record<CsvLang, string[]> = {
  vi: ['Mã đơn', 'Ngày chơi', 'Bắt đầu', 'Kết thúc', 'Cụm sân', 'Sân', 'Khách hàng', 'Tổng tiền (VND)', 'Tiền cọc (VND)', 'Trạng thái', 'Không đến', 'Hủy muộn', 'Hoàn cọc (VND)', 'Lịch cố định'],
  en: ['Booking ID', 'Play date', 'Start', 'End', 'Venue', 'Court', 'Customer', 'Total (VND)', 'Deposit (VND)', 'Status', 'No-show', 'Late cancel', 'Refund (VND)', 'Recurring'],
}

const STATUS_LABELS: Record<CsvLang, Record<string, string>> = {
  vi: { pending: 'Chờ cọc', confirmed: 'Đã xác nhận', completed: 'Hoàn thành', cancelled: 'Đã hủy' },
  en: { pending: 'Awaiting deposit', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled' },
}

/** Tệp CSV chi tiết đơn đặt sân. Có BOM UTF-8 để Excel hiển thị đúng tiếng Việt; số tiền để dạng số thô cho dễ cộng. */
export function bookingsToCsv(bookings: StatBooking[], lang: CsvLang = 'vi'): string {
  const yes = lang === 'vi' ? 'Có' : 'Yes'
  const no = lang === 'vi' ? 'Không' : 'No'
  const rows = [...bookings]
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((b) => {
      const start = new Date(b.startTime)
      const end = new Date(b.endTime)
      const parts = getVnParts(start)
      const endParts = getVnParts(end)
      const hhmm = (p: { minutesOfDay: number }) =>
        `${String(Math.floor(p.minutesOfDay / 60)).padStart(2, '0')}:${String(p.minutesOfDay % 60).padStart(2, '0')}`
      return [
        b.id,
        parts.dateKey,
        hhmm(parts),
        hhmm(endParts),
        b.clubName,
        b.courtName,
        b.customer,
        b.totalPrice,
        b.depositAmount,
        STATUS_LABELS[lang][b.status] ?? b.status,
        b.noShow ? yes : no,
        b.lateCancel ? yes : no,
        b.refundAmount,
        b.recurring ? yes : no,
      ].map(csvCell)
    })
  const lines = [HEADERS[lang].map(csvCell), ...rows].map((r) => r.join(','))
  return '﻿' + lines.join('\r\n') + '\r\n'
}
