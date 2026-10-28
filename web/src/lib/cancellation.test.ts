import { describe, expect, it } from 'vitest'
import {
  clampFreeCancelHours,
  decideCancellation,
  describeOutcome,
  describePolicy,
  formatHours,
  isLateCancel,
  parseFreeCancelHours,
  refundStatusLabel,
  type CancelInput,
} from './cancellation'

const now = new Date('2026-11-01T08:00:00Z')
const hoursFromNow = (h: number) => new Date(now.getTime() + h * 3_600_000)
const money = (n: number) => `${n}đ`

const base: CancelInput = { status: 'confirmed', start: hoursFromNow(48), now, paidAmount: 30000, freeCancelHours: 24, by: 'player' }

describe('decideCancellation: người chơi hủy', () => {
  it('trước hạn miễn phí thì được hoàn đủ', () => {
    expect(decideCancellation(base)).toMatchObject({ allowed: true, refundAmount: 30000, refundStatus: 'pending', forfeited: false })
  })

  it('đúng mốc hạn (24 giờ) vẫn được hoàn', () => {
    expect(decideCancellation({ ...base, start: hoursFromNow(24) })).toMatchObject({ refundAmount: 30000, forfeited: false })
  })

  it('hủy muộn hơn hạn thì mất cọc', () => {
    expect(decideCancellation({ ...base, start: hoursFromNow(23.9) })).toMatchObject({
      allowed: true, refundAmount: 0, refundStatus: 'none', forfeited: true,
    })
  })

  it('chính sách 0 giờ: hủy lúc nào trước giờ chơi cũng được hoàn', () => {
    expect(decideCancellation({ ...base, freeCancelHours: 0, start: hoursFromNow(0.1) })).toMatchObject({ refundAmount: 30000 })
  })

  it('đã đến hoặc quá giờ chơi thì không tự hủy được', () => {
    expect(decideCancellation({ ...base, start: hoursFromNow(0) }).allowed).toBe(false)
    expect(decideCancellation({ ...base, start: hoursFromNow(-2) }).allowed).toBe(false)
  })

  it('đơn chưa cọc hủy được bất cứ lúc nào và không có gì để hoàn hay mất', () => {
    expect(decideCancellation({ ...base, status: 'pending', paidAmount: 0, start: hoursFromNow(1) })).toMatchObject({
      allowed: true, refundAmount: 0, refundStatus: 'none', forfeited: false,
    })
  })

  it('đơn xác nhận nhưng không có khoản thật nào (giả lập/tiền mặt) thì không hoàn không phạt', () => {
    expect(decideCancellation({ ...base, paidAmount: 0, start: hoursFromNow(1) })).toMatchObject({ refundStatus: 'none', forfeited: false })
  })

  it('đơn đã hủy hoặc hoàn thành không hủy lại được', () => {
    for (const status of ['cancelled', 'completed']) {
      expect(decideCancellation({ ...base, status }).allowed).toBe(false)
    }
  })
})

describe('decideCancellation: chủ sân hủy', () => {
  it('luôn hoàn đủ, kể cả sát giờ', () => {
    expect(decideCancellation({ ...base, by: 'owner', start: hoursFromNow(1) })).toMatchObject({
      allowed: true, refundAmount: 30000, refundStatus: 'pending', forfeited: false,
    })
  })

  it('hủy được cả khi đã quá giờ bắt đầu (sự cố tại sân)', () => {
    expect(decideCancellation({ ...base, by: 'owner', start: hoursFromNow(-1) }).allowed).toBe(true)
  })

  it('đơn chưa cọc thì không có gì để hoàn', () => {
    expect(decideCancellation({ ...base, by: 'owner', status: 'pending', paidAmount: 0 })).toMatchObject({ refundStatus: 'none' })
  })
})

describe('số tiền', () => {
  it('làm tròn và bỏ giá trị không hợp lệ', () => {
    expect(decideCancellation({ ...base, paidAmount: 30000.4 })).toMatchObject({ refundAmount: 30000 })
    expect(decideCancellation({ ...base, paidAmount: -5 })).toMatchObject({ refundStatus: 'none' })
    expect(decideCancellation({ ...base, paidAmount: Number.NaN })).toMatchObject({ refundStatus: 'none' })
  })
})

