import type { NextRequest } from 'next/server'
import { authenticateMobile, errorResponse, jsonResponse, readJsonBody, unauthorized } from '@/lib/mobile-auth'
import { isUuid, parseImagesBody } from '@/lib/mobile-api'
import { setClubImagesForOwner } from '@/lib/owner-catalog'

/**
 * Lưu danh sách ảnh của cụm sân sau khi app đã tải ảnh lên bucket club-images/<clubId>/ bằng phiên của chủ sân.
 * Chỉ nhận URL nằm trong kho của chính cụm sân; ảnh bị gỡ khỏi danh sách được xóa khỏi Storage.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateMobile(request)
  if (!auth) return unauthorized(request)

  const { id } = await params
  if (!isUuid(id)) return errorResponse(request, 'Mã cụm sân không hợp lệ', 400)

  const raw = await readJsonBody(request)
  if (!raw.ok) return raw.response
  const parsed = parseImagesBody(raw.body)
  if (!parsed.ok) return errorResponse(request, parsed.error, 400)

  const result = await setClubImagesForOwner(auth.supabase, auth.user, id, parsed.value.images, process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
  if ('error' in result) return errorResponse(request, result.error, 400)
  return jsonResponse({ success: true, images: result.images })
}
