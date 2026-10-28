import { describe, expect, it } from 'vitest'
import {
  bookingsToCsv,
  computeOwnerStats,
  countsAsRevenue,
  csvCell,
  dateKeysBetween,
  groupDailyByWeek,
  parseRangeDays,
  rangeFor,
  type StatBooking,
  type StatCourt,
} from './owner-stats'

const court: StatCourt = { id: 'c1', name: 'Sân 1', clubName: 'CLB A', openTime: '06:00:00', closeTime: '22:00:00' }
const court2: StatCourt = { id: 'c2', name: 'Sân 2', clubName: 'CLB A', openTime: '06:00:00', closeTime: '22:00:00' }

// Giờ VN = UTC + 7. 2026-11-10 là thứ Ba.
const at = (dateKey: string, hh: number, mm = 0) => new Date(`${dateKey}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+07:00`).toISOString()

let n = 0
function booking(over: Partial<StatBooking> & { date?: string; from?: [number, number]; to?: [number, number] }): StatBooking {
  const date = over.date ?? '2026-11-10'
  const [fh, fm] = over.from ?? [19, 0]
  const [th, tm] = over.to ?? [20, 0]
  return {
    id: `b${++n}`,
    courtId: 'c1',
    courtName: 'Sân 1',
    clubName: 'CLB A',
    customer: 'Khách',
    startTime: at(date, fh, fm),
    endTime: at(date, th, tm),
    totalPrice: 100_000,
    depositAmount: 30_000,
    status: 'confirmed',
    cancelledBy: null,
    noShow: false,
    lateCancel: false,
    refundAmount: 0,
    refundStatus: 'none',
    recurring: false,
    ...over,
  }
}

const range = { fromKey: '2026-11-09', toKey: '2026-11-15' } // 7 ngày

describe('dateKeysBetween / rangeFor / parseRangeDays', () => {
  it('liệt kê đủ cả hai đầu và vắt qua cuối tháng', () => {
    expect(dateKeysBetween('2026-11-29', '2026-12-02')).toEqual(['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02'])
  })

  it('rangeFor gồm cả hôm nay và mốc [from, to) theo giờ VN', () => {
    const r = rangeFor('2026-11-10', 7)
    expect(r.fromKey).toBe('2026-11-04')
    expect(r.toKey).toBe('2026-11-10')
    expect(r.from.toISOString()).toBe('2026-11-03T17:00:00.000Z')
    expect(r.to.toISOString()).toBe('2026-11-10T17:00:00.000Z')
  })

  it('chỉ nhận các khoảng cho phép, mặc định 30 ngày', () => {
    expect(parseRangeDays('7')).toBe(7)
    expect(parseRangeDays('365')).toBe(365)
    expect(parseRangeDays('15')).toBe(30)
    expect(parseRangeDays(undefined)).toBe(30)
    expect(parseRangeDays(['90', '7'])).toBe(90)
  })
})

