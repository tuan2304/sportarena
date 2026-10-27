import { describe, expect, it } from 'vitest'
import {
  hourRange,
  isDurationAvailable,
  isHourBooked,
  isHourPast,
  overlapsBusy,
  vnHourSpan,
  type BusySlot,
} from './booking-slots'
import { vnDateTime } from './datetime'

const DATE = '2026-10-23'
const COURT = 'court-1'

// Tạo đơn bằng giờ VN cho dễ đọc
const busy = (from: [number, number], to: [number, number], extra: Partial<BusySlot> = {}): BusySlot => ({
  court_id: COURT,
  status: 'confirmed',
  start_time: vnDateTime(DATE, from[0], from[1]).toISOString(),
  end_time: vnDateTime(DATE, to[0], to[1]).toISOString(),
  ...extra,
})

describe('hourRange', () => {
  it('từ giờ mở cửa đến trước giờ đóng cửa', () => {
    expect(hourRange('06:00:00', '09:00:00')).toEqual([6, 7, 8])
  })

  it('rơi về 6h-23h nếu dữ liệu giờ không đọc được', () => {
    const hours = hourRange('', '')
    expect(hours[0]).toBe(6)
    expect(hours.at(-1)).toBe(22)
  })
})

describe('isHourBooked', () => {
  it('ô giờ nằm trong đơn thì kín, ô ngay sau đơn thì trống', () => {
    const list = [busy([18, 0], [19, 0])]
    expect(isHourBooked(list, COURT, DATE, 18)).toBe(true)
    expect(isHourBooked(list, COURT, DATE, 17)).toBe(false)
    expect(isHourBooked(list, COURT, DATE, 19)).toBe(false)
  })

  it('đơn kết thúc 19:30 thì ô 19:00 vẫn kín (lỗi cũ chỉ so sánh theo giờ nguyên)', () => {
    const list = [busy([18, 0], [19, 30])]
    expect(isHourBooked(list, COURT, DATE, 19)).toBe(true)
    expect(isHourBooked(list, COURT, DATE, 20)).toBe(false)
  })

  it('bỏ qua đơn đã hủy và đơn của sân khác', () => {
    expect(isHourBooked([busy([18, 0], [19, 0], { status: 'cancelled' })], COURT, DATE, 18)).toBe(false)
    expect(isHourBooked([busy([18, 0], [19, 0], { court_id: 'court-2' })], COURT, DATE, 18)).toBe(false)
  })

  it('đơn của ngày khác không ảnh hưởng', () => {
    expect(isHourBooked([busy([18, 0], [19, 0])], COURT, '2026-10-24', 18)).toBe(false)
  })
})

describe('overlapsBusy', () => {
  it('hai khoảng sát nhau (kết thúc đúng lúc bắt đầu) không tính là chồng', () => {
    const list = [busy([18, 0], [19, 0])]
    expect(overlapsBusy(list, COURT, vnDateTime(DATE, 19), vnDateTime(DATE, 20))).toBe(false)
    expect(overlapsBusy(list, COURT, vnDateTime(DATE, 17), vnDateTime(DATE, 18))).toBe(false)
    expect(overlapsBusy(list, COURT, vnDateTime(DATE, 17), vnDateTime(DATE, 18, 1))).toBe(true)
  })
})

describe('isHourPast', () => {
  it('ô giờ đã bắt đầu thì coi là qua (kể cả đang diễn ra), ô chưa tới giờ thì chưa', () => {
    const now = vnDateTime(DATE, 10, 30).getTime()
    expect(isHourPast(DATE, 9, now)).toBe(true)
    expect(isHourPast(DATE, 10, now)).toBe(true)
    expect(isHourPast(DATE, 11, now)).toBe(false)
  })

  it('đúng 14:00 thì ô 14:00 bị gạch, 13:59 thì còn', () => {
    expect(isHourPast(DATE, 14, vnDateTime(DATE, 14, 0).getTime())).toBe(true)
    expect(isHourPast(DATE, 14, vnDateTime(DATE, 13, 59).getTime())).toBe(false)
  })
})

