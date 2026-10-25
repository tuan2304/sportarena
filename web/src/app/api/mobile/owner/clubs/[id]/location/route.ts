import type { NextRequest } from 'next/server'
import { authenticateMobile, errorResponse, jsonResponse, readJsonBody, unauthorized } from '@/lib/mobile-auth'
import { isUuid, parseLocationBody } from '@/lib/mobile-api'
import { updateClubLocationForOwner } from '@/lib/owner-catalog'

/** Ghim vị trí bản đồ của cụm sân (hoặc gỡ bằng latitude và longitude đều null). */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateMobile(request)
  if (!auth) return unauthorized(request)

  const { id } = await params
  if (!isUuid(id)) return errorResponse(request, 'Mã cụm sân không hợp lệ', 400)

  const raw = await readJsonBody(request)
  if (!raw.ok) return raw.response
  const parsed = parseLocationBody(raw.body)
  if (!parsed.ok) return errorResponse(request, parsed.error, 400)

  const result = await updateClubLocationForOwner(auth.supabase, auth.user, id, parsed.value.latitude, parsed.value.longitude)
  if ('error' in result) return errorResponse(request, result.error, 400)
  return jsonResponse({ success: true })
}
