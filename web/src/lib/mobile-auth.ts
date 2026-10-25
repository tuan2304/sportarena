import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { bearerToken, MAX_BODY_BYTES } from '@/lib/mobile-api'
import { translateServerMessage } from '@/i18n/server-messages'
import { resolveLocale } from '@/i18n/config'
import type { Database } from '@/types/database'

/**
 * Xác thực yêu cầu từ ứng dụng mobile bằng access token của Supabase (Authorization: Bearer ...).
 * Token được Supabase Auth kiểm tra chữ ký và hạn, không đọc cookie nên không dính CSRF.
 * Client trả về mang chính phiên của người dùng nên mọi truy vấn vẫn chịu RLS như thường.
 */
export async function authenticateMobile(
  request: NextRequest
): Promise<{ supabase: SupabaseClient<Database>; user: User } | null> {
  const token = bearerToken(request.headers.get('authorization'))
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!token || !url || !anon) return null

  const supabase = createClient<Database>(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return { supabase, user: data.user }
}

export function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

/** Lỗi trả cho app, dịch theo ngôn ngữ app gửi lên qua header Accept-Language. */
export function errorResponse(request: NextRequest, message: string, status: number) {
  const locale = resolveLocale(null, request.headers.get('accept-language'))
  return jsonResponse({ error: translateServerMessage(message, locale) }, status)
}

export const unauthorized = (request: NextRequest) => errorResponse(request, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn', 401)

/** Đọc thân JSON có giới hạn kích thước để không bị gửi thân khổng lồ làm tốn bộ nhớ. */
export async function readJsonBody(request: NextRequest): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > MAX_BODY_BYTES) return { ok: false, response: errorResponse(request, 'Dữ liệu gửi lên quá lớn', 413) }

  try {
    const text = await request.text()
    if (text.length > MAX_BODY_BYTES) return { ok: false, response: errorResponse(request, 'Dữ liệu gửi lên quá lớn', 413) }
    return { ok: true, body: text ? JSON.parse(text) : {} }
  } catch {
    return { ok: false, response: errorResponse(request, 'Dữ liệu gửi lên không phải JSON', 400) }
  }
}