describe('isDurationAvailable', () => {
  const base = { courtId: COURT, dateKey: DATE, closeHour: 23 }

  it('không cho vượt giờ đóng cửa', () => {
    expect(isDurationAvailable({ ...base, busy: [], startHour: 21, duration: 2 })).toBe(true)
    expect(isDurationAvailable({ ...base, busy: [], startHour: 21, duration: 2.5 })).toBe(false)
  })

  it('không cho đè lên đơn kế tiếp', () => {
    const list = [busy([20, 0], [21, 0])]
    expect(isDurationAvailable({ ...base, busy: list, startHour: 18, duration: 2 })).toBe(true)
    expect(isDurationAvailable({ ...base, busy: list, startHour: 18, duration: 2.5 })).toBe(false)
  })
})

describe('vnHourSpan', () => {
  it('tính theo giờ VN dù máy chạy UTC', () => {
    // 18:00-20:00 VN = 11:00-13:00 UTC
    expect(vnHourSpan('2026-10-23T11:00:00Z', '2026-10-23T13:00:00Z')).toEqual({ startHour: 18, endHour: 20 })
  })

  it('đơn kết thúc 19:30 chiếm hết ô 19:00', () => {
    expect(vnHourSpan('2026-10-23T11:00:00Z', '2026-10-23T12:30:00Z')).toEqual({ startHour: 18, endHour: 20 })
  })

  it('kết thúc đúng 00:00 hôm sau tính là 24', () => {
    // 22:00 VN -> 00:00 VN hôm sau
    expect(vnHourSpan('2026-10-23T15:00:00Z', '2026-10-23T17:00:00Z')).toEqual({ startHour: 22, endHour: 24 })
  })
})

describe('khách 2 chọn 13:00 trong 3 tiếng nhưng khách 1 đã đặt trước từ 14:00', () => {
  const base = { courtId: COURT, dateKey: DATE, closeHour: 22 }

  it('khách 1 đặt 14:00-15:00: ô 13:00 chỉ đặt được 1 tiếng, 1,5/2/3 tiếng bị khóa', () => {
    const list = [busy([14, 0], [15, 0])]
    expect(isDurationAvailable({ ...base, busy: list, startHour: 13, duration: 1 })).toBe(true)
    for (const duration of [1.5, 2, 2.5, 3]) {
      expect(isDurationAvailable({ ...base, busy: list, startHour: 13, duration })).toBe(false)
    }
  })

  it('khách 1 đặt dài hơn (14:00-16:00): kết luận không đổi, và ô 14:00, 15:00 đều kín', () => {
    const list = [busy([14, 0], [16, 0])]
    expect(isDurationAvailable({ ...base, busy: list, startHour: 13, duration: 3 })).toBe(false)
    expect(isHourBooked(list, COURT, DATE, 14)).toBe(true)
    expect(isHourBooked(list, COURT, DATE, 15)).toBe(true)
    expect(isHourBooked(list, COURT, DATE, 13)).toBe(false)
    expect(isHourBooked(list, COURT, DATE, 16)).toBe(false)
  })

  it('muốn chơi đủ 3 tiếng thì phải dời sang giờ sau khi khách 1 xong (15:00 trở đi)', () => {
    const list = [busy([14, 0], [15, 0])]
    expect(isDurationAvailable({ ...base, busy: list, startHour: 15, duration: 3 })).toBe(true)
    // Hoặc bắt đầu sớm hơn để kết thúc đúng lúc khách 1 bắt đầu: 11:00-14:00 (sát nhau không tính là chồng)
    expect(isDurationAvailable({ ...base, busy: list, startHour: 11, duration: 3 })).toBe(true)
    expect(isDurationAvailable({ ...base, busy: list, startHour: 12, duration: 3 })).toBe(false)
  })

  it('đơn của khách 1 đang giữ chỗ chờ cọc (pending) cũng chặn khách 2; đơn đã hủy thì không', () => {
    expect(isDurationAvailable({ ...base, busy: [busy([14, 0], [15, 0], { status: 'pending' })], startHour: 13, duration: 3 })).toBe(false)
    expect(isDurationAvailable({ ...base, busy: [busy([14, 0], [15, 0], { status: 'cancelled' })], startHour: 13, duration: 3 })).toBe(true)
  })

  it('khách 1 ở sân khác thì không ảnh hưởng', () => {
    const list = [busy([14, 0], [15, 0], { court_id: 'court-2' })]
    expect(isDurationAvailable({ ...base, busy: list, startHour: 13, duration: 3 })).toBe(true)
  })
})
