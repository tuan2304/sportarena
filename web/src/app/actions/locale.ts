'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from '@/i18n/config'

/** Lưu ngôn ngữ giao diện người dùng chọn. Chỉ nhận vi/en nên không thể dùng để ghi giá trị tùy ý vào cookie. */
export async function setLocale(locale: string): Promise<{ error?: string }> {
  if (!isLocale(locale)) return { error: 'Unsupported language' }
  const store = await cookies()
  store.set(LOCALE_COOKIE, locale, { path: '/', maxAge: LOCALE_COOKIE_MAX_AGE, sameSite: 'lax' })
  revalidatePath('/', 'layout')
  return {}
}
