import { describe, expect, it } from 'vitest'
import { clientIp, RATE_RULES, retryMessage } from './rate-limit'

const h = (map: Record<string, string>) => ({ get: (k: string) => map[k.toLowerCase()] ?? null })

describe('clientIp', () => {
  it('một proxy tin cậy: lấy IP do proxy đó ghi (cuối danh sách), không tin IP client tự khai ở đầu', () => {
    expect(clientIp(h({ 'x-forwarded-for': '1.2.3.4' }))).toBe('1.2.3.4')
    expect(clientIp(h({ 'x-forwarded-for': '6.6.6.6, 1.2.3.4' }))).toBe('1.2.3.4')
  })
  it('nhiều proxy tin cậy: đếm từ cuối theo số hop', () => {
    const xff = h({ 'x-forwarded-for': '6.6.6.6, 1.2.3.4, 10.0.0.1' })
    expect(clientIp(xff, 2)).toBe('1.2.3.4')
    expect(clientIp(xff, 3)).toBe('6.6.6.6')
    expect(clientIp(xff, 9)).toBe('6.6.6.6')
  })
  it('rơi về x-real-ip rồi unknown', () => {
    expect(clientIp(h({ 'x-real-ip': ' 5.6.7.8 ' }))).toBe('5.6.7.8')
    expect(clientIp(h({}))).toBe('unknown')
    expect(clientIp(h({ 'x-forwarded-for': '' }))).toBe('unknown')
  })
})

describe('retryMessage', () => {
  it('dưới 1 phút tính bằng giây, còn lại làm tròn lên phút', () => {
    expect(retryMessage(12)).toContain('12 giây')
    expect(retryMessage(60)).toContain('1 phút')
    expect(retryMessage(61)).toContain('2 phút')
    expect(retryMessage(0)).toContain('1 giây')
  })
})

describe('RATE_RULES', () => {
  it('mọi quy tắc có ngưỡng và cửa sổ dương', () => {
    for (const [name, r] of Object.entries(RATE_RULES)) {
      expect(r.max, name).toBeGreaterThan(0)
      expect(r.windowSec, name).toBeGreaterThan(0)
    }
  })
  it('đăng nhập theo email chặt hơn theo IP (chống dò mật khẩu một tài khoản)', () => {
    expect(RATE_RULES.loginByEmail.max).toBeLessThan(RATE_RULES.loginByIp.max)
  })
})
