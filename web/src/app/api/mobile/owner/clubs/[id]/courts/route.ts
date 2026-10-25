import type { NextRequest } from 'next/server'
import { authenticateMobile, errorResponse, jsonResponse, readJsonBody, unauthorized } from '@/lib/mobile-auth'
import { isUuid, parseCreateCourtBody } from '@/lib/mobile-api'
import { createCourtForOwner } from '@/lib/owner-catalog'

/** Chủ sân thêm sân con vào cụm sân của mình. Quyền ghi do RLS kiểm tra, giới hạn số sân theo gói do lib kiểm tra. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateMobile(request)
  if (!auth) return unauthorized(request)

  const { id } = await params
  if (!isUuid(id)) return errorResponse(request, 'Mã cụm sân không hợp lệ', 400)

  const raw = await readJsonBody(request)
  if (!raw.ok) return raw.response
  const parsed = parseCreateCourtBody(raw.body)
  if (!parsed.ok) return errorResponse(request, parsed.error, 400)

  const result = await createCourtForOwner(auth.supabase, { clubId: id, ...parsed.value })
  if ('error' in result) return errorResponse(request, result.error, 400)
  return jsonResponse({ success: true, courtId: result.court.id }, 201)
}
