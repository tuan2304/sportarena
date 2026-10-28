import { describe, expect, it } from 'vitest'
import { NO_SHOW_WINDOW_DAYS, noShowError } from './no-show'

const now = new Date('2026-11-10T12:00:00Z').getTime()
const hours = (h: number) => new Date(now + h * 3_600_000).toISOString()

describe('noShowError', () => {
  it('chưa đến giờ chơi thì chưa báo được', () => {
    expect(noShowError(hours(1), hours(2), now)).toMatch(/Chưa đến giờ chơi/)
  })

  it('đang chơi hoặc vừa kết thúc thì báo được', () => {
    expect(noShowError(hours(-0.5), hours(0.5), now)).toBeNull()
    expect(noShowError(hours(-2), hours(-1), now)).toBeNull()
  })

  it(`sau ${NO_SHOW_WINDOW_DAYS} ngày kể từ lúc kết thúc thì không đổi được nữa`, () => {
    expect(noShowError(hours(-24 * 14 - 2), hours(-24 * 14 + 1), now)).toBeNull()
    expect(noShowError(hours(-24 * 14 - 3), hours(-24 * 14 - 2), now)).toMatch(/quá 14 ngày/)
  })
})
