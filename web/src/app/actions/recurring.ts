'use server'

import { createClient } from '@/lib/supabase/server'
import { decideRecurring, endRecurring, requestRecurring } from '@/lib/recurring-service'
import type { RecurringInput } from '@/lib/recurring'
import { tr } from '@/lib/localize-error'

type ActionResult = { error?: string; success?: boolean }

async function currentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/** Người chơi gửi yêu cầu đặt lịch cố định hằng tuần; chủ sân duyệt sau. */
export async function requestRecurringBooking(input: RecurringInput): Promise<ActionResult> {
  const user = await currentUser()
  if (!user) return { error: await tr('Vui lòng đăng nhập') }

  const result = await requestRecurring(user.id, input)
  if ('error' in result) return { error: await tr(result.error) }
  return { success: true }
}

/** Người chơi kết thúc lịch cố định của mình. */
export async function endMyRecurring(seriesId: string): Promise<ActionResult> {
  const user = await currentUser()
  if (!user) return { error: await tr('Vui lòng đăng nhập') }

  const result = await endRecurring({ id: user.id, as: 'player' }, seriesId)
  if ('error' in result) return { error: await tr(result.error) }
  return { success: true }
}

/** Chủ sân duyệt hoặc từ chối yêu cầu lịch cố định. */
export async function decideRecurringRequest(seriesId: string, decision: 'approve' | 'reject'): Promise<ActionResult> {
  const user = await currentUser()
  if (!user) return { error: await tr('Vui lòng đăng nhập') }
  if (decision !== 'approve' && decision !== 'reject') return { error: await tr('Trạng thái không hợp lệ') }

  const result = await decideRecurring(user.id, seriesId, decision)
  if ('error' in result) return { error: await tr(result.error) }
  return { success: true }
}

/** Chủ sân kết thúc một lịch cố định đang chạy; mọi buổi sắp tới bị hủy. */
export async function endRecurringAsOwner(seriesId: string): Promise<ActionResult> {
  const user = await currentUser()
  if (!user) return { error: await tr('Vui lòng đăng nhập') }

  const result = await endRecurring({ id: user.id, as: 'owner' }, seriesId)
  if ('error' in result) return { error: await tr(result.error) }
  return { success: true }
}
