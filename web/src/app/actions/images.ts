'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isOwnImageUrl, ownImagePath } from '@/lib/image-upload'
import { setClubImagesForOwner } from '@/lib/owner-catalog'
import { tr } from '@/lib/localize-error'

function supabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
}

/** Lưu danh sách ảnh của cụm sân sau khi trình duyệt đã tải lên Storage (kiểm tra và dọn file cũ nằm trong lib). */
export async function setClubImages(clubId: string, images: unknown): Promise<{ error?: string; success?: boolean; images?: string[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: await tr('Vui lòng đăng nhập') }

  const result = await setClubImagesForOwner(supabase, user, clubId, images, supabaseUrl())
  if ('error' in result) return { error: await tr(result.error) }

  revalidatePath('/owner/clubs')
  revalidatePath('/clubs')
  revalidatePath(`/clubs/${clubId}`)
  return { success: true, images: result.images }
}

/** Đổi ảnh đại diện của chính mình; null để gỡ. */
export async function setAvatar(url: string | null): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: await tr('Vui lòng đăng nhập') }

  if (url !== null && !isOwnImageUrl('avatars', user.id, url, supabaseUrl())) {
    return { error: await tr('Ảnh đại diện không hợp lệ') }
  }

  const { data: before } = await supabase.from('profiles').select('avatar_url').eq('id', user.id).maybeSingle()
  const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id)
  if (error) {
    console.error('setAvatar lỗi', error)
    return { error: await tr('Không thể lưu ảnh đại diện. Vui lòng thử lại.') }
  }

  // Xóa file ảnh cũ trong kho của mình để không tích tụ
  const oldPath = before?.avatar_url ? ownImagePath('avatars', user.id, before.avatar_url, supabaseUrl()) : null
  if (oldPath && before?.avatar_url !== url) {
    await supabase.storage.from('avatars').remove([oldPath])
  }

  revalidatePath('/', 'layout')
  revalidatePath('/profile')
  revalidatePath(`/players/${user.id}`)
  return { success: true }
}
