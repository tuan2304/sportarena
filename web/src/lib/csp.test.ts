import { describe, expect, it } from 'vitest'
import { buildCsp, generateNonce } from './csp'

const base = { nonce: 'abc123==', isDev: false, supabaseUrl: 'https://proj.supabase.co' }
const directive = (csp: string, name: string) => csp.split('; ').find((d) => d.startsWith(`${name} `)) ?? ''

describe('generateNonce', () => {
  it('sinh chuỗi base64 khác nhau mỗi lần, đủ dài để không đoán được', () => {
    const a = generateNonce()
    const b = generateNonce()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[A-Za-z0-9+/]+=*$/)
    expect(a.length).toBeGreaterThanOrEqual(22)
  })
})

describe('buildCsp', () => {
  it('script-src chỉ nhận nonce, không có unsafe-inline hay unsafe-eval ở production', () => {
    const script = directive(buildCsp(base), 'script-src')
    expect(script).toContain("'nonce-abc123=='")
    expect(script).toContain("'strict-dynamic'")
    expect(script).not.toContain('unsafe-inline')
    expect(script).not.toContain('unsafe-eval')
  })

  it('chỉ thêm unsafe-eval khi phát triển', () => {
    expect(directive(buildCsp({ ...base, isDev: true }), 'script-src')).toContain("'unsafe-eval'")
  })

  it('connect-src gồm Supabase (REST và realtime) và chính mình', () => {
    expect(directive(buildCsp(base), 'connect-src')).toBe("connect-src 'self' https://proj.supabase.co wss://proj.supabase.co")
  })

  it('thiếu hoặc sai địa chỉ Supabase thì không mở thêm nguồn nào', () => {
    for (const supabaseUrl of [undefined, null, '', 'not a url', 'ftp://x.example']) {
      expect(directive(buildCsp({ ...base, supabaseUrl }), 'connect-src'), String(supabaseUrl)).toBe("connect-src 'self'")
    }
  })

  it('chống nhúng khung, đổi base, plugin và gửi form ra ngoài', () => {
    const csp = buildCsp(base)
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("form-action 'self'")
  })

  it('chỉ cho nhúng khung của Google Maps', () => {
    expect(directive(buildCsp(base), 'frame-src')).toBe('frame-src https://www.google.com')
  })
})
