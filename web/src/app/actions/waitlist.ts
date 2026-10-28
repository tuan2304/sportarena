'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { joinWaitlist, leaveWaitlist } from '@/lib/waitlist'
import { tr } from '@/lib/localize-error'

/** Đăng ký chờ một khung giờ đang kín; được báo khi có người hủy hoặc hết hạn giữ chỗ. */
export async function joinSlotWaitlist(
  courtId: string,
  startTimeISO: string,
  endTimeISO: string
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: await tr('Vui lòng đăng nhập') }

  const result = await joinWaitlist(user.id, courtId, startTimeISO, endTimeISO)
  if ('error' in result) return { error: await tr(result.error) }
  revalidatePath('/my-bookings')
  return { success: true }
}

export async function leaveSlotWaitlist(entryId: string): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: await tr('Vui lòng đăng nhập') }

  const result = await leaveWaitlist(user.id, entryId)
  if ('error' in result) return { error: await tr(result.error) }
  revalidatePath('/my-bookings')
  return { success: true }
}
