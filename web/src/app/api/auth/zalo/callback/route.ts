import { NextResponse, type NextRequest } from 'next/server'
import { resolveAppUrl } from '@/lib/app-url'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enforceRateLimitByIp } from '@/lib/rate-limit'
import { APP_REDIRECT, sealTicket } from '@/lib/zalo-ticket'
import {
  decodeStateCookie,
  homeForRole,
  parseZaloProfile,
  safeEqual,
  safeNextPath,
  zaloConfig,
  zaloEmail,
  ZALO_PROFILE_URL,
  ZALO_STATE_COOKIE,
  ZALO_TOKEN_URL,
  type ZaloProfile,
} from '@/lib/zalo'

/**
 * Zalo quay về với `code`: đổi lấy access token (kèm PKCE verifier), đọc hồ sơ Zalo, nối hoặc tạo tài khoản Supabase tương
 * ứng (bảng zalo_identities) rồi mở phiên đăng nhập bằng magic link tạo phía máy chủ — người dùng không bao giờ thấy
 * email giả định danh. Mọi lỗi đều chuyển về /login?error=zalo, chi tiết chỉ ghi vào log.
 */
export const dynamic = 'force-dynamic'

const TIMEOUT_MS = 8000

async function fetchZaloProfile(code: string, verifier: string): Promise<ZaloProfile | null> {
  const config = zaloConfig()
  if (!config) return null

  const tokenRes = await fetch(ZALO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', secret_key: config.appSecret },
    body: new URLSearchParams({ code, app_id: config.appId, grant_type: 'authorization_code', code_verifier: verifier }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const token = (await tokenRes.json()) as { access_token?: unknown; error?: unknown }
  if (typeof token.access_token !== 'string') {
    console.error('zalo callback: đổi code lấy token thất bại', { status: tokenRes.status, error: token.error })
    return null
  }

  const profileRes = await fetch(ZALO_PROFILE_URL, {
    headers: { access_token: token.access_token },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  return parseZaloProfile(await profileRes.json())
}

/** Tìm hoặc tạo user Supabase cho tài khoản Zalo, trả về email định danh để mở phiên. */
async function ensureZaloUser(profile: ZaloProfile): Promise<string | null> {
  const admin = createAdminClient()
  const email = zaloEmail(profile.id)

  const { data: existing } = await admin.from('zalo_identities').select('user_id').eq('zalo_id', profile.id).maybeSingle()
  if (existing) return email

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: profile.name, avatar_url: profile.avatarUrl ?? '', zalo_id: profile.id },
  })
  // Đã có user với email này (lần trước tạo user xong mà chưa kịp ghi bảng nối): lấy lại id qua magic link bên dưới
  let userId = created?.user?.id ?? null
  if (!userId) {
    if (error && !/already|exists|registered/i.test(error.message)) {
      console.error('zalo callback: không tạo được user', error.message)
      return null
    }
    const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    userId = link?.user?.id ?? null
  }
  if (!userId) return null

  const { error: linkError } = await admin
    .from('zalo_identities')
    .upsert({ zalo_id: profile.id, user_id: userId }, { onConflict: 'zalo_id', ignoreDuplicates: true })
  if (linkError) {
    console.error('zalo callback: không ghi được bảng nối Zalo', linkError.message)
    return null
  }
  return email
}

export async function GET(request: NextRequest) {
  const origin = resolveAppUrl()
  const fail = () => {
    const failedFromApp = Boolean(decodeStateCookie(request.cookies.get(ZALO_STATE_COOKIE)?.value)?.appChallenge)
    const res = NextResponse.redirect(failedFromApp ? `${APP_REDIRECT}?error=zalo` : `${origin}/login?error=zalo`)
    res.cookies.delete({ name: ZALO_STATE_COOKIE, path: '/api/auth/zalo' })
    return res
  }

  const params = request.nextUrl.searchParams
  const saved = decodeStateCookie(request.cookies.get(ZALO_STATE_COOKIE)?.value)
  const code = params.get('code')
  const state = params.get('state') ?? ''
  if (!zaloConfig() || !saved || !code || !safeEqual(state, saved.state)) return fail()
  if (await enforceRateLimitByIp('zaloByIp')) return fail()

  try {
    const profile = await fetchZaloProfile(code, saved.verifier)
    if (!profile) return fail()

    const email = await ensureZaloUser(profile)
    if (!email) return fail()

    const admin = createAdminClient()
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    const tokenHash = link?.properties?.hashed_token
    if (linkError || !tokenHash) {
      console.error('zalo callback: không tạo được liên kết đăng nhập', linkError?.message)
      return fail()
    }

    // Từ app mobile: trả vé mã hóa gắn với challenge của app, không mở phiên cookie ở trình duyệt
    if (saved.appChallenge) {
      const res = NextResponse.redirect(`${APP_REDIRECT}?ticket=${encodeURIComponent(sealTicket({ tokenHash, challenge: saved.appChallenge }))}`)
      res.cookies.delete({ name: ZALO_STATE_COOKIE, path: '/api/auth/zalo' })
      return res
    }

    const supabase = await createClient()
    const { data: session, error: verifyError } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash })
    if (verifyError || !session.user) {
      console.error('zalo callback: không mở được phiên', verifyError?.message)
      return fail()
    }

    const { data: row } = await admin.from('profiles').select('role').eq('id', session.user.id).maybeSingle()
    const res = NextResponse.redirect(`${origin}${safeNextPath(saved.next || null, homeForRole(row?.role))}`)
    res.cookies.delete({ name: ZALO_STATE_COOKIE, path: '/api/auth/zalo' })
    return res
  } catch (err) {
    console.error('zalo callback lỗi:', err instanceof Error ? err.message : err)
    return fail()
  }
}