describe('computeOwnerStats: doanh thu và số đơn', () => {
  it('chỉ tính đơn đã xác nhận/hoàn thành và không bị báo không đến', () => {
    expect(countsAsRevenue({ status: 'confirmed', noShow: false })).toBe(true)
    expect(countsAsRevenue({ status: 'completed', noShow: false })).toBe(true)
    expect(countsAsRevenue({ status: 'pending', noShow: false })).toBe(false)
    expect(countsAsRevenue({ status: 'cancelled', noShow: false })).toBe(false)
    expect(countsAsRevenue({ status: 'confirmed', noShow: true })).toBe(false)
  })

  it('cộng tổng giá thuê, đếm đơn và tính giá trị trung bình', () => {
    const s = computeOwnerStats({
      courts: [court],
      ...range,
      bookings: [booking({ totalPrice: 100_000 }), booking({ totalPrice: 300_000, status: 'completed' }), booking({ status: 'pending', totalPrice: 999_999 })],
    })
    expect(s.revenue).toBe(400_000)
    expect(s.bookings).toBe(2)
    expect(s.averageBooking).toBe(200_000)
  })

  it('bỏ đơn nằm ngoài khoảng ngày', () => {
    const s = computeOwnerStats({ courts: [court], ...range, bookings: [booking({ date: '2026-11-08' }), booking({ date: '2026-11-16' }), booking({ date: '2026-11-15' })] })
    expect(s.bookings).toBe(1)
  })

  it('đơn lúc 23:30 giờ VN được tính vào ngày VN, không phải ngày UTC', () => {
    const s = computeOwnerStats({ courts: [court], fromKey: '2026-11-10', toKey: '2026-11-10', bookings: [booking({ date: '2026-11-10', from: [23, 0], to: [23, 59] })] })
    expect(s.bookings).toBe(1)
    expect(s.daily[0]).toMatchObject({ date: '2026-11-10', revenue: 100_000 })
  })

  it('doanh thu theo sân và sắp xếp từ cao xuống thấp', () => {
    const s = computeOwnerStats({
      courts: [court, court2],
      ...range,
      bookings: [booking({ courtId: 'c2', totalPrice: 500_000 }), booking({ courtId: 'c1', totalPrice: 100_000 })],
    })
    expect(s.byCourt.map((c) => [c.courtId, c.revenue])).toEqual([['c2', 500_000], ['c1', 100_000]])
  })

  it('không có đơn thì mọi chỉ số bằng 0 và không chia cho 0', () => {
    const s = computeOwnerStats({ courts: [], bookings: [], ...range })
    expect(s).toMatchObject({ revenue: 0, bookings: 0, cancelRate: 0, occupancy: 0, averageBooking: 0, peakHour: null })
    expect(s.peaks).toEqual([])
  })
})

describe('computeOwnerStats: hủy và không đến', () => {
  it('tỉ lệ hủy tính cả hủy và không đến trên tổng đơn phát sinh', () => {
    const s = computeOwnerStats({
      courts: [court],
      ...range,
      bookings: [
        booking({}),
        booking({}),
        booking({ status: 'cancelled', cancelledBy: 'player' }),
        booking({ noShow: true }),
      ],
    })
    expect(s.bookings).toBe(2)
    expect(s.cancelled).toBe(1)
    expect(s.noShows).toBe(1)
    expect(s.cancelRate).toBeCloseTo(2 / 4)
  })

  it('buổi lịch cố định bị hệ thống bỏ qua không tính là khách hủy', () => {
    const s = computeOwnerStats({
      courts: [court],
      ...range,
      bookings: [booking({}), booking({ status: 'cancelled', cancelledBy: 'system' })],
    })
    expect(s.cancelled).toBe(0)
    expect(s.cancelRate).toBe(0)
  })

  it('đơn đang chờ cọc không làm tăng số đơn hay tỉ lệ hủy', () => {
    const s = computeOwnerStats({ courts: [court], ...range, bookings: [booking({ status: 'pending' })] })
    expect(s.bookings).toBe(0)
    expect(s.cancelRate).toBe(0)
  })
})

