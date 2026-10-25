import type { NextRequest } from 'next/server'
import { authenticateMobile, errorResponse, jsonResponse, readJsonBody, unauthorized } from '@/lib/mobile-auth'
import { isUuid, parsePricingRuleBody } from '@/lib/mobile-api'
import { deletePricingRuleForOwner, updatePricingRuleForOwner } from '@/lib/owner-catalog'

/** Chủ sân sửa một khung giá của mình. Giờ và giá được kiểm tra ở lib; RLS chỉ cho sửa khung giá của cụm sân mình. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateMobile(request)
  if (!auth) return unauthorized(request)

  const { id } = await params
  if (!isUuid(id)) return errorResponse(request, 'Mã khung giá không hợp lệ', 400)

  const raw = await readJsonBody(request)
  if (!raw.ok) return raw.response
  const parsed = parsePricingRuleBody(raw.body)
  if (!parsed.ok) return errorResponse(request, parsed.error, 400)

  const result = await updatePricingRuleForOwner(auth.supabase, id, parsed.value)
  if ('error' in result) return errorResponse(request, result.error, 400)
  return jsonResponse({ success: true })
}

/** Chủ sân xóa một khung giá của mình. RLS chỉ cho xóa khung giá thuộc cụm sân của chủ sân. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateMobile(request)
  if (!auth) return unauthorized(request)

  const { id } = await params
  if (!isUuid(id)) return errorResponse(request, 'Mã khung giá không hợp lệ', 400)

  const result = await deletePricingRuleForOwner(auth.supabase, id)
  if ('error' in result) return errorResponse(request, result.error, 400)
  return jsonResponse({ success: true })
}
