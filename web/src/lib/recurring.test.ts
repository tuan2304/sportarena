import { describe, expect, it } from 'vitest'
import {
  describeRecurring,
  fitsOpeningHours,
  isValidDateKey,
  occurrenceDateKeys,
  occurrenceWindow,
  parseRecurringInput,
  parseTimeOfDay,
  weekdayOfDateKey,
} from './recurring'

// 2026-11-10 là thứ Ba
const TODAY = '2026-11-10'
const valid = { courtId: 'c1', weekday: 2, startTime: '19:00', endTime: '20:00' }

describe('weekdayOfDateKey', () => {
  it('tính đúng thứ', () => {
    expect(weekdayOfDateKey('2026-11-10')).toBe(2)
    expect(weekdayOfDateKey('2026-11-15')).toBe(0)
    expect(weekdayOfDateKey('2026-11-14')).toBe(6)
  })
})

describe('parseTimeOfDay', () => {
  it.each([
    ['19:00', 1140],
    ['7:30', 450],
    ['19:00:00', 1140],
    ['24:00', 1440],
  ])('%s → %s', (input, expected) => expect(parseTimeOfDay(input)).toBe(expected))

  it.each(['19:15', '25:00', '24:30', 'abc', '', '19'])('từ chối %s', (input) => {
    expect(parseTimeOfDay(input)).toBeNull()
  })
})

describe('isValidDateKey', () => {
  it('nhận ngày thật, từ chối ngày không tồn tại', () => {
    expect(isValidDateKey('2026-02-28')).toBe(true)
    expect(isValidDateKey('2026-02-30')).toBe(false)
    expect(isValidDateKey('2026-13-01')).toBe(false)
    expect(isValidDateKey('10/11/2026')).toBe(false)
  })
})

describe('parseRecurringInput', () => {
  it('yêu cầu hợp lệ, ngày bắt đầu mặc định là hôm nay', () => {
    const r = parseRecurringInput(valid, TODAY)
    expect(r).toEqual({
      ok: true,
      value: { courtId: 'c1', weekday: 2, startMinutes: 1140, endMinutes: 1200, startsOn: TODAY, endsOn: null, note: null },
    })
  })

  it('từ chối thứ ngoài 0-6', () => {
    expect(parseRecurringInput({ ...valid, weekday: 7 }, TODAY)).toMatchObject({ ok: false })
    expect(parseRecurringInput({ ...valid, weekday: -1 }, TODAY)).toMatchObject({ ok: false })
    expect(parseRecurringInput({ ...valid, weekday: 1.5 }, TODAY)).toMatchObject({ ok: false })
  })

  it('giờ kết thúc phải sau giờ bắt đầu, mỗi buổi 1-6 giờ', () => {
    expect(parseRecurringInput({ ...valid, endTime: '19:00' }, TODAY)).toMatchObject({ ok: false })
    expect(parseRecurringInput({ ...valid, endTime: '19:30' }, TODAY)).toMatchObject({ ok: false, error: 'Mỗi buổi chơi tối thiểu 1 giờ' })
    expect(parseRecurringInput({ ...valid, startTime: '08:00', endTime: '15:00' }, TODAY)).toMatchObject({
      ok: false,
      error: 'Mỗi buổi chơi tối đa 6 giờ',
    })
    expect(parseRecurringInput({ ...valid, startTime: '22:00', endTime: '24:00' }, TODAY).ok).toBe(true)
  })

  it('ngày bắt đầu không ở quá khứ và không quá xa', () => {
    expect(parseRecurringInput({ ...valid, startsOn: '2026-11-09' }, TODAY)).toMatchObject({ ok: false })
    expect(parseRecurringInput({ ...valid, startsOn: '2027-03-01' }, TODAY)).toMatchObject({ ok: false })
    expect(parseRecurringInput({ ...valid, startsOn: '2026-12-01' }, TODAY).ok).toBe(true)
  })

  it('ngày kết thúc phải sau ngày bắt đầu và trong 1 năm', () => {
    expect(parseRecurringInput({ ...valid, endsOn: '2026-11-01' }, TODAY)).toMatchObject({ ok: false })
    expect(parseRecurringInput({ ...valid, endsOn: '2028-01-01' }, TODAY)).toMatchObject({ ok: false })
    expect(parseRecurringInput({ ...valid, endsOn: '2027-06-01' }, TODAY).ok).toBe(true)
  })

  it('ghi chú bị cắt ở 500 ký tự', () => {
    const r = parseRecurringInput({ ...valid, note: 'x'.repeat(900) }, TODAY)
    expect(r.ok && r.value.note?.length).toBe(500)
  })
})

