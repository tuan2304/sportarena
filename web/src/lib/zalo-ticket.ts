import { createHash } from 'node:crypto'
import { decryptSecret, encryptSecret } from '@/lib/crypto'
import { safeEqual } from '@/lib/zalo'

/**
 * Đăng nhập Zalo trên app mobile. Sau khi Zalo xác nhận, web không gửi thẳng token đăng nhập về app qua đường dẫn
 * `sportarena://` (app khác trên Android có thể đăng ký cùng scheme để chặn). Thay vào đó gửi một "vé" mã hóa, và app phải
 * nộp kèm `verifier` mà nó đã giữ kín (PKCE) thì máy chủ mới đổi vé thành phiên. Chặn được vé mà không có verifier thì vô dụng.
 */
export const TICKET_TTL_SECONDS = 120
export const APP_REDIRECT = 'sportarena://auth-callback'

const base64url = (buf: Buffer) => buf.toString('base64url')

/** challenge = base64url(sha256(verifier)), cùng quy ước PKCE */
export function appChallengeOf(verifier: string): string {
  return base64url(createHash('sha256').update(verifier).digest())
}

export function isAppChallenge(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value)
}

export function isAppVerifier(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43,128}$/.test(value)
}

export function sealTicket(args: { tokenHash: string; challenge: string }, nowMs = Date.now(), key?: string): string {
  const payload = JSON.stringify({ h: args.tokenHash, c: args.challenge, e: Math.floor(nowMs / 1000) + TICKET_TTL_SECONDS })
  return encryptSecret(payload, key)
}

/** Mở vé: trả `token_hash` nếu vé còn hạn và `verifier` khớp challenge; ngược lại null. */
export function openTicket(ticket: string, verifier: string, nowMs = Date.now(), key?: string): string | null {
  try {
    const p = JSON.parse(decryptSecret(ticket, key)) as { h?: unknown; c?: unknown; e?: unknown }
    if (typeof p.h !== 'string' || typeof p.c !== 'string' || typeof p.e !== 'number') return null
    if (Math.floor(nowMs / 1000) > p.e) return null
    return safeEqual(appChallengeOf(verifier), p.c) ? p.h : null
  } catch {
    return null
  }
}
