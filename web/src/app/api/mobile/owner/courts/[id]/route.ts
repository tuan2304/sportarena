import type { NextRequest } from 'next/server'
import { authenticateMobile, errorResponse, jsonResponse, readJsonBody, unauthorized } from '@/lib/mobile-auth'
import { isUuid, parseUpdateCourtBody } from '@/lib/mobile-api'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteCourtForOwner, updateCourtForOwner } from '@/lib/owner-catalog'

/** Chủ sân sửa hoặc bật/tắt sân con của mình. Quyền sở hữu được kiểm tra trong lib, quyền ghi do RLS kiểm tra. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateMobile(request)
  if (!auth) return unauthorized(request)

  const { id } = await params
  if (!isUuid(id)) return errorResponse(request, 'Mã sân không hợp lệ', 400)

  const raw = await readJsonBody(request)
  if (!raw.ok) return raw.response
  const parsed = parseUpdateCourtBody(raw.body)
  if (!parsed.ok) return errorResponse(request, parsed.error, 400)

  const result = await updateCourtForOwner(auth.supabase, auth.user, id, parsed.value)
  if ('error' in result) return errorResponse(request, result.error, 400)
  return jsonResponse({ success: true })
}

/** Xóa sân con; bị chặn nếu đã có đơn hoặc giao dịch dính tới (nên tắt sân thay vì xóa). */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateMobile(request)
  if (!auth) return unauthorized(request)

  const { id } = await params
  if (!isUuid(id)) return errorResponse(request, 'Mã sân không hợp lệ', 400)

  const result = await deleteCourtForOwner(auth.supabase, createAdminClient(), auth.user, id)
  if ('error' in result) return errorResponse(request, result.error, 400)
  return jsonResponse({ success: true })
}
