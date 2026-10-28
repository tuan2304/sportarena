import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadOwnerAnalytics } from '@/lib/owner-analytics'
import { bookingsToCsv } from '@/lib/owner-stats'
import { parseRangeDays } from '@/lib/owner-stats'
import { isUuid } from '@/lib/mobile-api'
import { resolveLocale } from '@/i18n/config'
import { vnDateKey } from '@/lib/datetime'

/**
 * Xuất chi tiết đơn đặt sân của chủ sân ra CSV (mở được bằng Excel/Google Sheets).
 * Phiên đăng nhập qua cookie; chỉ chủ sân/quản trị, và chỉ đơn ở cụm sân của chính người đó (RLS + lọc theo sân).
 * GET không đổi dữ liệu nên không dính CSRF; tệp trả về đính kèm và không bị cache.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'owner' && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const params = request.nextUrl.searchParams
  const days = parseRangeDays(params.get('days'))
  const club = params.get('club')
  const lang = resolveLocale(request.cookies.get('sa-lang')?.value, request.headers.get('accept-language'))

  const data = await loadOwnerAnalytics(supabase, user.id, { days, clubId: isUuid(club) ? club : null })
  const csv = bookingsToCsv(data.bookings, lang)

  const filename = `bookings_${data.fromKey}_${data.toKey}.csv`
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      // Chỉ để người dùng biết ngày xuất; không chứa dữ liệu nhạy cảm
      'X-Exported-On': vnDateKey(Date.now()),
    },
  })
}
