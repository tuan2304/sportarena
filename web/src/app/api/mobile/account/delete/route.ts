import type { NextRequest } from 'next/server'
import { authenticateMobile, errorResponse, jsonResponse, readJsonBody, unauthorized } from '@/lib/mobile-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { handleDeleteRequest } from '@/lib/account'

/**
 * Xóa tài khoản từ trong app (Apple 5.1.1(v), Google Play). Thân: { confirmation: "XÓA", password? }. Tài khoản đăng ký
 * bằng email phải gửi mật khẩu; đăng nhập OTP/Zalo/Google/Apple thì chỉ cần confirmation.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateMobile(request)
  if (!auth) return unauthorized(request)

  const raw = await readJsonBody(request)
  if (!raw.ok) return raw.response
  const body = (typeof raw.body === 'object' && raw.body !== null ? raw.body : {}) as { confirmation?: unknown; password?: unknown }

  const result = await handleDeleteRequest(createAdminClient(), {
    user: auth.user,
    password: body.password,
    confirmation: body.confirmation,
  })
  if (!result.ok) return errorResponse(request, result.error, result.status)
  return jsonResponse({ success: true, mode: result.mode })
}