describe('computeOwnerStats: lấp đầy và giờ cao điểm', () => {
  it('giờ khả dụng = (đóng - mở) × ngày × sân; lấp đầy = giờ đã đặt / giờ khả dụng', () => {
    // 16 giờ mở cửa × 7 ngày × 2 sân = 224 giờ
    const s = computeOwnerStats({ courts: [court, court2], ...range, bookings: [booking({ from: [18, 0], to: [20, 0] })] })
    expect(s.availableHours).toBe(224)
    expect(s.bookedHours).toBe(2)
    expect(s.occupancy).toBeCloseTo(2 / 224)
    expect(s.byCourt.find((c) => c.courtId === 'c1')?.occupancy).toBeCloseTo(2 / 112)
  })

  it('đơn lẻ giờ được chia đúng vào từng khung giờ (19:30-21:00 = 0.5h ở 19, 1h ở 20)', () => {
    const s = computeOwnerStats({ courts: [court], ...range, bookings: [booking({ from: [19, 30], to: [21, 0] })] })
    // 2026-11-10 là thứ Ba (2)
    expect(s.heatmap[2][19]).toBe(0.5)
    expect(s.heatmap[2][20]).toBe(1)
    expect(s.heatmap[2][21]).toBe(0)
    expect(s.bookedHours).toBe(1.5)
  })

  it('giờ cao điểm là giờ có tổng giờ đặt lớn nhất qua mọi ngày', () => {
    const s = computeOwnerStats({
      courts: [court],
      ...range,
      bookings: [
        booking({ date: '2026-11-10', from: [19, 0], to: [20, 0] }),
        booking({ date: '2026-11-11', from: [19, 0], to: [20, 0] }),
        booking({ date: '2026-11-12', from: [8, 0], to: [9, 0] }),
      ],
    })
    expect(s.peakHour).toBe(19)
    expect(s.hourTotals[19]).toBe(2)
    expect(s.peaks[0]).toMatchObject({ hour: 19, hours: 1 })
    expect(s.peaks).toHaveLength(3)
  })

  it('đơn xuyên nửa đêm chỉ tính phần thuộc ngày trong khoảng', () => {
    const b = booking({ date: '2026-11-15', from: [23, 0], to: [23, 59] })
    // Kết thúc lúc 01:00 sáng 16/11 (ngoài khoảng): chỉ 1 giờ ở ngày 15 được tính
    const crossing: StatBooking = { ...b, endTime: at('2026-11-16', 1, 0) }
    const s = computeOwnerStats({ courts: [court], ...range, bookings: [crossing] })
    expect(s.bookedHours).toBe(1)
    expect(s.bookings).toBe(1)
  })

  it('lấp đầy không vượt 100% kể cả dữ liệu đặt chồng', () => {
    const many = Array.from({ length: 30 }, () => booking({ from: [6, 0], to: [22, 0] }))
    const s = computeOwnerStats({ courts: [court], fromKey: '2026-11-10', toKey: '2026-11-10', bookings: many })
    expect(s.occupancy).toBe(1)
  })
})

describe('groupDailyByWeek', () => {
  it('gộp theo tuần bắt đầu từ thứ Hai', () => {
    const daily = dateKeysBetween('2026-11-08', '2026-11-16').map((date) => ({ date, revenue: 10, bookedHours: 1 }))
    const weeks = groupDailyByWeek(daily)
    // CN 08/11 thuộc tuần của T2 02/11; 09-15/11 một tuần; 16/11 mở tuần mới
    expect(weeks.map((w) => [w.date, w.revenue])).toEqual([['2026-11-02', 10], ['2026-11-09', 70], ['2026-11-16', 10]])
  })
})

describe('csvCell', () => {
  it('bọc nháy khi có dấu phẩy, nháy kép hoặc xuống dòng', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('nói "xin chào"')).toBe('"nói ""xin chào"""')
    expect(csvCell('dòng 1\ndòng 2')).toBe('"dòng 1\ndòng 2"')
  })

  it('chặn công thức Excel (CSV injection)', () => {
    for (const evil of ['=HYPERLINK("http://x")', '+1+1', '-2+3', '@SUM(A1)']) {
      expect(csvCell(evil).replace(/^"/, '')).toMatch(/^'/)
    }
  })

  it('số giữ nguyên, rỗng là chuỗi rỗng', () => {
    expect(csvCell(1500000)).toBe('1500000')
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
    expect(csvCell(Number.NaN)).toBe('')
  })
})

describe('bookingsToCsv', () => {
  it('có BOM, tiêu đề và mỗi đơn một dòng, sắp theo giờ chơi', () => {
    const csv = bookingsToCsv([
      booking({ id: 'late', date: '2026-11-11', customer: 'Bình' }),
      booking({ id: 'early', date: '2026-11-10', customer: '=cmd|calc', recurring: true, noShow: true }),
    ])
    expect(csv.startsWith('﻿')).toBe(true)
    const lines = csv.trim().split('\r\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('Mã đơn')
    expect(lines[1].startsWith('early,2026-11-10,19:00,20:00,CLB A,Sân 1,')).toBe(true)
    expect(lines[1]).toContain("'=cmd|calc")
    expect(lines[1]).toContain('100000,30000,Đã xác nhận,Có,Không,0,Có')
    expect(lines[2].startsWith('late,2026-11-11')).toBe(true)
  })

  it('xuất tiếng Anh', () => {
    const csv = bookingsToCsv([booking({ id: 'x' })], 'en')
    expect(csv).toContain('Booking ID')
    expect(csv).toContain('Confirmed')
    expect(csv).toContain(',No,No,0,No')
  })
})
