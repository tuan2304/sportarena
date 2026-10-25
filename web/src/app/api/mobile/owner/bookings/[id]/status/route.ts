import type { NextRequest } from 'next/server'
import { authenticateMobile, errorResponse, jsonResponse, readJsonBody, unauthorized } from '@/lib/mobile-auth'
import { isUuid, parseOwnerStatusBody } from '@/lib/mobile-api'
import { updateBookingStatusForOwner } from '@/lib/owner-booking'

/** Chủ sân xác nhận cọc, đánh dấu hoàn tất hoặc hủy một đơn từ ứng dụng mobile. Quyền được kiểm tra trong lib (đúng chủ cụm sân). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateMobile(request)
  if (!auth) return unauthorized(request)

  const { id } = await params
  if (!isUuid(id)) return errorResponse(request, 'Mã đơn không hợp lệ', 400)

  const raw = await readJsonBody(request)
  if (!raw.ok) return raw.response
  const parsed = parseOwnerStatusBody(raw.body)
  if (!parsed.ok) return errorResponse(request, parsed.error, 400)

  const result = await updateBookingStatusForOwner(auth.supabase, auth.user, id, parsed.value.status)
  if ('error' in result) return errorResponse(request, result.error, 400)
  return jsonResponse({ success: true, refundAmount: result.refundAmount ?? 0 })
}
