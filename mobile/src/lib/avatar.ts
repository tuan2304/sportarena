import * as ImagePicker from 'expo-image-picker'
import { supabase } from './supabase'
import { translate } from '../i18n'
import { MAX_AVATAR_BYTES, imagePath, ownImagePath, publicImageUrl, validateImageFile } from '../shared/image-upload'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''

export type AvatarResult = { ok: true; url: string | null } | { ok: false; error: string; cancelled?: boolean }

/**
 * Chọn ảnh từ thư viện, cắt vuông rồi tải lên bucket `avatars/<user_id>/` bằng phiên đăng nhập của người dùng
 * (quyền ghi do chính sách bucket quyết định), sau đó lưu URL vào hồ sơ và dọn ảnh cũ. Cùng quy tắc với web.
 */
export async function pickAndUploadAvatar(userId: string, previousUrl: string | null): Promise<AvatarResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) {
    return { ok: false, error: translate('avatar.permission') }
  }

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  })
  if (picked.canceled || !picked.assets[0]) return { ok: false, error: '', cancelled: true }

  const asset = picked.assets[0]
  const type = asset.mimeType ?? 'image/jpeg'

  let body: ArrayBuffer
  try {
    body = await (await fetch(asset.uri)).arrayBuffer()
  } catch {
    return { ok: false, error: translate('avatar.unreadable') }
  }

  const problem = validateImageFile({ type, size: body.byteLength }, MAX_AVATAR_BYTES)
  if (problem) return { ok: false, error: problem }

  const path = imagePath(userId, globalThis.crypto?.randomUUID?.() ?? fallbackUuid(), type)
  if (!path) return { ok: false, error: translate('avatar.format') }

  const { error: uploadError } = await supabase.storage.from('avatars').upload(path, body, {
    contentType: type,
    cacheControl: '31536000',
    upsert: false,
  })
  if (uploadError) return { ok: false, error: translate('avatar.uploadFailed') }

  const url = publicImageUrl('avatars', path, SUPABASE_URL)
  const saved = await saveAvatarUrl(userId, url, previousUrl)
  return saved.ok ? { ok: true, url } : saved
}

export async function removeAvatar(userId: string, previousUrl: string | null): Promise<AvatarResult> {
  const saved = await saveAvatarUrl(userId, null, previousUrl)
  return saved.ok ? { ok: true, url: null } : saved
}

async function saveAvatarUrl(userId: string, url: string | null, previousUrl: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId)
  if (error) return { ok: false, error: translate('avatar.saveFailed') }

  // Xóa file cũ trong kho của chính mình để không tích tụ; lỗi dọn dẹp không làm hỏng việc đổi ảnh
  const oldPath = previousUrl && previousUrl !== url ? ownImagePath('avatars', userId, previousUrl, SUPABASE_URL) : null
  if (oldPath) await supabase.storage.from('avatars').remove([oldPath])
  return { ok: true }
}

// Hermes không phải bản nào cũng có crypto.randomUUID
function fallbackUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16)
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}
