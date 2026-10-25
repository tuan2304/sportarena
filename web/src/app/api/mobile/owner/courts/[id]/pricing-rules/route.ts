import type { NextRequest } from 'next/server'
import { authenticateMobile, errorResponse, jsonResponse, readJsonBody, unauthorized } from '@/lib/mobile-auth'
import { isUuid, parsePricingRuleBody } from '@/lib/mobile-api'
import { createPricingRuleForOwner } from '@/lib/owner-catalog'

/** Chủ sân thêm khung giá cho sân con. Giờ và giá được kiểm tra ở lib, quyền ghi do RLS kiểm tra. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateMobile(request)
  if (!auth) return unauthorized(request)

  const { id } = await params
  if (!isUuid(id)) return errorResponse(request, 'Mã sân không hợp lệ', 400)

  const raw = await readJsonBody(request)
  if (!raw.ok) return raw.response
  const parsed = parsePricingRuleBody(raw.body)
  if (!parsed.ok) return errorResponse(request, parsed.error, 400)

  const result = await createPricingRuleForOwner(auth.supabase, { courtId: id, ...parsed.value })
  if ('error' in result) return errorResponse(request, result.error, 400)
  return jsonResponse({ success: true }, 201)
}
