'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireClubOwner } from '@/lib/auth-guards'
import { validateBankAccount } from '@/lib/vietqr'
import { tr } from '@/lib/localize-error'

/**
 * Tài khoản ngân hàng nhận cọc cho kênh chuyển khoản thủ công. Ghi bằng service_role sau khi đã kiểm tra
 * người gọi là chủ cụm sân (người dùng không có quyền ghi trực tiếp vào bảng và cờ accepts_manual_transfer).
 */
export async function saveBankAccount(
  clubId: string,
  input: { bin?: string; accountNumber?: string; accountName?: string }
): Promise<{ error?: string; success?: boolean }> {
  const auth = await requireClubOwner(clubId)
  if ('error' in auth) return { error: await tr(auth.error) }

  const parsed = validateBankAccount(input)
  if (!parsed.ok) return { error: await tr(parsed.error) }

  const admin = createAdminClient()
  const { error } = await admin.from('club_bank_accounts').upsert({
    club_id: clubId,
    bank_bin: parsed.value.bin,
    account_number: parsed.value.accountNumber,
    account_name: parsed.value.accountName,
  })
  if (error) {
    console.error('saveBankAccount lỗi', error)
    return { error: await tr('Không thể lưu tài khoản. Vui lòng thử lại.') }
  }
  await admin.from('clubs').update({ accepts_manual_transfer: true }).eq('id', clubId)

  revalidatePath('/owner/payments')
  revalidatePath(`/clubs/${clubId}`)
  return { success: true }
}

export async function removeBankAccount(clubId: string): Promise<{ error?: string; success?: boolean }> {
  const auth = await requireClubOwner(clubId)
  if ('error' in auth) return { error: await tr(auth.error) }

  const admin = createAdminClient()
  const { error } = await admin.from('club_bank_accounts').delete().eq('club_id', clubId)
  if (error) {
    console.error('removeBankAccount lỗi', error)
    return { error: await tr('Không thể gỡ tài khoản. Vui lòng thử lại.') }
  }
  await admin.from('clubs').update({ accepts_manual_transfer: false }).eq('id', clubId)

  revalidatePath('/owner/payments')
  revalidatePath(`/clubs/${clubId}`)
  return { success: true }
}
