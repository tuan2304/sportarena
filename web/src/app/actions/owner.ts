'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkCourtAllowance } from '@/lib/club-limits'
import { getClubDeletionBlocker, getCourtDeletionBlocker } from '@/lib/deletion-guards'
import { requireClubOwner } from '@/lib/auth-guards'
import { isValidLatLng } from '@/lib/maps'
import { validatePricingRule } from '@/lib/pricing-rule'
import { isOwnerBookingStatus, updateBookingStatusForOwner } from '@/lib/owner-booking'
import { tr } from '@/lib/localize-error'

export async function createClub(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: await tr('Bạn cần đăng nhập để thực hiện tác vụ này') }
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'owner' && profile?.role !== 'admin') {
    return { error: await tr('Chỉ tài khoản chủ sân mới tạo được cụm sân') }
  }

  const name = formData.get('name') as string
  const address = formData.get('address') as string
  const description = formData.get('description') as string
  const city = formData.get('city') as string || 'Hồ Chí Minh'
  const district = formData.get('district') as string
  const openTime = formData.get('openTime') as string || '06:00:00'
  const closeTime = formData.get('closeTime') as string || '23:00:00'
  const amenitiesRaw = formData.get('amenities') as string

  // Toạ độ (tùy chọn) do bộ chọn vị trí gửi lên; bỏ trống thì khách thấy bản đồ tìm theo địa chỉ
  const latRaw = String(formData.get('latitude') ?? '').trim()
  const lngRaw = String(formData.get('longitude') ?? '').trim()
  let latitude: number | null = null
  let longitude: number | null = null
  if (latRaw || lngRaw) {
    latitude = Number(latRaw)
    longitude = Number(lngRaw)
    if (!isValidLatLng(latitude, longitude)) {
      return { error: await tr('Toạ độ vị trí không hợp lệ') }
    }
  }

  const amenities = amenitiesRaw
    ? amenitiesRaw.split(',').map((item) => item.trim()).filter(Boolean)
    : ['wifi', 'parking', 'shower']

  if (!name || !address) {
    return { error: await tr('Vui lòng nhập tên cụm sân và địa chỉ') }
  }

  const { data, error } = await supabase.from('clubs').insert({
    owner_id: user.id,
    name,
    address,
    description,
    city,
    district,
    open_time: openTime,
    close_time: closeTime,
    amenities,
    latitude,
    longitude,
    images: ['https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&q=80&w=800'],
  }).select().single()

  if (error) {
    return { error: await tr(error.message) }
  }

  revalidatePath('/owner/clubs')
  revalidatePath('/owner/dashboard')
  return { success: true, club: data }
}

export async function createCourt(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: await tr('Bạn cần đăng nhập') }
  }

  const clubId = formData.get('clubId') as string
  const name = formData.get('name') as string
  const sportType = formData.get('sportType') as string
  const surfaceType = formData.get('surfaceType') as string || 'Tiêu chuẩn'
  const basePrice = Number(formData.get('basePricePerHour')) || 150000
  const depositPercentage = Number(formData.get('depositPercentage')) || 30

  if (!clubId || !name || !sportType) {
    return { error: await tr('Vui lòng điền đủ thông tin sân con') }
  }

  const allowance = await checkCourtAllowance(supabase, clubId)
  if (!allowance.allowed) {
    return { error: await tr(allowance.message) }
  }

  const { data, error } = await supabase.from('courts').insert({
    club_id: clubId,
    name,
    sport_type: sportType,
    surface_type: surfaceType,
    base_price_per_hour: basePrice,
    deposit_percentage: depositPercentage,
  }).select().single()

  if (error) {
    return { error: await tr(error.message) }
  }

  revalidatePath('/owner/clubs')
  revalidatePath('/owner/dashboard')
  revalidatePath('/owner/schedule')
  return { success: true, court: data }
}

