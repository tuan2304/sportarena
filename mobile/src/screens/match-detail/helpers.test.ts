import { describe, expect, it } from 'vitest'
import { formatMatchWindow, knownSkill, perPersonCost } from './helpers'

describe('formatMatchWindow', () => {
  it('ghép giờ bắt đầu - kết thúc và ngày', () => {
    // Máy kiểm thử chạy ở UTC (xem vitest.config.mts), màn hình hiển thị theo giờ thiết bị
    expect(formatMatchWindow(new Date('2026-11-05T07:05:00Z'), new Date('2026-11-05T09:00:00Z'))).toBe('07:05 - 09:00 (5/11/2026)')
  })
  it('không có giờ bắt đầu thì null', () => {
    expect(formatMatchWindow(null, null)).toBeNull()
  })
})

describe('perPersonCost', () => {
  it('miễn phí khi chủ kèo chịu hết hoặc chưa có giá', () => {
    expect(perPersonCost('host_covers', 50000)).toEqual({ free: true })
    expect(perPersonCost('split', null)).toEqual({ free: true })
    expect(perPersonCost('split', 0)).toEqual({ free: true })
  })
  it('chia đều thì trả giá mỗi người', () => {
    const cost = perPersonCost('split', '50000')
    expect(cost.free).toBe(false)
    if (!cost.free) expect(Number(cost.price.replace(/\D/g, ''))).toBe(50000)
  })
})

describe('knownSkill', () => {
  it('chỉ nhận bốn trình độ đã biết', () => {
    expect(knownSkill('advanced')).toBe('advanced')
    expect(knownSkill('expert')).toBeNull()
    expect(knownSkill(null)).toBeNull()
  })
})
