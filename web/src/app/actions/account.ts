'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { handleDeleteRequest, requiresPassword } from '@/lib/account'
import { tr } from '@/lib/localize-error'

/**
 * Xóa tài khoản của chính mình (web). Thành công thì đăng xuất và về trang chủ; thất bại trả thông báo để hiện trong hộp thoại.
 * Mọi quy tắc nằm ở lib/account.ts, dùng chung với API mobile.
 */
export async function deleteMyAccount(input: { password?: string; confirmation: string }): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: await tr('Vui lòng đăng nhập') }

  const result = await handleDeleteRequest(createAdminClient(), { user, password: input.password, confirmation: input.confirmation })
  if (!result.ok) return { error: await tr(result.error) }

  // Phiên đã vô hiệu ở phía Supabase; xóa cookie phía trình duyệt (lỗi ở bước này không còn ý nghĩa)
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
  revalidatePath('/', 'layout')
  redirect('/')
}

/** Trang hồ sơ cần biết có phải hỏi mật khẩu không (đăng nhập OTP/Zalo/Google không có mật khẩu). */
export async function accountNeedsPassword(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user ? requiresPassword(user) : false
}
