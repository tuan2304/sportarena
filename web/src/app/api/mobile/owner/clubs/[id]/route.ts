import type { NextRequest } from 'next/server'
import { authenticateMobile, errorResponse, jsonResponse, readJsonBody, unauthorized } from '@/lib/mobile-auth'
import { isUuid, parseUpdateClubBody } from '@/lib/mobile-api'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteClubForOwner, updateClubForOwner } from '@/lib/owner-catalog'

/** Chủ sân sửa thông tin cụm sân của mình. Quyền sở hữu được kiểm tra trong lib, quyền ghi do RLS kiểm tra. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateMobile(request)
  if (!auth) return unauthorized(request)

  const { id } = await params
  if (!isUuid(id)) return errorResponse(request, 'Mã cụm sân không hợp lệ', 400)

  const raw = await readJsonBody(request)
  if (!raw.ok) return raw.response
  const parsed = parseUpdateClubBody(raw.body)
  if (!parsed.ok) return errorResponse(request, parsed.error, 400)

  const result = await updateClubForOwner(auth.supabase, auth.user, id, parsed.value)
  if ('error' in result) return errorResponse(request, result.error, 400)
  return jsonResponse({ success: true })
}

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
