import { describe, expect, it } from 'vitest'
import { dayChipLabel, formatCountdown, formatDate, formatTime, formatVnd, weekdayShort } from './format'

describe('formatVnd', () => {
  it('nhóm hàng nghìn bằng dấu chấm', () => {
    expect(formatVnd(1250000)).toBe('1.250.000 đ')
    expect(formatVnd(999)).toBe('999 đ')
  })
  it('làm tròn, nhận chuỗi và coi null là 0', () => {
    expect(formatVnd('150000.4')).toBe('150.000 đ')
    expect(formatVnd(null)).toBe('0 đ')
    expect(formatVnd(undefined)).toBe('0 đ')
  })
  it('giữ dấu âm', () => {
    expect(formatVnd(-12000)).toBe('-12.000 đ')
  })
})

describe('giờ Việt Nam', () => {
  it('formatTime/formatDate theo UTC+7 dù máy ở múi giờ nào', () => {
    // 12:30 UTC = 19:30 giờ Việt Nam
    expect(formatTime('2026-11-05T12:30:00Z')).toBe('19:30')
    // 20:00 UTC ngày 4 đã sang ngày 5 ở Việt Nam
    expect(formatDate('2026-11-04T20:00:00Z')).toBe('5/11/2026')
  })
})

describe('nhãn ngày', () => {
  it('weekdayShort theo ngôn ngữ và quay vòng', () => {
    expect(weekdayShort(0)).toBe('CN')
    expect(weekdayShort(7)).toBe('CN')
    expect(weekdayShort(-1, 'en')).toBe('Sat')
  })
  it('dayChipLabel', () => {
    // 5/11/2026 là thứ Năm
    expect(dayChipLabel('2026-11-05')).toBe('T5 · 5/11')
    expect(dayChipLabel('2026-11-05', 'en')).toBe('Thu · 5/11')
  })
})

describe('formatCountdown', () => {
  it('mm:ss và không âm', () => {
    expect(formatCountdown(65)).toBe('01:05')
    expect(formatCountdown(-3)).toBe('00:00')
    expect(formatCountdown(599.9)).toBe('09:59')
  })
})
