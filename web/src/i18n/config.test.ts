import { describe, expect, it } from 'vitest'
import { intlLocale, isLocale, resolveLocale } from './config'

describe('resolveLocale', () => {
  it('cookie hợp lệ đi trước Accept-Language', () => {
    expect(resolveLocale('en', 'vi-VN,vi;q=0.9')).toBe('en')
    expect(resolveLocale('vi', 'en-US,en;q=0.9')).toBe('vi')
  })

  it('bỏ qua cookie sai và theo Accept-Language', () => {
    expect(resolveLocale('fr', 'en-US,en;q=0.9')).toBe('en')
    expect(resolveLocale('', 'en-GB')).toBe('en')
  })

  it('chọn ngôn ngữ có trọng số cao nhất mà web hỗ trợ', () => {
    expect(resolveLocale(undefined, 'fr;q=0.9,en;q=0.8,vi;q=0.7')).toBe('en')
    expect(resolveLocale(undefined, 'vi;q=0.5,en;q=0.9')).toBe('en')
    expect(resolveLocale(undefined, 'en;q=0.1,vi;q=0.9')).toBe('vi')
  })

  it('mặc định tiếng Việt khi không có thông tin hoặc không hỗ trợ', () => {
    expect(resolveLocale(undefined, undefined)).toBe('vi')
    expect(resolveLocale(null, '')).toBe('vi')
    expect(resolveLocale(undefined, 'fr-FR,de;q=0.8')).toBe('vi')
    expect(resolveLocale(undefined, 'en;q=0')).toBe('vi')
  })
})

describe('isLocale / intlLocale', () => {
  it('chỉ nhận vi và en', () => {
    expect(isLocale('vi')).toBe(true)
    expect(isLocale('en')).toBe(true)
    for (const bad of ['EN', 'fr', '', null, undefined, 1]) expect(isLocale(bad), String(bad)).toBe(false)
  })

  it('map sang mã Intl', () => {
    expect(intlLocale('vi')).toBe('vi-VN')
    expect(intlLocale('en')).toBe('en-GB')
  })
})
