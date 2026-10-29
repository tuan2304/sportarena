import { describe, expect, it } from 'vitest'
import { appChallengeOf, isAppChallenge, isAppVerifier, openTicket, sealTicket, TICKET_TTL_SECONDS } from './zalo-ticket'

const KEY = Buffer.alloc(32, 7).toString('base64')
const verifier = 'v'.repeat(43)
const challenge = appChallengeOf(verifier)
const NOW = 1_800_000_000_000

describe('vé đăng nhập Zalo cho app', () => {
  it('đúng verifier và còn hạn thì mở được', () => {
    const ticket = sealTicket({ tokenHash: 'hash123', challenge }, NOW, KEY)
    expect(openTicket(ticket, verifier, NOW + 1000, KEY)).toBe('hash123')
  })

  it('sai verifier (kẻ chặn được vé) thì không mở được', () => {
    const ticket = sealTicket({ tokenHash: 'hash123', challenge }, NOW, KEY)
    expect(openTicket(ticket, 'x'.repeat(43), NOW, KEY)).toBeNull()
  })

  it('hết hạn sau ' + TICKET_TTL_SECONDS + ' giây', () => {
    const ticket = sealTicket({ tokenHash: 'h', challenge }, NOW, KEY)
    expect(openTicket(ticket, verifier, NOW + (TICKET_TTL_SECONDS - 1) * 1000, KEY)).toBe('h')
    expect(openTicket(ticket, verifier, NOW + (TICKET_TTL_SECONDS + 5) * 1000, KEY)).toBeNull()
  })

  it('vé bị sửa, sai khóa hoặc rác đều bị từ chối', () => {
    const ticket = sealTicket({ tokenHash: 'h', challenge }, NOW, KEY)
    expect(openTicket(ticket.slice(0, -2) + 'AA', verifier, NOW, KEY)).toBeNull()
    expect(openTicket(ticket, verifier, NOW, Buffer.alloc(32, 9).toString('base64'))).toBeNull()
    expect(openTicket('rác', verifier, NOW, KEY)).toBeNull()
    expect(openTicket('', verifier, NOW, KEY)).toBeNull()
  })

  it('kiểm tra định dạng challenge và verifier', () => {
    expect(isAppChallenge(challenge)).toBe(true)
    expect(isAppChallenge('ngắn')).toBe(false)
    expect(isAppChallenge(undefined)).toBe(false)
    expect(isAppVerifier(verifier)).toBe(true)
    expect(isAppVerifier('a b'.repeat(20))).toBe(false)
  })
})