describe('occurrenceDateKeys', () => {
  it('liệt kê đúng 4 buổi thứ Ba trong 28 ngày tới, kể cả hôm nay', () => {
    expect(occurrenceDateKeys({ weekday: 2, startsOn: TODAY, endsOn: null, fromKey: TODAY })).toEqual([
      '2026-11-10',
      '2026-11-17',
      '2026-11-24',
      '2026-12-01',
    ])
  })

  it('bỏ các ngày trước ngày bắt đầu', () => {
    expect(occurrenceDateKeys({ weekday: 2, startsOn: '2026-11-20', endsOn: null, fromKey: TODAY })).toEqual([
      '2026-11-24',
      '2026-12-01',
    ])
  })

  it('dừng sau ngày kết thúc', () => {
    expect(occurrenceDateKeys({ weekday: 2, startsOn: TODAY, endsOn: '2026-11-24', fromKey: TODAY })).toEqual([
      '2026-11-10',
      '2026-11-17',
      '2026-11-24',
    ])
  })

  it('không có buổi nào khi đã hết hạn', () => {
    expect(occurrenceDateKeys({ weekday: 2, startsOn: '2026-01-01', endsOn: '2026-11-01', fromKey: TODAY })).toEqual([])
  })

  it('vắt qua cuối tháng/năm vẫn đúng', () => {
    expect(occurrenceDateKeys({ weekday: 0, startsOn: '2026-12-01', endsOn: null, fromKey: '2026-12-20', horizonDays: 14 })).toEqual([
      '2026-12-20',
      '2026-12-27',
    ])
    expect(occurrenceDateKeys({ weekday: 5, startsOn: '2026-12-01', endsOn: null, fromKey: '2026-12-28', horizonDays: 8 })).toEqual([
      '2027-01-01',
    ])
  })
})

describe('occurrenceWindow', () => {
  it('19:00-20:30 giờ VN = 12:00-13:30 UTC', () => {
    const { start, end } = occurrenceWindow('2026-11-10', 19 * 60, 20 * 60 + 30)
    expect(start.toISOString()).toBe('2026-11-10T12:00:00.000Z')
    expect(end.toISOString()).toBe('2026-11-10T13:30:00.000Z')
  })

  it('buổi kết thúc 24:00 là 00:00 hôm sau theo giờ VN', () => {
    const { end } = occurrenceWindow('2026-11-10', 22 * 60, 24 * 60)
    expect(end.toISOString()).toBe('2026-11-10T17:00:00.000Z')
  })
})

describe('fitsOpeningHours', () => {
  it('nằm trong giờ mở cửa', () => {
    expect(fitsOpeningHours(19 * 60, 20 * 60, '06:00:00', '23:00:00')).toBe(true)
    expect(fitsOpeningHours(5 * 60, 7 * 60, '06:00:00', '23:00:00')).toBe(false)
    expect(fitsOpeningHours(22 * 60, 24 * 60, '06:00:00', '23:00:00')).toBe(false)
    expect(fitsOpeningHours(22 * 60, 24 * 60, '06:00:00', '24:00:00')).toBe(true)
  })
})

describe('describeRecurring', () => {
  it('nhãn thân thiện', () => {
    expect(describeRecurring(2, 1140, 1200)).toBe('Thứ 3 hằng tuần, 19:00 - 20:00')
    expect(describeRecurring(0, 450, 540)).toBe('Chủ nhật hằng tuần, 07:30 - 09:00')
  })
})
