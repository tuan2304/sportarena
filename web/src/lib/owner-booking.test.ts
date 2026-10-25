import { describe, expect, it } from 'vitest'
import { isOwnerBookingStatus, transitionError } from './owner-booking'

const NOW = Date.parse('2026-11-05T12:00:00Z')
const PAST = '2026-11-05T10:00:00Z'
const FUTURE = '2026-11-06T10:00:00Z'

describe('transitionError', () => {
  it('đơn chờ cọc được xác nhận hoặc hủy', () => {
    expect(transitionError('pending', 'confirmed', FUTURE, NOW)).toBeNull()
    expect(transitionError('pending', 'cancelled', FUTURE, NOW)).toBeNull()
  })

  it('đơn chờ cọc không được hoàn tất thẳng', () => {
    expect(transitionError('pending', 'completed', PAST, NOW)).toMatch(/Không thể chuyển/)
  })

  it('đơn đã xác nhận được hủy, và hoàn tất khi đã đến giờ chơi', () => {
    expect(transitionError('confirmed', 'cancelled', FUTURE, NOW)).toBeNull()
    expect(transitionError('confirmed', 'completed', PAST, NOW)).toBeNull()
  })

  it('chưa đến giờ chơi thì chưa hoàn tất được', () => {
    expect(transitionError('confirmed', 'completed', FUTURE, NOW)).toMatch(/Chưa đến giờ chơi/)
  })

  it('đơn đã hủy hoặc đã hoàn tất không đổi được nữa', () => {
    for (const current of ['cancelled', 'completed']) {
      for (const next of ['confirmed', 'cancelled', 'completed'] as const) {
        expect(transitionError(current, next, PAST, NOW), `${current} -> ${next}`).not.toBeNull()
      }
    }
  })

  it('không xác nhận lại đơn đã xác nhận', () => {
    expect(transitionError('confirmed', 'confirmed', PAST, NOW)).not.toBeNull()
  })
})

describe('isOwnerBookingStatus', () => {
  it('chỉ nhận ba trạng thái', () => {
    expect(isOwnerBookingStatus('confirmed')).toBe(true)
    for (const bad of ['pending', 'refunded', '', null, undefined, 1]) expect(isOwnerBookingStatus(bad), String(bad)).toBe(false)
  })
})
