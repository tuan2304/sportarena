import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { translateServerMessage } from '@/i18n/server-messages'
import { pushToAudience, pushToUsers, type PushPayload } from '@/lib/push'
import type { NotificationType } from '@/types/database'

/**
 * Gửi thông báo đẩy sau khi đã trả lời người dùng, để việc gọi Expo không làm chậm thao tác chính.
 * Ngoài phạm vi một request (script, test) thì `after` không dùng được nên chạy ngay.
 */
export async function pushAfterResponse(task: () => Promise<void>): Promise<void> {
  try {
    after(task)
  } catch {
    await task()
  }
}

export function pushAnnouncement(audience: 'all' | 'owners' | 'players', payload: PushPayload) {
  return pushAfterResponse(() => pushToAudience(audience, payload))
}

/**
 * Tạo thông báo cho một người dùng. Đặt ở lib (không phải 'use server') để KHÔNG bị lộ thành
 * endpoint công khai: nếu là Server Action, ai cũng gọi được và spam thông báo cho người khác.
 */
/**
 * Bản tiếng Anh của thông báo, dịch từ câu tiếng Việt gốc bằng bảng ở i18n/server-messages.ts.
 * Trả null nếu không có bản dịch (khi đó người dùng tiếng Anh vẫn thấy bản gốc).
 */
export function englishCopy(title: string, message: string): { title: string; message: string } | null {
  const en = { title: translateServerMessage(title, 'en'), message: translateServerMessage(message, 'en') }
  return en.title === title && en.message === message ? null : en
}

export async function notifyUser(params: {
  userId: string
  title: string
  message: string
  type?: NotificationType
  link?: string
  /** Dữ liệu và nhóm nút hành động cho thông báo đẩy (không lưu vào chuông) */
  push?: { categoryId?: string; data?: Record<string, string> }
}) {
  const admin = createAdminClient()
  const en = englishCopy(params.title, params.message)
  const { error } = await admin.from('notifications').insert({
    user_id: params.userId,
    title: params.title,
    message: params.message,
    title_en: en?.title ?? null,
    message_en: en?.message ?? null,
    type: params.type || 'system',
    link: params.link || null,
    is_read: false,
  })

  if (error) {
    console.error('Không tạo được thông báo:', error)
    return false
  }
  await pushAfterResponse(() => pushToUsers([params.userId], { title: params.title, message: params.message, link: params.link, en, ...params.push }))
  return true
}

/** Báo cho mọi quản trị viên (vd. có phiếu hỗ trợ mới hoặc khách vừa trả lời). */
export async function notifyAdmins(params: { title: string; message: string; link?: string }) {
  const admin = createAdminClient()
  const { data: admins, error: listError } = await admin.from('profiles').select('id').eq('role', 'admin')
  if (listError || !admins?.length) {
    if (listError) console.error('Không lấy được danh sách quản trị viên:', listError)
    return false
  }

  const en = englishCopy(params.title, params.message)
  const { error } = await admin.from('notifications').insert(
    admins.map((a) => ({
      user_id: a.id,
      title: params.title,
      message: params.message,
      title_en: en?.title ?? null,
      message_en: en?.message ?? null,
      type: 'system' as const,
      link: params.link ?? null,
      is_read: false,
    }))
  )
  if (error) {
    console.error('Không tạo được thông báo cho quản trị viên:', error)
    return false
  }
  await pushAfterResponse(() =>
    pushToUsers(admins.map((a) => a.id), { title: params.title, message: params.message, link: params.link, en })
  )
  return true
}
