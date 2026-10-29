import type { NextRequest } from 'next/server'
import { authenticateMobile, errorResponse, jsonResponse, readJsonBody, unauthorized } from '@/lib/mobile-auth'
import { isUuid } from '@/lib/mobile-api'
import { decideRecurring, endRecurring } from '@/lib/recurring-service'

/** Chủ sân duyệt, từ chối hoặc kết thúc lịch cố định: body { decision: 'approve' | 'reject' | 'end' }. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateMobile(request)
  if (!auth) return unauthorized(request)

  const { id } = await params
  if (!isUuid(id)) return errorResponse(request, 'Mã lịch cố định không hợp lệ', 400)

  const raw = await readJsonBody(request)
  if (!raw.ok) return raw.response
  const decision = (raw.body as { decision?: unknown } | null)?.decision
  if (decision !== 'approve' && decision !== 'reject' && decision !== 'end') {
    return errorResponse(request, 'Trạng thái không hợp lệ', 400)
  }

  const result =
    decision === 'end' ? await endRecurring({ id: auth.user.id, as: 'owner' }, id) : await decideRecurring(auth.user.id, id, decision)
  if ('error' in result) return errorResponse(request, result.error, 400)
  return jsonResponse({ success: true })
}