describe('chính sách giờ hủy miễn phí', () => {
  it('clamp về khoảng hợp lệ và mặc định khi sai', () => {
    expect(clampFreeCancelHours(500)).toBe(168)
    expect(clampFreeCancelHours(-3)).toBe(0)
    expect(clampFreeCancelHours('abc')).toBe(24)
    expect(clampFreeCancelHours(12.9)).toBe(12)
  })

  it('parseFreeCancelHours chỉ nhận số nguyên trong khoảng', () => {
    expect(parseFreeCancelHours('48')).toEqual({ ok: true, hours: 48 })
    expect(parseFreeCancelHours(0)).toEqual({ ok: true, hours: 0 })
    for (const bad of ['', 'abc', '1.5', '-1', '169', null, undefined]) {
      expect(parseFreeCancelHours(bad).ok).toBe(false)
    }
  })

  it('mô tả dễ đọc', () => {
    expect(formatHours(12)).toBe('12 giờ')
    expect(formatHours(48)).toBe('48 giờ (2 ngày)')
    expect(describePolicy(0)).toContain('bất cứ lúc nào')
    expect(describePolicy(24)).toContain('24 giờ (1 ngày)')
  })
})

describe('mô tả kết quả cho người dùng', () => {
  it('đủ ba trường hợp: hoàn, mất cọc, chưa có cọc', () => {
    expect(describeOutcome(decideCancellation(base), money)).toContain('30000đ')
    expect(describeOutcome(decideCancellation({ ...base, start: hoursFromNow(2) }), money)).toContain('không được hoàn cọc')
    expect(describeOutcome(decideCancellation({ ...base, status: 'pending', paidAmount: 0 }), money)).toContain('chưa có khoản cọc')
    expect(describeOutcome(decideCancellation({ ...base, status: 'completed' }), money)).toContain('đã hủy hoặc đã hoàn thành')
  })

  it('nhãn trạng thái hoàn cọc', () => {
    expect(refundStatusLabel('pending', 30000, money)).toContain('Chờ chủ sân hoàn cọc 30000đ')
    expect(refundStatusLabel('refunded', 30000, money)).toContain('Đã hoàn cọc')
    expect(refundStatusLabel('none', 0, money)).toBeNull()
  })
})

describe('isLateCancel', () => {
  const input = { by: 'player', status: 'confirmed', hoursBeforeStart: 10, freeCancelHours: 24 } as const

  it('người chơi hủy đơn đã xác nhận trong hạn miễn phí còn lại là hủy muộn', () => {
    expect(isLateCancel(input)).toBe(true)
  })

  it('hủy đúng mốc hoặc sớm hơn thì không phải hủy muộn', () => {
    expect(isLateCancel({ ...input, hoursBeforeStart: 24 })).toBe(false)
    expect(isLateCancel({ ...input, hoursBeforeStart: 72 })).toBe(false)
  })

  it('đơn chưa cọc (pending) hủy lúc nào cũng không bị tính', () => {
    expect(isLateCancel({ ...input, status: 'pending', hoursBeforeStart: 1 })).toBe(false)
  })

  it('chủ sân hủy không bao giờ là hủy muộn của người chơi', () => {
    expect(isLateCancel({ ...input, by: 'owner', hoursBeforeStart: 1 })).toBe(false)
  })

  it('đơn không có cọc thật (khách cố định) hủy sát giờ vẫn tính là hủy muộn', () => {
    expect(decideCancellation({ ...base, paidAmount: 0, start: hoursFromNow(2) })).toMatchObject({ forfeited: false })
    expect(isLateCancel({ ...input, hoursBeforeStart: 2 })).toBe(true)
  })

  it('chính sách 0 giờ: không có hủy muộn', () => {
    expect(isLateCancel({ ...input, freeCancelHours: 0, hoursBeforeStart: 0.1 })).toBe(false)
  })
})
