import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { checkCourtAllowance } from '@/lib/club-limits'
import { getClubDeletionBlocker, getCourtDeletionBlocker } from '@/lib/deletion-guards'
import { ownImagePath, validateClubImages } from '@/lib/image-upload'
import { isValidLatLng } from '@/lib/maps'
import { validatePricingRule, type PricingRuleInput } from '@/lib/pricing-rule'

/**
 * Tạo cụm sân, sân con và khung giá của chủ sân. Dùng chung cho server action của web và API của app mobile.
 * Lỗi trả về bằng tiếng Việt gốc; nơi gọi tự dịch (tr / errorResponse).
 */
type Client = SupabaseClient<Database>
type Failure = { error: string }

export const CLUB_DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&q=80&w=800'

export interface ClubInput {
  name?: string | null
  address?: string | null
  description?: string | null
  city?: string | null
  district?: string | null
  openTime?: string | null
  closeTime?: string | null
  amenities?: string[]
  /** Toạ độ dạng chuỗi như form gửi lên; bỏ trống cả hai thì không ghim vị trí */
  latitude?: string | number | null
  longitude?: string | number | null
}

export async function createClubForOwner(supabase: Client, user: User, input: ClubInput) {
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'owner' && profile?.role !== 'admin') {
    return { error: 'Chỉ tài khoản chủ sân mới tạo được cụm sân' } as Failure
  }

  const latRaw = String(input.latitude ?? '').trim()
  const lngRaw = String(input.longitude ?? '').trim()
  let latitude: number | null = null
  let longitude: number | null = null
  if (latRaw || lngRaw) {
    latitude = Number(latRaw)
    longitude = Number(lngRaw)
    if (!isValidLatLng(latitude, longitude)) return { error: 'Toạ độ vị trí không hợp lệ' } as Failure
  }

  const name = input.name?.trim()
  const address = input.address?.trim()
  if (!name || !address) return { error: 'Vui lòng nhập tên cụm sân và địa chỉ' } as Failure

  const { data, error } = await supabase
    .from('clubs')
    .insert({
      owner_id: user.id,
      name,
      address,
      description: input.description ?? undefined,
      city: input.city || 'Hồ Chí Minh',
      district: input.district ?? undefined,
      open_time: input.openTime || '06:00:00',
      close_time: input.closeTime || '23:00:00',
      amenities: input.amenities?.length ? input.amenities : ['wifi', 'parking', 'shower'],
      latitude,
      longitude,
      images: [CLUB_DEFAULT_IMAGE],
    })
    .select()
    .single()

  if (error) return { error: error.message } as Failure
  return { success: true as const, club: data }
}

export interface CourtInput {
  clubId?: string | null
  name?: string | null
  sportType?: string | null
  surfaceType?: string | null
  basePricePerHour?: number
  depositPercentage?: number
}

export async function createCourtForOwner(supabase: Client, input: CourtInput) {
  const name = input.name?.trim()
  if (!input.clubId || !name || !input.sportType) return { error: 'Vui lòng điền đủ thông tin sân con' } as Failure

  const allowance = await checkCourtAllowance(supabase, input.clubId)
  if (!allowance.allowed) return { error: allowance.message ?? 'Không thêm được sân con' } as Failure

  // Quyền ghi do RLS kiểm tra: chỉ chủ của cụm sân mới chèn được
  const { data, error } = await supabase
    .from('courts')
    .insert({
      club_id: input.clubId,
      name,
      sport_type: input.sportType,
      surface_type: input.surfaceType || 'Tiêu chuẩn',
      base_price_per_hour: input.basePricePerHour || 150000,
      deposit_percentage: input.depositPercentage || 30,
    })
    .select()
    .single()

  if (error) return { error: error.message } as Failure
  return { success: true as const, court: data }
}

export async function createPricingRuleForOwner(supabase: Client, input: PricingRuleInput) {
  const parsed = validatePricingRule(input)
  if (!parsed.ok) return { error: parsed.error } as Failure
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
  if (error) return { error: error.message } as Failure
  return { success: true as const }
}

