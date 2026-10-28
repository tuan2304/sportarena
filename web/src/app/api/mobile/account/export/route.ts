import type { NextRequest } from 'next/server'
import { authenticateMobile, errorResponse, jsonResponse, unauthorized } from '@/lib/mobile-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildDataExport } from '@/lib/account'

/** Dữ liệu cá nhân của người đang đăng nhập trong app, dạng JSON để app chia sẻ/lưu thành tệp. */
export async function GET(request: NextRequest) {
  const auth = await authenticateMobile(request)
  if (!auth) return unauthorized(request)

  const result = await buildDataExport(createAdminClient(), auth.user)
  if (!result.ok) return errorResponse(request, result.error, result.status)
  return jsonResponse({ filename: result.filename, data: result.data })
}
