import type { NextRequest } from 'next/server'
import { authenticateMobile, errorResponse, jsonResponse, readJsonBody, unauthorized } from '@/lib/mobile-auth'
import { isUuid, parseRespondBody } from '@/lib/mobile-api'
import { respondToParticipant } from '@/lib/match-members'

/** Chủ kèo duyệt hoặc từ chối người xin tham gia ngay từ nút trên thông báo đẩy. Chỉ chủ kèo mới làm được (kiểm tra trong lib). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateMobile(request)
  if (!auth) return unauthorized(request)

  const { id } = await params
  if (!isUuid(id)) return errorResponse(request, 'Mã yêu cầu không hợp lệ', 400)

  const raw = await readJsonBody(request)
  if (!raw.ok) return raw.response
  const parsed = parseRespondBody(raw.body)
  if (!parsed.ok) return errorResponse(request, parsed.error, 400)

  const result = await respondToParticipant(auth.user.id, id, parsed.value.status)
  if ('error' in result) return errorResponse(request, result.error, 400)
  return jsonResponse({ success: true })
}
