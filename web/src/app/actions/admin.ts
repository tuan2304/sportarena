'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth-guards'
import { notifyUser } from '@/lib/notify'
import { DAYS_PER_MONTH } from '@/lib/billing'
import { formatDate } from '@/lib/format'
import { tr } from '@/lib/localize-error'

/** Cấp/gia hạn gói Pro thủ công (vd. chủ sân chuyển khoản trực tiếp, hoặc tặng thời gian dùng thử). */
export async function grantPlan(clubId: string, months: number): Promise<{ error?: string; success?: boolean }> {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: await tr(auth.error) }
  if (!Number.isInteger(months) || months < 1 || months > 24) return { error: await tr('Số tháng phải từ 1 đến 24') }

  const admin = createAdminClient()
  const { data: club } = await admin.from('clubs').select('owner_id, name, plan_until').eq('id', clubId).maybeSingle()
  if (!club) return { error: await tr('Không tìm thấy cụm sân') }

  const base = Math.max(Date.now(), club.plan_until ? new Date(club.plan_until).getTime() : 0)
  const until = new Date(base + months * DAYS_PER_MONTH * 24 * 60 * 60 * 1000)

  const { error } = await admin.from('clubs').update({ plan: 'pro', plan_until: until.toISOString() }).eq('id', clubId)
  if (error) return { error: await tr('Không cập nhật được gói') }

  await notifyUser({
    userId: club.owner_id,
    title: 'Gói Pro đã được kích hoạt',
    message: `Cụm sân "${club.name}" dùng gói Pro đến ${formatDate(until)}.`,
    type: 'system',
    link: '/owner/billing',
  })

  revalidatePath('/admin/finance')
  revalidatePath('/owner/billing')
  return { success: true }
}

export async function setFreePlan(clubId: string): Promise<{ error?: string; success?: boolean }> {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: await tr(auth.error) }

  const admin = createAdminClient()
  const { error } = await admin.from('clubs').update({ plan: 'free', plan_until: null }).eq('id', clubId)
  if (error) return { error: await tr('Không cập nhật được gói') }

  revalidatePath('/admin/finance')
  revalidatePath('/owner/billing')
  return { success: true }
}
