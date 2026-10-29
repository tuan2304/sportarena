import { describe, expect, it } from 'vitest'
import { parseClientError, sanitizePath, scrubText } from '@/lib/client-error'

describe('sanitizePath', () => {
  it('bỏ query và fragment (có thể mang token), chỉ nhận đường dẫn tuyệt đối', () => {
    expect(sanitizePath('/reset-password?token=abc#access_token=xyz')).toBe('/reset-password')
    expect(sanitizePath('/clubs/123')).toBe('/clubs/123')
    expect(sanitizePath('https://evil.example/x')).toBeUndefined()
    expect(sanitizePath('')).toBeUndefined()
    expect(sanitizePath(42)).toBeUndefined()
  })
})

describe('scrubText', () => {
  it('che email và chuỗi trông như token', () => {
    expect(scrubText('lỗi với a.b+c@example.com ở đây')).toBe('lỗi với [email] ở đây')
    expect(scrubText('jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghij')).toBe('jwt [token]')
    expect(scrubText('key ' + 'A'.repeat(40))).toBe('key [token]')
    expect(scrubText('TypeError: x is not a function')).toBe('TypeError: x is not a function')
  })
})

describe('parseClientError', () => {
  it('nhận báo cáo hợp lệ và làm sạch từng trường', () => {
    const r = parseClientError({
      source: 'web',
      message: 'Boom for user@example.com',
      stack: 'at foo (bar.js:1:2)',
      path: '/profile?x=1',
      digest: '123',
    })
    expect(r).toEqual({ source: 'web', message: 'Boom for [email]', stack: 'at foo (bar.js:1:2)', path: '/profile', digest: '123', appVersion: undefined })
  })

  it('cắt độ dài các trường', () => {
    const r = parseClientError({ source: 'mobile', message: 'x '.repeat(500), stack: 'y '.repeat(5000) })
    expect(r?.message).toHaveLength(300)
    expect(r?.stack).toHaveLength(2000)
  })

  it('từ chối nguồn lạ, thiếu thông điệp hoặc không phải object', () => {
    expect(parseClientError({ source: 'bot', message: 'x' })).toBeNull()
    expect(parseClientError({ source: 'web', message: '   ' })).toBeNull()
    expect(parseClientError({ source: 'web' })).toBeNull()
    for (const bad of [null, 'x', 5, [], undefined]) expect(parseClientError(bad)).toBeNull()
  })
})
