import type { NextRequest } from 'next/server'
import { authenticateMobile, errorResponse, jsonResponse, readJsonBody, unauthorized } from '@/lib/mobile-auth'
import { parseCreateClubBody } from '@/lib/mobile-api'
import { createClubForOwner } from '@/lib/owner-catalog'

/** Chủ sân tạo cụm sân mới từ ứng dụng mobile. Vai trò chủ sân được kiểm tra trong lib. */
export async function POST(request: NextRequest) {
  const auth = await authenticateMobile(request)
  if (!auth) return unauthorized(request)

  const raw = await readJsonBody(request)
  if (!raw.ok) return raw.response
  const parsed = parseCreateClubBody(raw.body)
  if (!parsed.ok) return errorResponse(request, parsed.error, 400)

  const result = await createClubForOwner(auth.supabase, auth.user, parsed.value)
  if ('error' in result) return errorResponse(request, result.error, 400)
  return jsonResponse({ success: true, clubId: result.club.id }, 201)
}
