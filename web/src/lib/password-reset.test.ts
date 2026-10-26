import { describe, expect, it } from 'vitest'
import { isPlausibleRecoveryTokens, isRecoveryClaims, parseRecoveryHash, parseResetEmail, validateNewPassword } from './password-reset'

const ACCESS = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJl'
const REFRESH = 'abcdefghijkl'

describe('parseResetEmail', () => {
  it('chuẩn hóa chữ thường và cắt khoảng trắng', () => {
    expect(parseResetEmail('  Nguoi.Choi@Example.COM ')).toBe('nguoi.choi@example.com')
  })

  it('từ chối email sai dạng, quá dài hoặc không phải chuỗi', () => {
    for (const bad of ['', 'abc', 'a@b', 'a b@c.com', '@c.com', `${'a'.repeat(250)}@x.com`, null, undefined, 5, {}]) {
      expect(parseResetEmail(bad), String(bad)).toBeNull()
    }
  })
})

describe('validateNewPassword', () => {
  it('chấp nhận mật khẩu đủ dài và khớp', () => {
    expect(validateNewPassword('mat-khau-moi-1', 'mat-khau-moi-1')).toBeNull()
  })

  it('từ chối mật khẩu thiếu, quá ngắn, quá dài hoặc không khớp', () => {
    expect(validateNewPassword('', '')).toBe('Vui lòng nhập mật khẩu mới')
    expect(validateNewPassword(null, null)).toBe('Vui lòng nhập mật khẩu mới')
    expect(validateNewPassword('1234567', '1234567')).toBe('Mật khẩu phải có ít nhất 8 ký tự')
    expect(validateNewPassword('a'.repeat(73), 'a'.repeat(73))).toBe('Mật khẩu tối đa 72 ký tự')
    expect(validateNewPassword('12345678', '12345679')).toBe('Mật khẩu nhập lại không khớp')
  })

  it('mật khẩu 8 và 72 ký tự đều được', () => {
    expect(validateNewPassword('a'.repeat(8), 'a'.repeat(8))).toBeNull()
    expect(validateNewPassword('a'.repeat(72), 'a'.repeat(72))).toBeNull()
  })
})

describe('isPlausibleRecoveryTokens', () => {
  it('nhận token có hình dạng JWT và refresh token ngắn', () => {
    expect(isPlausibleRecoveryTokens(ACCESS, REFRESH)).toBe(true)
  })

  it('từ chối rác, kiểu sai và token quá dài', () => {
    expect(isPlausibleRecoveryTokens('khong-phai-jwt', REFRESH)).toBe(false)
    expect(isPlausibleRecoveryTokens(ACCESS, 'ab')).toBe(false)
    expect(isPlausibleRecoveryTokens(ACCESS, 'có dấu cách và ký tự lạ')).toBe(false)
    expect(isPlausibleRecoveryTokens(`${ACCESS}${'a'.repeat(5000)}`, REFRESH)).toBe(false)
    expect(isPlausibleRecoveryTokens(undefined, REFRESH)).toBe(false)
    expect(isPlausibleRecoveryTokens(ACCESS, 123)).toBe(false)
  })
})

describe('parseRecoveryHash', () => {
  it('đọc phiên khôi phục từ phần sau dấu #', () => {
    const hash = `#access_token=${ACCESS}&expires_in=3600&refresh_token=${REFRESH}&token_type=bearer&type=recovery`
    expect(parseRecoveryHash(hash)).toEqual({ kind: 'session', accessToken: ACCESS, refreshToken: REFRESH })
  })

  it('liên kết hết hạn hoặc đã dùng thì báo lỗi', () => {
    expect(parseRecoveryHash('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')).toEqual({ kind: 'error' })
  })

  it('không nhận phiên không phải khôi phục (vd. magic link, xác nhận email)', () => {
    expect(parseRecoveryHash(`#access_token=${ACCESS}&refresh_token=${REFRESH}&type=signup`)).toEqual({ kind: 'none' })
  })

  it('token hình dạng sai thì coi là lỗi, thiếu hẳn thì là không có gì', () => {
    expect(parseRecoveryHash('#access_token=rac&refresh_token=ab&type=recovery')).toEqual({ kind: 'error' })
    expect(parseRecoveryHash('')).toEqual({ kind: 'none' })
    expect(parseRecoveryHash('#')).toEqual({ kind: 'none' })
    expect(parseRecoveryHash('#section-2')).toEqual({ kind: 'none' })
    expect(parseRecoveryHash(`#type=recovery&access_token=${ACCESS}`)).toEqual({ kind: 'none' })
  })
})

describe('isRecoveryClaims', () => {
  const NOW = 1_800_000_000

  it('nhận phiên từ liên kết trong thư (otp hoặc recovery) còn mới', () => {
    expect(isRecoveryClaims({ amr: [{ method: 'otp', timestamp: NOW - 30 }] }, NOW)).toBe(true)
    expect(isRecoveryClaims({ amr: [{ method: 'recovery', timestamp: NOW - 3000 }] }, NOW)).toBe(true)
    expect(isRecoveryClaims({ amr: [{ method: 'password', timestamp: NOW - 9000 }, { method: 'otp', timestamp: NOW - 10 }] }, NOW)).toBe(true)
  })

  it('phiên từ liên kết đã quá cũ thì không được đổi mật khẩu nữa', () => {
    expect(isRecoveryClaims({ amr: [{ method: 'otp', timestamp: NOW - 3601 }] }, NOW)).toBe(false)
    expect(isRecoveryClaims({ amr: [{ method: 'recovery', timestamp: NOW - 86_400 }] }, NOW)).toBe(false)
  })

  it('phiên đăng nhập bằng mật khẩu, thiếu mốc thời gian, mốc ở tương lai hoặc sai kiểu thì không phải', () => {
    expect(isRecoveryClaims({ amr: [{ method: 'password', timestamp: NOW }] }, NOW)).toBe(false)
    expect(isRecoveryClaims({ amr: [{ method: 'otp' }] }, NOW)).toBe(false)
    expect(isRecoveryClaims({ amr: [{ method: 'otp', timestamp: NOW + 7200 }] }, NOW)).toBe(false)
    expect(isRecoveryClaims({ amr: [{ method: 'otp', timestamp: '1800000000' }] }, NOW)).toBe(false)
    expect(isRecoveryClaims({ amr: ['otp'] }, NOW)).toBe(false)
    expect(isRecoveryClaims({ amr: 'otp' }, NOW)).toBe(false)
    expect(isRecoveryClaims({}, NOW)).toBe(false)
    expect(isRecoveryClaims(null, NOW)).toBe(false)
    expect(isRecoveryClaims(undefined, NOW)).toBe(false)
  })
})
