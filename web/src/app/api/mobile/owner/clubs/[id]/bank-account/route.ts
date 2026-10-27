import type { NextRequest } from 'next/server'
import { authenticateMobile, errorResponse, jsonResponse, readJsonBody, unauthorized } from '@/lib/mobile-auth'
import { isUuid, parseBankAccountBody } from '@/lib/mobile-api'
import { createAdminClient } from '@/lib/supabase/admin'
import { removeBankAccountForOwner, saveBankAccountForOwner } from '@/lib/owner-catalog'

/** Chủ sân liên kết (hoặc đổi) tài khoản ngân hàng nhận cọc của cụm sân mình; có tài khoản thì cụm sân mới hiện cho khách. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateMobile(request)
  if (!auth) return unauthorized(request)

  const { id } = await params
  if (!isUuid(id)) return errorResponse(request, 'Mã cụm sân không hợp lệ', 400)

  const raw = await readJsonBody(request)
  if (!raw.ok) return raw.response
  const parsed = parseBankAccountBody(raw.body)
  if (!parsed.ok) return errorResponse(request, parsed.error, 400)

  const result = await saveBankAccountForOwner(auth.supabase, createAdminClient(), auth.user, id, parsed.value)
  if ('error' in result) return errorResponse(request, result.error, 400)
  return jsonResponse({ success: true })
}

/** Gỡ tài khoản ngân hàng đã liên kết. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateMobile(request)
  if (!auth) return unauthorized(request)

  const { id } = await params
  if (!isUuid(id)) return errorResponse(request, 'Mã cụm sân không hợp lệ', 400)

  const result = await removeBankAccountForOwner(auth.supabase, createAdminClient(), auth.user, id)
  if ('error' in result) return errorResponse(request, result.error, 400)
  return jsonResponse({ success: true })
}
