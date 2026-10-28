import { describe, expect, it } from 'vitest'
import {
  buildZaloAuthUrl,
  createPkce,
  decodeStateCookie,
  encodeStateCookie,
  homeForRole,
  parseZaloProfile,
  pkceChallenge,
  safeEqual,
  safeNextPath,
  zaloConfig,
  zaloEmail,
} from './zalo'

describe('PKCE', () => {
  it('challenge là base64url(sha256(verifier)) theo RFC 7636', () => {
    // Ví dụ trong RFC 7636, Phụ lục B
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })

  it('mỗi lần tạo ra cặp khác nhau, verifier đủ dài và khớp challenge', () => {
    const a = createPkce()
    const b = createPkce()
    expect(a.verifier).not.toBe(b.verifier)
    expect(a.verifier.length).toBeGreaterThanOrEqual(43)
    expect(pkceChallenge(a.verifier)).toBe(a.challenge)
  })
})

describe('buildZaloAuthUrl', () => {
  it('có đủ tham số OAuth + PKCE', () => {
    const url = new URL(buildZaloAuthUrl({ appId: '123', redirectUri: 'https://x.vn/api/auth/zalo/callback', challenge: 'CH', state: 'ST' }))
    expect(url.origin + url.pathname).toBe('https://oauth.zaloapp.com/v4/permission')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      app_id: '123',
      redirect_uri: 'https://x.vn/api/auth/zalo/callback',
      code_challenge: 'CH',
      code_challenge_method: 'S256',
      state: 'ST',
    })
  })
})

describe('zaloConfig / zaloEmail', () => {
  it('chỉ bật khi có cả hai khóa', () => {
    expect(zaloConfig({})).toBeNull()
    expect(zaloConfig({ ZALO_APP_ID: '1' })).toBeNull()
    expect(zaloConfig({ ZALO_APP_ID: '1', ZALO_APP_SECRET: 's' })).toEqual({ appId: '1', appSecret: 's' })
  })

  it('email định danh dùng miền của web, hoặc ZALO_EMAIL_DOMAIN nếu đặt', () => {
    expect(zaloEmail('42', { NEXT_PUBLIC_APP_URL: 'https://sportarena.vn' })).toBe('zalo-42@sportarena.vn')
    expect(zaloEmail('42', { NEXT_PUBLIC_APP_URL: 'https://sportarena.vn', ZALO_EMAIL_DOMAIN: 'mail.example.org' })).toBe('zalo-42@mail.example.org')
  })
})

describe('state cookie', () => {
  it('mã hóa rồi giải mã lại đúng', () => {
    const value = { state: 's', verifier: 'v', next: '/matches' }
    expect(decodeStateCookie(encodeStateCookie(value))).toEqual(value)
  })

  it('cookie thiếu, hỏng hoặc thiếu trường thì trả null', () => {
    expect(decodeStateCookie(undefined)).toBeNull()
    expect(decodeStateCookie('không phải base64 json')).toBeNull()
    expect(decodeStateCookie(Buffer.from('{"state":"s"}').toString('base64url'))).toBeNull()
  })
})

describe('safeEqual', () => {
  it('so sánh chuỗi', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
    expect(safeEqual('abc', 'abcd')).toBe(false)
  })
})

describe('parseZaloProfile', () => {
  it('đọc id, tên, ảnh', () => {
    expect(parseZaloProfile({ id: '1234567890', name: '  Nguyễn Văn A ', picture: { data: { url: 'https://s120.zalo.me/a.jpg' } } })).toEqual({
      id: '1234567890',
      name: 'Nguyễn Văn A',
      avatarUrl: 'https://s120.zalo.me/a.jpg',
    })
  })

  it('id dạng số vẫn nhận, ảnh không phải https bị bỏ', () => {
    expect(parseZaloProfile({ id: 99, name: 'B', picture: { data: { url: 'http://insecure/a.jpg' } } })).toEqual({ id: '99', name: 'B', avatarUrl: null })
  })

  it.each([null, {}, { id: '' }, { id: 'abc' }, { id: '1; DROP' }, { name: 'không có id' }])('từ chối %j', (body) => {
    expect(parseZaloProfile(body)).toBeNull()
  })
})

describe('safeNextPath', () => {
  it('chỉ nhận đường dẫn nội bộ', () => {
    expect(safeNextPath('/my-bookings')).toBe('/my-bookings')
    expect(safeNextPath('/matches?x=1')).toBe('/matches?x=1')
  })

  it.each(['//evil.com', 'https://evil.com', '/\\evil.com', 'javascript:alert(1)', '', null, undefined, '/a\r\nSet-Cookie: x=1'])(
    'chặn %j (về trang mặc định)',
    (input) => expect(safeNextPath(input as string | null | undefined)).toBe('/')
  )
})

describe('homeForRole', () => {
  it('điều hướng theo vai trò', () => {
    expect(homeForRole('admin')).toBe('/admin')
    expect(homeForRole('owner')).toBe('/owner/dashboard')
    expect(homeForRole('player')).toBe('/')
    expect(homeForRole(null)).toBe('/')
  })
})
