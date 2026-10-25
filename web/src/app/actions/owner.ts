'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  createClubForOwner,
  createCourtForOwner,
  createPricingRuleForOwner,
  deleteClubForOwner,
  deleteCourtForOwner,
  deletePricingRuleForOwner,
  setCourtActiveForOwner,
  updateClubLocationForOwner,
} from '@/lib/owner-catalog'
import { isOwnerBookingStatus, updateBookingStatusForOwner } from '@/lib/owner-booking'
import { tr } from '@/lib/localize-error'

export async function createClub(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: await tr('Bạn cần đăng nhập để thực hiện tác vụ này') }
  }

  const amenitiesRaw = formData.get('amenities') as string
  const result = await createClubForOwner(supabase, user, {
    name: formData.get('name') as string,
    address: formData.get('address') as string,
    description: formData.get('description') as string,
    city: formData.get('city') as string,
    district: formData.get('district') as string,
    openTime: formData.get('openTime') as string,
    closeTime: formData.get('closeTime') as string,
    amenities: amenitiesRaw ? amenitiesRaw.split(',').map((item) => item.trim()).filter(Boolean) : undefined,
    // Toạ độ (tùy chọn) do bộ chọn vị trí gửi lên; bỏ trống thì khách thấy bản đồ tìm theo địa chỉ
    latitude: formData.get('latitude') as string | null,
    longitude: formData.get('longitude') as string | null,
  })
  if ('error' in result) return { error: await tr(result.error) }

  revalidatePath('/owner/clubs')
  revalidatePath('/owner/dashboard')
  return { success: true, club: result.club }
}

export async function createCourt(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: await tr('Bạn cần đăng nhập') }
  }

  const result = await createCourtForOwner(supabase, {
    clubId: formData.get('clubId') as string,
    name: formData.get('name') as string,
    sportType: formData.get('sportType') as string,
    surfaceType: formData.get('surfaceType') as string,
    basePricePerHour: Number(formData.get('basePricePerHour')),
    depositPercentage: Number(formData.get('depositPercentage')),
  })
  if ('error' in result) return { error: await tr(result.error) }

  revalidatePath('/owner/clubs')
  revalidatePath('/owner/dashboard')
  revalidatePath('/owner/schedule')
  return { success: true, court: result.court }
}

export async function createPricingRule(formData: FormData) {
  const supabase = await createClient()
  const result = await createPricingRuleForOwner(supabase, {
    courtId: formData.get('courtId') as string | null,
    name: formData.get('name') as string | null,
    startTime: formData.get('startTime') as string | null,
    endTime: formData.get('endTime') as string | null,
    pricePerHour: Number(formData.get('pricePerHour')),
  })
  if ('error' in result) return { error: await tr(result.error) }

  revalidatePath('/owner/pricing')
  return { success: true }
}

export async function updateBookingStatus(
  bookingId: string,
  status: 'confirmed' | 'cancelled' | 'completed'
): Promise<{ error?: string; success?: boolean; refundAmount?: number }> {
  if (!isOwnerBookingStatus(status)) {
    return { error: await tr('Trạng thái không hợp lệ') }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: await tr('Vui lòng đăng nhập') }

  const result = await updateBookingStatusForOwner(supabase, user, bookingId, status)
  if ('error' in result) return { error: await tr(result.error) }
  return result
}

export async function toggleCourtStatus(courtId: string, isActive: boolean) {
  const supabase = await createClient()
  const result = await setCourtActiveForOwner(supabase, courtId, isActive)
  if ('error' in result) return { error: await tr(result.error) }

  revalidatePath('/owner/clubs')
  revalidatePath('/owner/schedule')
  return { success: true }
}

export async function deleteCourt(courtId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: await tr('Bạn cần đăng nhập') }

  const result = await deleteCourtForOwner(supabase, createAdminClient(), user, courtId)
  if ('error' in result) return { error: await tr(result.error) }

  revalidatePath('/owner/clubs')
  revalidatePath('/owner/schedule')
  revalidatePath('/owner/pricing')
  return { success: true }
}

export async function deleteClub(clubId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: await tr('Vui lòng đăng nhập') }

  const result = await deleteClubForOwner(supabase, createAdminClient(), user, clubId)
  if ('error' in result) return { error: await tr(result.error) }

  revalidatePath('/owner/clubs')
  revalidatePath('/owner/dashboard')
  revalidatePath('/owner/schedule')
  return { success: true }
}

export async function deletePricingRule(ruleId: string) {
  const supabase = await createClient()
  const result = await deletePricingRuleForOwner(supabase, ruleId)
  if ('error' in result) return { error: await tr(result.error) }

  revalidatePath('/owner/pricing')
  return { success: true }
}

/** Ghim hoặc xóa vị trí bản đồ của cụm sân (lat/lng = null để xóa). */
export async function updateClubLocation(clubId: string, lat: number | null, lng: number | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: await tr('Vui lòng đăng nhập') }

  const result = await updateClubLocationForOwner(supabase, user, clubId, lat, lng)
  if ('error' in result) return { error: await tr(result.error) }

  revalidatePath('/owner/clubs')
  revalidatePath('/clubs')
  revalidatePath(`/clubs/${clubId}`)
  return { success: true }
}
