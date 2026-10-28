import type { NextRequest } from 'next/server'
import { authenticateMobile, errorResponse, jsonResponse, readJsonBody, unauthorized } from '@/lib/mobile-auth'
import { isUuid } from '@/lib/mobile-api'
import { setBookingNoShow } from '@/lib/no-show'

/** Chủ sân báo người đặt không đến sân (body { noShow: false } để gỡ báo nhầm). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateMobile(request)
  if (!auth) return unauthorized(request)

  const { id } = await params
  if (!isUuid(id)) return errorResponse(request, 'Mã đơn không hợp lệ', 400)

  const parsed = await readJsonBody(request)
  if (!parsed.ok) return parsed.response
  const noShow = (parsed.body as { noShow?: unknown })?.noShow !== false

  const result = await setBookingNoShow(auth.user.id, id, noShow)
  if ('error' in result) return errorResponse(request, result.error, 400)
  return jsonResponse({ success: true })
}
