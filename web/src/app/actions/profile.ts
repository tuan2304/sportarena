'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { validateProfile, type ProfileInput } from '@/lib/profile'
import { tr } from '@/lib/localize-error'

/**
 * Cập nhật hồ sơ của chính mình. Quyền ghi theo cột do database quyết định (chỉ full_name, phone_number,
 * avatar_url, skill_level; không đổi được role hay rating), ở đây chỉ kiểm tra dữ liệu đầu vào.
 */
export async function updateProfile(input: ProfileInput): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: await tr('Vui lòng đăng nhập') }

  const parsed = validateProfile(input)
  if (!parsed.ok) return { error: await tr(parsed.error) }

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: parsed.value.fullName,
      phone_number: parsed.value.phone,
      skill_level: parsed.value.skillLevel,
    })
    .eq('id', user.id)

  if (error) {
    console.error('updateProfile lỗi', error)
    return { error: await tr('Không thể lưu hồ sơ. Vui lòng thử lại.') }
  }

  revalidatePath('/', 'layout')
  revalidatePath('/profile')
  revalidatePath(`/players/${user.id}`)
  return { success: true }
}