export async function deletePricingRuleForOwner(supabase: Client, ruleId: string) {
  // RLS chỉ cho xóa khung giá thuộc cụm sân của mình; không dòng nào bị xóa nghĩa là không có hoặc không phải của mình
  const { data, error } = await supabase.from('court_pricing_rules').delete().eq('id', ruleId).select('id')
  if (error) return { error: error.message } as Failure
  if (!data || data.length === 0) return { error: 'Không tìm thấy khung giá' } as Failure
  return { success: true as const }
}

export async function updatePricingRuleForOwner(supabase: Client, ruleId: string, input: Omit<PricingRuleInput, 'courtId'>) {
  // courtId giữ nguyên nên chỉ mượn validatePricingRule để kiểm tra tên, giờ và giá
  const parsed = validatePricingRule({ ...input, courtId: ruleId })
  if (!parsed.ok) return { error: parsed.error } as Failure
  const { name, startTime, endTime, pricePerHour } = parsed.value

  const { data, error } = await supabase
    .from('court_pricing_rules')
    .update({ name, start_time: startTime, end_time: endTime, price_per_hour: pricePerHour })
    .eq('id', ruleId)
    .select('id')
  if (error) return { error: error.message } as Failure
  if (!data || data.length === 0) return { error: 'Không tìm thấy khung giá' } as Failure
  return { success: true as const }
}

export interface CourtPatch {
  name?: string
  surfaceType?: string
  basePricePerHour?: number
  depositPercentage?: number
  isActive?: boolean
}

/** Bật/tắt sân con. Bật lại phải còn trong giới hạn số sân của gói; quyền ghi do RLS kiểm tra. */
export async function setCourtActiveForOwner(supabase: Client, courtId: string, isActive: boolean) {
  if (isActive) {
    const { data: court } = await supabase.from('courts').select('club_id').eq('id', courtId).maybeSingle()
    if (!court) return { error: 'Không tìm thấy sân con' } as Failure
    const allowance = await checkCourtAllowance(supabase, court.club_id, { excludeCourtId: courtId })
    if (!allowance.allowed) return { error: allowance.message ?? 'Không bật được sân con' } as Failure
  }
  const { error } = await supabase.from('courts').update({ is_active: isActive }).eq('id', courtId)
  if (error) return { error: error.message } as Failure
  return { success: true as const }
}

/** Đổi tên, mặt sân, giá cơ bản, % cọc và/hoặc bật tắt một sân con của mình. */
export async function updateCourtForOwner(supabase: Client, user: User, courtId: string, patch: CourtPatch) {
  const owned = await ownedCourt(supabase, user, courtId, 'Bạn không có quyền sửa sân con này')
  if ('error' in owned) return owned

  const update: Database['public']['Tables']['courts']['Update'] = {}
  if (patch.name !== undefined) update.name = patch.name
  if (patch.surfaceType !== undefined) update.surface_type = patch.surfaceType
  if (patch.basePricePerHour !== undefined) update.base_price_per_hour = patch.basePricePerHour
  if (patch.depositPercentage !== undefined) update.deposit_percentage = patch.depositPercentage
  if (Object.keys(update).length > 0) {
    const { error } = await supabase.from('courts').update(update).eq('id', courtId)
    if (error) return { error: error.message } as Failure
  }

  if (patch.isActive !== undefined && patch.isActive !== owned.isActive) {
    const toggled = await setCourtActiveForOwner(supabase, courtId, patch.isActive)
    if ('error' in toggled) return toggled
  }
  return { success: true as const }
}

/** Sân con của chính mình, hoặc lỗi. Sân con công khai ai cũng đọc được nên phải so chủ cụm sân rõ ràng. */
async function ownedCourt(supabase: Client, user: User, courtId: string, denied: string) {
  const { data: court } = await supabase.from('courts').select('id, is_active, club:clubs ( owner_id )').eq('id', courtId).maybeSingle()
  const ownerId = (court?.club as unknown as { owner_id: string } | null)?.owner_id
  if (!court || ownerId !== user.id) return { error: denied } as Failure
  return { isActive: court.is_active }
}

