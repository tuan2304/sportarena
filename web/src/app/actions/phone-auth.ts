'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { enforceRateLimit, enforceRateLimitByIp } from '@/lib/rate-limit'
import { normalizeOtp, normalizePhone } from '@/lib/phone'
import { homeForRole, safeNextPath } from '@/lib/zalo'
import { tr } from '@/lib/localize-error'

/**
 * Đăng nhập bằng OTP điện thoại (Supabase Auth gửi tin nhắn qua nhà cung cấp SMS đã cấu hình trong Dashboard).
 * Mỗi tin nhắn tốn tiền và có thể bị lợi dụng để spam số của người khác nên giới hạn theo cả IP lẫn số điện thoại,
 * và thông báo lỗi luôn chung chung để không lộ số nào đã có tài khoản.
 */
export type PhoneAuthResult = { error?: string; phone?: string; needsName?: boolean }

export async function sendPhoneOtp(phoneInput: string): Promise<PhoneAuthResult> {
  const phone = normalizePhone(phoneInput)
  if (!phone) return { error: await tr('Số điện thoại không hợp lệ') }

  const limited = (await enforceRateLimitByIp('otpSendByIp')) ?? (await enforceRateLimit('otpSendByPhone', phone))
  if (limited) return { error: await tr(limited) }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({ phone, options: { channel: 'sms', shouldCreateUser: true } })
  if (error) {
    console.error('sendPhoneOtp lỗi:', error.message)
    return { error: await tr('Không gửi được mã xác thực. Vui lòng thử lại sau.') }
  }
  return { phone }
}

/**
 * Xác minh mã. Người dùng mới chưa có tên: trả `needsName` (phiên đã mở) để giao diện hỏi tên rồi gọi saveDisplayName;
 * ngược lại chuyển thẳng tới trang đích.
 */
export async function verifyPhoneOtp(phoneInput: string, codeInput: string, next?: string): Promise<PhoneAuthResult> {
  const phone = normalizePhone(phoneInput)
  const code = normalizeOtp(codeInput)
  if (!phone || !code) return { error: await tr('Mã xác thực không đúng hoặc đã hết hạn') }

  const limited = (await enforceRateLimitByIp('otpVerifyByIp')) ?? (await enforceRateLimit('otpVerifyByPhone', phone))
  if (limited) return { error: await tr(limited) }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' })
  if (error || !data.user) return { error: await tr('Mã xác thực không đúng hoặc đã hết hạn') }

  const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', data.user.id).maybeSingle()
  revalidatePath('/', 'layout')

  if (!profile?.full_name?.trim()) return { needsName: true, phone }
  redirect(next ? safeNextPath(next, homeForRole(profile.role)) : homeForRole(profile.role))
}

/** Người đăng ký bằng số điện thoại đặt tên hiển thị lần đầu. */
export async function saveDisplayName(nameInput: string, next?: string): Promise<{ error?: string }> {
  const name = (nameInput ?? '').trim().slice(0, 100)
  if (name.length < 2) return { error: await tr('Vui lòng nhập họ tên (ít nhất 2 ký tự)') }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: await tr('Vui lòng đăng nhập') }

  const { data: profile, error } = await supabase
    .from('profiles')
    .update({ full_name: name })
    .eq('id', user.id)
    .select('role')
    .maybeSingle()
  if (error) {
    console.error('saveDisplayName lỗi:', error.message)
    return { error: await tr('Không thể lưu họ tên. Vui lòng thử lại.') }
  }

  revalidatePath('/', 'layout')
  redirect(next ? safeNextPath(next, homeForRole(profile?.role)) : homeForRole(profile?.role))
}
