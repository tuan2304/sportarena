import { describe, expect, it } from 'vitest'
import { MAX_WAITLIST_DAYS_AHEAD, MAX_WAITLIST_HOURS, validateWaitlistWindow } from './waitlist'

const now = new Date('2026-11-10T05:00:00Z').getTime()
const at = (h: number) => new Date(now + h * 3_600_000).toISOString()

describe('validateWaitlistWindow', () => {
  it('khung giờ hợp lệ trong tương lai', () => {
    const r = validateWaitlistWindow(at(24), at(25), now)
    expect(r.ok).toBe(true)
  })

  it('từ chối dữ liệu hỏng', () => {
    expect(validateWaitlistWindow('abc', at(25), now)).toMatchObject({ ok: false, error: 'Thời gian đặt sân không hợp lệ' })
  })

  it('giờ kết thúc phải sau giờ bắt đầu', () => {
    expect(validateWaitlistWindow(at(25), at(24), now)).toMatchObject({ ok: false, error: 'Giờ kết thúc phải sau giờ bắt đầu' })
    expect(validateWaitlistWindow(at(24), at(24), now)).toMatchObject({ ok: false })
  })

  it('không chờ khung giờ đã bắt đầu hoặc đã qua', () => {
    expect(validateWaitlistWindow(at(0), at(1), now)).toMatchObject({ ok: false, error: 'Không thể đặt khung giờ đã qua' })
    expect(validateWaitlistWindow(at(-2), at(-1), now)).toMatchObject({ ok: false })
  })

  it('giới hạn đặt trước tối đa như khi đặt sân', () => {
    const far = MAX_WAITLIST_DAYS_AHEAD * 24 + 1
    expect(validateWaitlistWindow(at(far), at(far + 1), now)).toMatchObject({ ok: false })
    expect(validateWaitlistWindow(at(far - 5), at(far - 4), now).ok).toBe(true)
  })

  it('giới hạn thời lượng', () => {
    expect(validateWaitlistWindow(at(24), at(24 + MAX_WAITLIST_HOURS), now).ok).toBe(true)
    expect(validateWaitlistWindow(at(24), at(24 + MAX_WAITLIST_HOURS + 0.5), now)).toMatchObject({ ok: false })
  })
})
