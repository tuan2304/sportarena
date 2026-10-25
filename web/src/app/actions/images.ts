'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireClubOwner } from '@/lib/auth-guards'
import { isOwnImageUrl, ownImagePath, validateClubImages } from '@/lib/image-upload'
import { tr } from '@/lib/localize-error'

function supabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
}

/**
 * Lưu danh sách ảnh của cụm sân sau khi trình duyệt đã tải lên Storage. Chỉ nhận URL nằm trong thư mục của chính
 * cụm sân (hoặc ảnh đã có sẵn), và dọn khỏi Storage những ảnh vừa bị gỡ để không để lại file mồ côi.
 */
export async function setClubImages(clubId: string, images: unknown): Promise<{ error?: string; success?: boolean; images?: string[] }> {
  const auth = await requireClubOwner(clubId)
  if ('error' in auth) return { error: await tr(auth.error) }

  const supabase = await createClient()
  const { data: club } = await supabase.from('clubs').select('images').eq('id', clubId).maybeSingle()
  if (!club) return { error: await tr('Không tìm thấy cụm sân') }
  const current = club.images ?? []

  const parsed = validateClubImages(clubId, images, current, supabaseUrl())
  if (!parsed.ok) return { error: await tr(parsed.error) }

  const { error } = await supabase.from('clubs').update({ images: parsed.images }).eq('id', clubId)
  if (error) {
    console.error('setClubImages lỗi', error)
    return { error: await tr('Không thể lưu ảnh. Vui lòng thử lại.') }
  }

  const removed = current
    .filter((url) => !parsed.images.includes(url))
    .map((url) => ownImagePath('club-images', clubId, url, supabaseUrl()))
    .filter((path): path is string => path !== null)
  if (removed.length > 0) {
    const { error: rmError } = await supabase.storage.from('club-images').remove(removed)
    if (rmError) console.warn('setClubImages: không xóa được file cũ', rmError.message)
  }

  revalidatePath('/owner/clubs')
  revalidatePath('/clubs')
  revalidatePath(`/clubs/${clubId}`)
  return { success: true, images: parsed.images }
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