export async function createPricingRule(formData: FormData) {
  const supabase = await createClient()
  const parsed = validatePricingRule({
    courtId: formData.get('courtId') as string | null,
    name: formData.get('name') as string | null,
    startTime: formData.get('startTime') as string | null,
    endTime: formData.get('endTime') as string | null,
    pricePerHour: Number(formData.get('pricePerHour')),
  })
  if (!parsed.ok) return { error: await tr(parsed.error) }
  const { courtId, name, startTime, endTime, pricePerHour } = parsed.value

  // Quyền ghi được RLS kiểm tra: chỉ chủ của cụm sân chứa sân này mới chèn được
  const { error } = await supabase.from('court_pricing_rules').insert({
    court_id: courtId,
    name,
    start_time: startTime,
    end_time: endTime,
    price_per_hour: pricePerHour,
    days_of_week: [1, 2, 3, 4, 5, 6, 0],
  })

  if (error) {
    return { error: await tr(error.message) }
  }

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

  if (isActive) {
    const { data: court } = await supabase.from('courts').select('club_id').eq('id', courtId).maybeSingle()
    if (!court) return { error: await tr('Không tìm thấy sân con') }
    const allowance = await checkCourtAllowance(supabase, court.club_id, { excludeCourtId: courtId })
    if (!allowance.allowed) return { error: await tr(allowance.message) }
  }
  const { error } = await supabase
    .from('courts')
    .update({ is_active: isActive })
    .eq('id', courtId)

  if (error) {
    return { error: await tr(error.message) }
  }

  revalidatePath('/owner/clubs')
  revalidatePath('/owner/schedule')
  return { success: true }
}

export async function deleteCourt(courtId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: await tr('Bạn cần đăng nhập') }

  // Sân con công khai ai cũng đọc được nên phải kiểm tra rõ ràng đây là chủ cụm sân
  const { data: court } = await supabase.from('courts').select('id, club:clubs ( owner_id )').eq('id', courtId).maybeSingle()
  const ownerId = (court?.club as unknown as { owner_id: string } | null)?.owner_id
  if (!court || ownerId !== user.id) return { error: await tr('Bạn không có quyền xóa sân con này') }

  const blocker = await getCourtDeletionBlocker(createAdminClient(), courtId)
  if (blocker) return { error: await tr(blocker) }

  const { error } = await supabase
    .from('courts')
    .delete()
    .eq('id', courtId)

  if (error) {
    return { error: await tr(error.message) }
  }

  revalidatePath('/owner/clubs')
  revalidatePath('/owner/schedule')
  revalidatePath('/owner/pricing')
  return { success: true }
}

export async function deleteClub(clubId: string) {
  const auth = await requireClubOwner(clubId)
  if ('error' in auth) return { error: await tr(auth.error) }

  const blocker = await getClubDeletionBlocker(createAdminClient(), clubId)
  if (blocker) return { error: await tr(blocker) }

  const supabase = await createClient()
  const { error } = await supabase
    .from('clubs')
    .delete()
    .eq('id', clubId)

  if (error) {
    return { error: await tr(error.message) }
  }

  revalidatePath('/owner/clubs')
  revalidatePath('/owner/dashboard')
  revalidatePath('/owner/schedule')
  return { success: true }
}

export async function deletePricingRule(ruleId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('court_pricing_rules')
    .delete()
    .eq('id', ruleId)

  if (error) {
    return { error: await tr(error.message) }
  }

  revalidatePath('/owner/pricing')
  return { success: true }
}


/** Ghim hoặc xóa vị trí bản đồ của cụm sân (lat/lng = null để xóa). */
export async function updateClubLocation(clubId: string, lat: number | null, lng: number | null) {
  const auth = await requireClubOwner(clubId)
  if ('error' in auth) return { error: await tr(auth.error) }

  const clearing = lat === null && lng === null
  if (!clearing && (lat === null || lng === null || !isValidLatLng(lat, lng))) {
    return { error: await tr('Toạ độ vị trí không hợp lệ') }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('clubs').update({ latitude: lat, longitude: lng }).eq('id', clubId)
  if (error) {
    console.error('updateClubLocation lỗi', error)
    return { error: await tr('Không lưu được vị trí. Vui lòng thử lại.') }
  }

  revalidatePath('/owner/clubs')
  revalidatePath('/clubs')
  revalidatePath(`/clubs/${clubId}`)
  return { success: true }
}
