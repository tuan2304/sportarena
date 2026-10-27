import { describe, expect, it } from 'vitest'
import { isMatchEnded, matchPhase } from './match-time'
import { vnDateTime } from './datetime'

const DATE = '2026-10-23'
const at = (h: number, m = 0) => vnDateTime(DATE, h, m).getTime()
const start = vnDateTime(DATE, 14).toISOString()
const end = vnDateTime(DATE, 16).toISOString()

describe('matchPhase', () => {
  it('trước giờ bắt đầu: chưa tới', () => {
    expect(matchPhase(start, end, at(13, 59))).toBe('upcoming')
  })

  it('từ đúng giờ bắt đầu đến trước giờ kết thúc: đang diễn ra', () => {
    expect(matchPhase(start, end, at(14))).toBe('live')
    expect(matchPhase(start, end, at(15, 59))).toBe('live')
  })

  it('đúng giờ kết thúc trở đi: đã kết thúc', () => {
    expect(matchPhase(start, end, at(16))).toBe('ended')
    expect(matchPhase(start, end, at(23))).toBe('ended')
  })

  it('thiếu hoặc sai giờ thì không tự ẩn kèo', () => {
    expect(matchPhase(null, null, at(23))).toBe('upcoming')
    expect(matchPhase(undefined, 'không phải ngày', at(23))).toBe('upcoming')
  })

  it('chỉ có giờ kết thúc vẫn nhận ra kèo đã qua', () => {
    expect(matchPhase(null, end, at(17))).toBe('ended')
    expect(matchPhase(null, end, at(15))).toBe('upcoming')
  })
})

describe('isMatchEnded', () => {
  it('đúng giờ kết thúc là đã hết, trước đó 1 mili giây thì chưa', () => {
    expect(isMatchEnded(end, at(16))).toBe(true)
    expect(isMatchEnded(end, at(16) - 1)).toBe(false)
  })
})
