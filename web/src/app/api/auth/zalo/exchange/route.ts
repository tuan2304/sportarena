import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { enforceRateLimitByIp } from '@/lib/rate-limit'
import { isAppVerifier, openTicket } from '@/lib/zalo-ticket'
import type { Database } from '@/types/database'

/**
 * App mobile đổi "vé" Zalo (nhận qua sportarena://auth-callback) lấy phiên đăng nhập. Phải có đúng `verifier` mà app đã giữ kín.
 * Trả { access_token, refresh_token } để app gọi supabase.auth.setSession. Không đặt cookie.
 */
export const dynamic = 'force-dynamic'

const fail = (status: number) => NextResponse.json({ error: 'Invalid ticket' }, { status, headers: { 'Cache-Control': 'no-store' } })

export async function POST(request: NextRequest) {
  if (await enforceRateLimitByIp('zaloByIp')) return fail(429)

  let body: { ticket?: unknown; verifier?: unknown }
  try {
    body = await request.json()
  } catch {
    return fail(400)
  }
  if (typeof body.ticket !== 'string' || body.ticket.length > 2000 || !isAppVerifier(body.verifier)) return fail(400)

  const tokenHash = openTicket(body.ticket, body.verifier)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!tokenHash || !url || !anon) return fail(401)

  const supabase = createClient<Database>(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash })
  if (error || !data.session) {
    console.error('zalo exchange: không mở được phiên', error?.message)
    return fail(401)
  }
  return NextResponse.json(
    { access_token: data.session.access_token, refresh_token: data.session.refresh_token },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
