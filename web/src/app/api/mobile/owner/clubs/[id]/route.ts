import type { NextRequest } from 'next/server'
import { authenticateMobile, errorResponse, jsonResponse, unauthorized } from '@/lib/mobile-auth'
import { isUuid } from '@/lib/mobile-api'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteClubForOwner } from '@/lib/owner-catalog'

/** Xóa cụm sân của mình; bị chặn nếu đã có đơn hoặc giao dịch dính tới. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateMobile(request)
  if (!auth) return unauthorized(request)

  const { id } = await params
  if (!isUuid(id)) return errorResponse(request, 'Mã cụm sân không hợp lệ', 400)

  const result = await deleteClubForOwner(auth.supabase, createAdminClient(), auth.user, id)
  if ('error' in result) return errorResponse(request, result.error, 400)
  return jsonResponse({ success: true })
}
