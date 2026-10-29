import type { NextRequest } from 'next/server'
import { authenticateMobile, errorResponse, jsonResponse, unauthorized } from '@/lib/mobile-auth'
import { isUuid } from '@/lib/mobile-api'
import { loadOwnerAnalytics } from '@/lib/owner-analytics'
import { parseRangeDays } from '@/lib/owner-stats'

/** Thống kê của chủ sân cho app mobile: ?days=7|30|90|365&club=<id>. Chỉ đọc đơn ở cụm sân của chính người gọi. */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await authenticateMobile(request)
  if (!auth) return unauthorized(request)

  const { data: profile } = await auth.supabase.from('profiles').select('role').eq('id', auth.user.id).maybeSingle()
  if (profile?.role !== 'owner' && profile?.role !== 'admin') return errorResponse(request, 'Bạn không phải chủ của cụm sân này', 403)

  const params = request.nextUrl.searchParams
  const club = params.get('club')
  const data = await loadOwnerAnalytics(auth.supabase, auth.user.id, { days: parseRangeDays(params.get('days')), clubId: isUuid(club) ? club : null })
  return jsonResponse({
    clubs: data.clubs,
    fromKey: data.fromKey,
    toKey: data.toKey,
    truncated: data.truncated,
    stats: data.stats,
  })
}
