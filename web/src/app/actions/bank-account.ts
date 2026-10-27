'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { removeBankAccountForOwner, saveBankAccountForOwner } from '@/lib/owner-catalog'
import { tr } from '@/lib/localize-error'

/**
 * Tài khoản ngân hàng nhận cọc cho kênh chuyển khoản thủ công. Logic nằm ở lib/owner-catalog để app mobile dùng chung;
 * ghi bằng service_role sau khi đã kiểm tra người gọi là chủ cụm sân (người dùng không có quyền ghi trực tiếp
 * vào bảng và cờ accepts_manual_transfer).
 */
export async function saveBankAccount(
  clubId: string,
  input: { bin?: string; accountNumber?: string; accountName?: string }
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: await tr('Vui lòng đăng nhập') }

  const result = await saveBankAccountForOwner(supabase, createAdminClient(), user, clubId, input)
  if ('error' in result) return { error: await tr(result.error) }

  revalidatePath('/owner/payments')
  revalidatePath('/owner/clubs')
  revalidatePath('/clubs')
  revalidatePath(`/clubs/${clubId}`)
  return { success: true }
}

export async function removeBankAccount(clubId: string): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: await tr('Vui lòng đăng nhập') }

  const result = await removeBankAccountForOwner(supabase, createAdminClient(), user, clubId)
  if ('error' in result) return { error: await tr(result.error) }

  revalidatePath('/owner/payments')
  revalidatePath('/owner/clubs')
  revalidatePath('/clubs')
  revalidatePath(`/clubs/${clubId}`)
  return { success: true }
}
