import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { resolveAppUrl } from '@/lib/app-url'
import { isRecoveryClaims } from '@/lib/password-reset'
import type { Database } from '@/types/database'

/**
 * Gửi thư đặt lại mật khẩu. Dùng client không lưu phiên và theo flow "implicit": liên kết trong thư mang phiên khôi phục
 * ở phần sau dấu # nên mở được trên bất kỳ thiết bị nào (flow PKCE cần đúng trình duyệt đã yêu cầu). Dùng chung cho web
 * (Server Action) và app mobile (API), vì app mobile không thể tự mở trang web đã có sẵn cookie xác minh.
 *
 * Supabase trả thành công kể cả khi email chưa đăng ký, và ta cũng không phân biệt, để không lộ email nào đã có tài khoản.
 * Địa chỉ trang đặt lại phải nằm trong danh sách Redirect URLs của Supabase (xem DEPLOYMENT.md).
 */
export type ResetMailResult = { ok: true } | { ok: false; error: string }

export function resetRedirectUrl(): string {
  return `${resolveAppUrl()}/reset-password`
}

export async function sendPasswordResetEmail(email: string): Promise<ResetMailResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return { ok: false, error: 'Không gửi được email lúc này. Vui lòng thử lại sau.' }

  const supabase = createClient<Database>(url, anon, {
    auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: resetRedirectUrl() })
  if (!error) return { ok: true }

  if (error.status === 429 || error.code === 'over_email_send_rate_limit') {
    return { ok: false, error: 'Hệ thống đã gửi quá nhiều email. Vui lòng thử lại sau ít phút.' }
  }
  console.error('sendPasswordResetEmail lỗi', error.status, error.code, error.message)
  return { ok: false, error: 'Không gửi được email lúc này. Vui lòng thử lại sau.' }
}

/** Phiên của người đang gọi có phải phiên khôi phục (vừa bấm liên kết trong thư) không. */
export async function hasRecoverySession(supabase: SupabaseClient<Database>): Promise<boolean> {
  const { data } = await supabase.auth.getClaims()
  return isRecoveryClaims(data?.claims)
}
