import { NextResponse, type NextRequest } from 'next/server'
import { resolveAppUrl } from '@/lib/app-url'
import { enforceRateLimitByIp } from '@/lib/rate-limit'
import {
  buildZaloAuthUrl,
  createPkce,
  createState,
  encodeStateCookie,
  safeNextPath,
  zaloCallbackUrl,
  zaloConfig,
  ZALO_STATE_COOKIE,
  ZALO_STATE_MAX_AGE,
} from '@/lib/zalo'

/** Bắt đầu đăng nhập Zalo: lưu state + PKCE verifier vào cookie httpOnly rồi chuyển sang trang cấp quyền của Zalo. */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const origin = resolveAppUrl()
  const config = zaloConfig()
  if (!config) return NextResponse.redirect(`${origin}/login?error=zalo_unavailable`)

  if (await enforceRateLimitByIp('zaloByIp')) return NextResponse.redirect(`${origin}/login?error=zalo`)

  const { verifier, challenge } = createPkce()
  const state = createState()
  const next = safeNextPath(request.nextUrl.searchParams.get('next'), '')

  const response = NextResponse.redirect(
    buildZaloAuthUrl({ appId: config.appId, redirectUri: zaloCallbackUrl(), challenge, state })
  )
  response.cookies.set(ZALO_STATE_COOKIE, encodeStateCookie({ state, verifier, next }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth/zalo',
    maxAge: ZALO_STATE_MAX_AGE,
  })
  return response
}
