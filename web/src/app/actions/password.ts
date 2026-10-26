'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { enforceRateLimit, enforceRateLimitByIp } from '@/lib/rate-limit'
import { tr } from '@/lib/localize-error'
import { isPlausibleRecoveryTokens, parseResetEmail, validateNewPassword } from '@/lib/password-reset'
import { hasRecoverySession, sendPasswordResetEmail } from '@/lib/password-reset-server'

export type PasswordResult = {
  error?: string
  success?: boolean
}

/** Bước 1: gửi thư đặt lại mật khẩu. Luôn trả cùng kết quả dù email có tài khoản hay không. */
export async function requestPasswordReset(formData: FormData): Promise<PasswordResult> {
  const email = parseResetEmail(formData.get('email'))
  if (!email) return { error: await tr('Vui lòng nhập email hợp lệ') }

  const limited = (await enforceRateLimitByIp('forgotByIp')) ?? (await enforceRateLimit('forgotByEmail', email))
  if (limited) return { error: await tr(limited) }

  const sent = await sendPasswordResetEmail(email)
  if (!sent.ok) return { error: await tr(sent.error) }
  return { success: true }
}

/**
 * Bước 2: trang /reset-password gửi lên token đọc từ phần sau dấu # của liên kết trong thư; server dựng phiên bằng cookie.
 * Token do Supabase xác thực khi dựng phiên, nên token giả hay hết hạn đều bị từ chối.
 */
export async function establishRecoverySession(accessToken: string, refreshToken: string): Promise<PasswordResult> {
  if (!isPlausibleRecoveryTokens(accessToken, refreshToken)) {
    return { error: await tr('Liên kết đặt lại mật khẩu đã hết hạn hoặc không hợp lệ. Hãy yêu cầu liên kết mới.') }
  }
  const limited = await enforceRateLimitByIp('resetSessionByIp')
  if (limited) return { error: await tr(limited) }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
  if (error || !data.session) {
    return { error: await tr('Liên kết đặt lại mật khẩu đã hết hạn hoặc không hợp lệ. Hãy yêu cầu liên kết mới.') }
  }
  return { success: true }
}

/**
 * Bước 3: đặt mật khẩu mới. Chỉ nhận khi phiên là phiên khôi phục (vừa bấm liên kết trong thư), để một phiên đăng nhập
 * bình thường bị lộ không đổi được mật khẩu mà không biết mật khẩu cũ. Xong thì đăng xuất các thiết bị khác.
 */
export async function updatePassword(formData: FormData): Promise<PasswordResult> {
  const password = formData.get('password')
  const invalid = validateNewPassword(password, formData.get('confirmPassword'))
  if (invalid) return { error: await tr(invalid) }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await hasRecoverySession(supabase))) {
    return { error: await tr('Phiên đặt lại mật khẩu đã hết hạn. Hãy yêu cầu liên kết mới.') }
  }

  const limited = await enforceRateLimit('passwordUpdate', user.id)
  if (limited) return { error: await tr(limited) }

  const { error } = await supabase.auth.updateUser({ password: password as string })
  if (error) {
    if (error.code === 'same_password') return { error: await tr('Mật khẩu mới phải khác mật khẩu cũ') }
    if (error.code === 'weak_password') return { error: await tr('Mật khẩu quá yếu. Hãy dùng mật khẩu dài và khó đoán hơn.') }
    console.error('updatePassword lỗi', error.status, error.code, error.message)
    return { error: await tr('Không đổi được mật khẩu. Vui lòng thử lại.') }
  }

  // Mật khẩu đã đổi: các thiết bị khác phải đăng nhập lại, phiên hiện tại (đã chứng minh sở hữu email) được giữ
  const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' })
  if (signOutError) console.warn('updatePassword: không đăng xuất được các thiết bị khác', signOutError.message)

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  revalidatePath('/', 'layout')
  redirect(profile?.role === 'admin' ? '/admin' : profile?.role === 'owner' ? '/owner/dashboard' : '/')
}
