import * as ImagePicker from 'expo-image-picker'
import { supabase } from './supabase'
import { apiPut } from './api'
import { translate } from '../i18n'
import { MAX_CLUB_IMAGE_BYTES, imagePath, publicImageUrl, validateImageFile } from '../shared/image-upload'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''

export type ClubImageResult = { ok: true; url: string } | { ok: false; error: string; cancelled?: boolean }

/**
 * Chọn một ảnh từ thư viện và tải lên bucket `club-images/<club_id>/` bằng phiên của chủ sân (quyền ghi do chính sách
 * bucket quyết định). Chưa lưu vào cụm sân: người dùng sắp xếp xong mới gọi saveClubImages. Cùng quy tắc với web.
 */
export async function pickAndUploadClubImage(clubId: string): Promise<ClubImageResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) return { ok: false, error: translate('avatar.permission') }

  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.8 })
  if (picked.canceled || !picked.assets[0]) return { ok: false, error: '', cancelled: true }

  const asset = picked.assets[0]
  const type = asset.mimeType ?? 'image/jpeg'

  let body: ArrayBuffer
  try {
    body = await (await fetch(asset.uri)).arrayBuffer()
  } catch {
    return { ok: false, error: translate('avatar.unreadable') }
  }

  const problem = validateImageFile({ type, size: body.byteLength }, MAX_CLUB_IMAGE_BYTES)
  if (problem) return { ok: false, error: problem }

  const path = imagePath(clubId, globalThis.crypto?.randomUUID?.() ?? fallbackUuid(), type)
  if (!path) return { ok: false, error: translate('avatar.format') }

  const { error } = await supabase.storage.from('club-images').upload(path, body, { contentType: type, cacheControl: '31536000', upsert: false })
  if (error) return { ok: false, error: translate('avatar.uploadFailed') }

  return { ok: true, url: publicImageUrl('club-images', path, SUPABASE_URL) }
}

/** Lưu danh sách ảnh (ảnh đầu là ảnh bìa). Máy chủ chỉ nhận ảnh trong kho của cụm sân và dọn file bị gỡ. */
export function saveClubImages(clubId: string, images: string[]) {
  return apiPut<{ images: string[] }>(`/api/mobile/owner/clubs/${clubId}/images`, { images })
}

// Hermes không phải bản nào cũng có crypto.randomUUID
function fallbackUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16)
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}