/** Cụm sân của chính mình, hoặc lỗi. */
async function ownedClub(supabase: Client, user: User, clubId: string) {
  const { data: club } = await supabase.from('clubs').select('id, owner_id, images').eq('id', clubId).maybeSingle()
  if (!club || club.owner_id !== user.id) return { error: 'Bạn không phải chủ của cụm sân này' } as Failure
  return { images: club.images ?? [] }
}

/** Xóa sân con, chỉ khi chưa có đơn hay giao dịch dính tới. `admin` (service_role) chỉ dùng để kiểm tra. */
export async function deleteCourtForOwner(supabase: Client, admin: Client, user: User, courtId: string) {
  const owned = await ownedCourt(supabase, user, courtId, 'Bạn không có quyền xóa sân con này')
  if ('error' in owned) return owned

  const blocker = await getCourtDeletionBlocker(admin, courtId)
  if (blocker) return { error: blocker } as Failure

  const { error } = await supabase.from('courts').delete().eq('id', courtId)
  if (error) return { error: error.message } as Failure
  return { success: true as const }
}

export async function deleteClubForOwner(supabase: Client, admin: Client, user: User, clubId: string) {
  const owned = await ownedClub(supabase, user, clubId)
  if ('error' in owned) return owned

  const blocker = await getClubDeletionBlocker(admin, clubId)
  if (blocker) return { error: blocker } as Failure

  const { error } = await supabase.from('clubs').delete().eq('id', clubId)
  if (error) return { error: error.message } as Failure
  return { success: true as const }
}

/** Ghim hoặc xóa vị trí bản đồ của cụm sân (lat/lng = null để xóa). */
export async function updateClubLocationForOwner(supabase: Client, user: User, clubId: string, lat: number | null, lng: number | null) {
  const owned = await ownedClub(supabase, user, clubId)
  if ('error' in owned) return owned

  const clearing = lat === null && lng === null
  if (!clearing && (lat === null || lng === null || !isValidLatLng(lat, lng))) return { error: 'Toạ độ vị trí không hợp lệ' } as Failure

  const { error } = await supabase.from('clubs').update({ latitude: lat, longitude: lng }).eq('id', clubId)
  if (error) {
    console.error('updateClubLocation lỗi', error)
    return { error: 'Không lưu được vị trí. Vui lòng thử lại.' } as Failure
  }
  return { success: true as const }
}

/**
 * Lưu danh sách ảnh của cụm sân sau khi client đã tải lên Storage. Chỉ nhận URL nằm trong thư mục của chính cụm sân
 * (hoặc ảnh đã có), và dọn khỏi Storage những ảnh vừa bị gỡ để không để lại file mồ côi.
 */
export async function setClubImagesForOwner(supabase: Client, user: User, clubId: string, images: unknown, supabaseUrl: string) {
  const owned = await ownedClub(supabase, user, clubId)
  if ('error' in owned) return owned

  const parsed = validateClubImages(clubId, images, owned.images, supabaseUrl)
  if (!parsed.ok) return { error: parsed.error } as Failure

  const { error } = await supabase.from('clubs').update({ images: parsed.images }).eq('id', clubId)
  if (error) {
    console.error('setClubImages lỗi', error)
    return { error: 'Không thể lưu ảnh. Vui lòng thử lại.' } as Failure
  }

  const removed = owned.images
    .filter((url) => !parsed.images.includes(url))
    .map((url) => ownImagePath('club-images', clubId, url, supabaseUrl))
    .filter((path): path is string => path !== null)
  if (removed.length > 0) {
    const { error: rmError } = await supabase.storage.from('club-images').remove(removed)
    if (rmError) console.warn('setClubImages: không xóa được file cũ', rmError.message)
  }
  return { success: true as const, images: parsed.images }
}
