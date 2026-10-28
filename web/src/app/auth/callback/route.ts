import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveAppUrl } from '@/lib/app-url'
import { homeForRole, safeNextPath } from '@/lib/zalo'

/**
 * Điểm quay về sau khi đăng nhập Google/Apple qua Supabase Auth (luồng PKCE): đổi `code` lấy phiên rồi chuyển tới trang đích.
 * `next` chỉ nhận đường dẫn nội bộ để không thành "open redirect".
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const origin = resolveAppUrl()
  const code = request.nextUrl.searchParams.get('code')
  const next = request.nextUrl.searchParams.get('next')

  if (!code) return NextResponse.redirect(`${origin}/login?error=oauth`)

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user) {
    console.error('auth/callback: không đổi được code lấy phiên:', error?.message)
    return NextResponse.redirect(`${origin}/login?error=oauth`)
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
  return NextResponse.redirect(`${origin}${safeNextPath(next, homeForRole(profile?.role))}`)
}
