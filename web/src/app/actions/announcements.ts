'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth-guards'
import { validateAnnouncement } from '@/lib/support'
import { pushAnnouncement } from '@/lib/notify'
import { tr } from '@/lib/localize-error'

/** Gửi thông báo cập nhật tới người dùng: mỗi người nhận một thông báo trong chuông. Chỉ quản trị mới gọi được. */
export async function sendAnnouncement(input: {
  title: string
  body: string
  kind: string
  audience: string
  link?: string
}): Promise<{ error?: string; sent?: number }> {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: await tr(auth.error) }

  const parsed = validateAnnouncement(input)
  if (!parsed.ok) return { error: await tr(parsed.error) }

  const admin = createAdminClient()
  const { data: row, error: insertError } = await admin
    .from('announcements')
    .insert({ ...parsed.value, created_by: auth.user.id })
    .select('id')
    .single()
  if (insertError || !row) {
    console.error('sendAnnouncement: lỗi lưu', insertError)
    return { error: await tr('Không lưu được thông báo. Vui lòng thử lại.') }
  }

  const { data: sent, error: sendError } = await admin.rpc('broadcast_announcement', { p_id: row.id })
  if (sendError) {
    console.error('sendAnnouncement: lỗi gửi', sendError)
    // Không để lại bản ghi chưa gửi
    await admin.from('announcements').delete().eq('id', row.id)
    return { error: await tr('Không gửi được thông báo. Vui lòng thử lại.') }
  }

  await pushAnnouncement(parsed.value.audience, {
    title: parsed.value.title,
    message: parsed.value.body,
    link: parsed.value.link,
  })

  revalidatePath('/admin/announcements')
  return { sent: sent ?? 0 }
}
