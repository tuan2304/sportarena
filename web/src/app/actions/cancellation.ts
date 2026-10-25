'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireClubOwner } from '@/lib/auth-guards'
import { cancelBookingAsPlayer, markRefundedAsOwner, type PlayerCancelResult } from '@/lib/booking-cancel'
import { claimTransferForUser } from '@/lib/manual-payment'
import { parseFreeCancelHours } from '@/lib/cancellation'
import { tr, trResult } from '@/lib/localize-error'

function revalidateAll(bookingId?: string) {
  revalidatePath('/my-bookings')
  revalidatePath('/owner/schedule')
  revalidatePath('/owner/refunds')
  revalidatePath('/owner/dashboard')
  if (bookingId) revalidatePath(`/bookings/${bookingId}`)
}

/** Người chơi tự hủy đơn của mình. Số tiền hoàn do quy tắc của cụm sân quyết định (xem lib/cancellation.ts). */
export async function cancelBooking(bookingId: string): Promise<PlayerCancelResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: await tr('Vui lòng đăng nhập') }

  const result = await cancelBookingAsPlayer(user.id, bookingId)
  if (result.success) revalidateAll(bookingId)
  return trResult(result)
}

/** Chủ sân xác nhận đã chuyển trả tiền cọc cho khách. */
export async function markBookingRefunded(bookingId: string): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: await tr('Vui lòng đăng nhập') }

  const result = await markRefundedAsOwner(user.id, bookingId)
  if (result.success) revalidateAll(bookingId)
  return trResult(result)
}

/** Chủ sân đặt số giờ hủy miễn phí của cụm sân. Quyền ghi do RLS kiểm tra thêm một lớp nữa. */
export async function updateCancellationPolicy(clubId: string, hoursRaw: unknown): Promise<{ error?: string; success?: boolean }> {
  const auth = await requireClubOwner(clubId)
  if ('error' in auth) return { error: await tr(auth.error) }

  const parsed = parseFreeCancelHours(hoursRaw)
  if (!parsed.ok) return { error: await tr(parsed.error) }

  const supabase = await createClient()
  const { error } = await supabase.from('clubs').update({ free_cancel_hours: parsed.hours }).eq('id', clubId)
  if (error) {
    console.error('updateCancellationPolicy lỗi', error)
    return { error: await tr('Không thể lưu chính sách. Vui lòng thử lại.') }
  }

  revalidatePath('/owner/payments')
  revalidatePath(`/clubs/${clubId}`)
  return { success: true }
}

/** Khách báo đã chuyển khoản cho đơn thanh toán thủ công. */
export async function claimManualTransfer(bookingId: string): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: await tr('Vui lòng đăng nhập') }

  const result = await claimTransferForUser(user.id, bookingId)
  if (result.success) revalidateAll(bookingId)
  return trResult(result)
}
