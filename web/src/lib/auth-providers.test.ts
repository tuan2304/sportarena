import { describe, expect, it } from 'vitest'
import { enabledAuthProviders, hasAnyProvider, parseLoginError } from './auth-providers'

describe('enabledAuthProviders', () => {
  it('mặc định không bật gì', () => {
    const p = enabledAuthProviders({})
    expect(p).toEqual({ google: false, apple: false, phone: false, zalo: false })
    expect(hasAnyProvider(p)).toBe(false)
  })

  it('đọc danh sách AUTH_PROVIDERS, không phân biệt hoa thường và dấu ngăn', () => {
    expect(enabledAuthProviders({ AUTH_PROVIDERS: 'Google, apple;phone' })).toMatchObject({ google: true, apple: true, phone: true, zalo: false })
    expect(enabledAuthProviders({ AUTH_PROVIDERS: 'google' })).toMatchObject({ google: true, apple: false })
  })

  it('bỏ qua giá trị lạ', () => {
    expect(enabledAuthProviders({ AUTH_PROVIDERS: 'facebook,,x' })).toEqual({ google: false, apple: false, phone: false, zalo: false })
  })

  it('Zalo tự bật khi có đủ hai khóa, không phụ thuộc AUTH_PROVIDERS', () => {
    const p = enabledAuthProviders({ ZALO_APP_ID: '1', ZALO_APP_SECRET: 's' })
    expect(p.zalo).toBe(true)
    expect(hasAnyProvider(p)).toBe(true)
  })
})

describe('parseLoginError', () => {
  it('chỉ nhận mã lỗi đã biết (không phản chiếu chuỗi tùy ý lên trang)', () => {
    expect(parseLoginError('oauth')).toBe('oauth')
    expect(parseLoginError(['zalo', 'x'])).toBe('zalo')
    expect(parseLoginError('<script>alert(1)</script>')).toBeNull()
    expect(parseLoginError(undefined)).toBeNull()
  })
})
