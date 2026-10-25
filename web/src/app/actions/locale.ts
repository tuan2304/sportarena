'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from '@/i18n/config'
import { createClient } from '@/lib/supabase/server'

/** Lưu ngôn ngữ giao diện người dùng chọn. Chỉ nhận vi/en nên không thể dùng để ghi giá trị tùy ý vào cookie. */
export async function setLocale(locale: string): Promise<{ error?: string }> {
  if (!isLocale(locale)) return { error: 'Unsupported language' }
  const store = await cookies()
  store.set(LOCALE_COOKIE, locale, { path: '/', maxAge: LOCALE_COOKIE_MAX_AGE, sameSite: 'lax' })
  // Nhớ ngôn ngữ trong hồ sơ để thông báo đẩy gửi đúng ngôn ngữ; lỗi ở đây không làm hỏng việc đổi ngôn ngữ
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.rpc('set_my_locale', { p_locale: locale })
  } catch {
    // bỏ qua
  }
  revalidatePath('/', 'layout')
  return {}
}
