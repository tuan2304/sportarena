import type { NextRequest } from 'next/server'
import { authenticateMobile, errorResponse, jsonResponse, unauthorized } from '@/lib/mobile-auth'
import { isUuid } from '@/lib/mobile-api'
import { claimTransferForUser } from '@/lib/manual-payment'

/** Khách báo đã chuyển khoản cho đơn thanh toán thủ công: kéo dài giữ chỗ và báo chủ sân. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateMobile(request)
  if (!auth) return unauthorized(request)

  const { id } = await params
  if (!isUuid(id)) return errorResponse(request, 'Mã đơn không hợp lệ', 400)

  const result = await claimTransferForUser(auth.user.id, id)
  if (result.error) return errorResponse(request, result.error, 400)
  return jsonResponse({ success: true })
}
