import { describe, expect, it } from 'vitest'
import { base64Url, hexFromBytes, parseAuthRedirect, parseProviders } from './auth-redirect'

describe('parseAuthRedirect', () => {
  it('luồng implicit: token ở fragment', () => {
    expect(parseAuthRedirect('sportarena://auth-callback#access_token=AAA&refresh_token=BBB&expires_in=3600')).toEqual({
      kind: 'session',
      accessToken: 'AAA',
      refreshToken: 'BBB',
    })
  })

  it('luồng PKCE: code ở query', () => {
    expect(parseAuthRedirect('sportarena://auth-callback?code=abc123')).toEqual({ kind: 'code', code: 'abc123' })
  })

  it('Zalo: vé ở query (đã mã hóa URL)', () => {
    expect(parseAuthRedirect('sportarena://auth-callback?ticket=v1.a-b_c.d%3D')).toEqual({ kind: 'ticket', ticket: 'v1.a-b_c.d=' })
  })

  it('lỗi từ nhà cung cấp hoặc từ web', () => {
    expect(parseAuthRedirect('sportarena://auth-callback?error=zalo')).toEqual({ kind: 'error' })
    expect(parseAuthRedirect('sportarena://auth-callback#error=access_denied&error_description=x')).toEqual({ kind: 'error' })
  })

  it('URL lạ hoặc thiếu dữ liệu đều là lỗi (không chấp nhận scheme khác)', () => {
    expect(parseAuthRedirect('https://evil.example/?code=abc')).toEqual({ kind: 'error' })
    expect(parseAuthRedirect('otherapp://auth-callback?code=abc')).toEqual({ kind: 'error' })
    expect(parseAuthRedirect('sportarena://auth-callback')).toEqual({ kind: 'error' })
    expect(parseAuthRedirect('sportarena://auth-callback#access_token=only')).toEqual({ kind: 'error' })
  })
})

describe('hexFromBytes / base64Url', () => {
  it('hex đủ 2 ký tự mỗi byte', () => {
    expect(hexFromBytes(new Uint8Array([0, 15, 255, 16]))).toBe('000fff10')
    expect(hexFromBytes(new Uint8Array(32)).length).toBe(64)
  })

  it('base64url bỏ đệm và đổi + / thành - _', () => {
    expect(base64Url('ab+/cd==')).toBe('ab-_cd')
    // sha256("a") theo base64 chuẩn → 43 ký tự base64url như web mong đợi
    expect(base64Url('ypeBEsobvcr6wjGzmiPcTaeG7/gUfE5yuYB3ha/uSLs=')).toBe('ypeBEsobvcr6wjGzmiPcTaeG7_gUfE5yuYB3ha_uSLs')
    expect(base64Url('ypeBEsobvcr6wjGzmiPcTaeG7/gUfE5yuYB3ha/uSLs=').length).toBe(43)
  })
})

describe('parseProviders', () => {
  it('đọc danh sách, không phân biệt hoa thường', () => {
    expect(parseProviders('Google, apple;phone')).toEqual({ google: true, apple: true, phone: true, zalo: false })
    expect(parseProviders(undefined)).toEqual({ google: false, apple: false, phone: false, zalo: false })
    expect(parseProviders('zalo')).toMatchObject({ zalo: true })
  })
})
