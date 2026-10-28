import { describe, expect, it } from 'vitest'
import { maskPhone, normalizeOtp, normalizePhone } from './phone'

describe('normalizePhone', () => {
  it.each([
    ['0901234567', '+84901234567'],
    ['0901 234 567', '+84901234567'],
    ['090.123.4567', '+84901234567'],
    ['84901234567', '+84901234567'],
    ['+84 901 234 567', '+84901234567'],
    ['(+84) 901-234-567', '+84901234567'],
    ['0357123456', '+84357123456'],
    ['  0771234567  ', '+84771234567'],
    ['+14155552671', '+14155552671'],
  ])('%s → %s', (input, expected) => expect(normalizePhone(input)).toBe(expected))

  it.each([
    '',
    '   ',
    'abc',
    '0123456789', // đầu 01 không còn là đầu số di động
    '090123456', // thiếu số
    '09012345678', // thừa số
    '0201234567', // đầu 02 là điện thoại bàn
    '8490123456', // thiếu số khi bắt đầu bằng 84
    '+0901234567',
    '+84',
    '0901234567; DROP TABLE users',
    '<script>',
  ])('từ chối %j', (input) => expect(normalizePhone(input)).toBeNull())
})

describe('maskPhone', () => {
  it('che phần giữa', () => {
    expect(maskPhone('+84901234567')).toBe('+84 ••• ••• 567')
  })
})

describe('normalizeOtp', () => {
  it('nhận 6 chữ số, bỏ khoảng trắng khi dán', () => {
    expect(normalizeOtp('123456')).toBe('123456')
    expect(normalizeOtp(' 123 456 ')).toBe('123456')
    expect(normalizeOtp('000000')).toBe('000000')
  })

  it.each(['12345', '1234567', 'abcdef', '12 34 5a', ''])('từ chối %j', (input) => {
    expect(normalizeOtp(input)).toBeNull()
  })
})
