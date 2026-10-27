/**
 * Phần thuần túy của API cho ứng dụng mobile: tách token khỏi header và kiểm tra thân yêu cầu.
 * Mobile gọi API này vì ghi vào bảng đặt sân bị khóa với người dùng, mọi thao tác ghi phải qua server.
 */
import { parseResetEmail } from '@/lib/password-reset'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const MAX_BODY_BYTES = 4 * 1024
export const MAX_NOTE_LENGTH = 500

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

/** Lấy token từ "Authorization: Bearer <token>"; null nếu thiếu hoặc sai dạng. */
export function bearerToken(header: string | null | undefined): string | null {
  const match = /^Bearer\s+([A-Za-z0-9\-._~+/]+=*)$/.exec(header?.trim() ?? '')
  return match ? match[1] : null
}

/** Cấu hình mở kèo ghép cùng lúc đặt sân. Chi phí mỗi người do server tính từ tổng tiền, không nhận từ app. */
export interface MobileMatchConfig {
  isOpenMatch: true
  title?: string
  description?: string
  skillLevel: 'all' | 'beginner' | 'intermediate' | 'advanced'
  requiredPlayers: number
  costSharingType: 'split' | 'host_covers'
}

export interface CreateBookingBody {
  courtId: string
  startTime: string
  endTime: string
  note?: string
  match?: MobileMatchConfig
}

export type ParsedBody<T> = { ok: true; value: T } | { ok: false; error: string }

function isIsoInstant(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && !Number.isNaN(new Date(value).getTime())
}

const MATCH_SKILLS = ['all', 'beginner', 'intermediate', 'advanced'] as const
const MATCH_COST_TYPES = ['split', 'host_covers'] as const
export const MAX_MATCH_TITLE = 100
export const MAX_MATCH_DESCRIPTION = 500

function parseMatchConfig(raw: unknown): ParsedBody<MobileMatchConfig> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: 'Thông tin kèo ghép không hợp lệ' }
  }
  const { title, description, skillLevel = 'all', requiredPlayers, costSharingType = 'split' } = raw as Record<string, unknown>

  if (title !== undefined && (typeof title !== 'string' || title.length > MAX_MATCH_TITLE)) {
    return { ok: false, error: `Tên kèo tối đa ${MAX_MATCH_TITLE} ký tự` }
  }
  if (description !== undefined && (typeof description !== 'string' || description.length > MAX_MATCH_DESCRIPTION)) {
    return { ok: false, error: `Mô tả kèo tối đa ${MAX_MATCH_DESCRIPTION} ký tự` }
  }
  if (!(MATCH_SKILLS as readonly unknown[]).includes(skillLevel)) return { ok: false, error: 'Trình độ của kèo không hợp lệ' }
  if (!(MATCH_COST_TYPES as readonly unknown[]).includes(costSharingType)) return { ok: false, error: 'Cách chia chi phí không hợp lệ' }
  if (typeof requiredPlayers !== 'number' || !Number.isInteger(requiredPlayers) || requiredPlayers < 2 || requiredPlayers > 50) {
    return { ok: false, error: 'Số người cần có phải từ 2 đến 50' }
  }

  return {
    ok: true,
    value: {
      isOpenMatch: true,
      ...(title ? { title: title as string } : {}),
      ...(description ? { description: description as string } : {}),
      skillLevel: skillLevel as MobileMatchConfig['skillLevel'],
      requiredPlayers,
      costSharingType: costSharingType as MobileMatchConfig['costSharingType'],
    },
  }
}

export function parseCreateBookingBody(body: unknown): ParsedBody<CreateBookingBody> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Dữ liệu gửi lên không hợp lệ' }
  }
  const { courtId, startTime, endTime, note, match } = body as Record<string, unknown>

  if (!isUuid(courtId)) return { ok: false, error: 'Mã sân không hợp lệ' }
  if (!isIsoInstant(startTime) || !isIsoInstant(endTime)) return { ok: false, error: 'Thời gian đặt sân không hợp lệ' }
  if (note !== undefined && (typeof note !== 'string' || note.length > MAX_NOTE_LENGTH)) {
    return { ok: false, error: `Ghi chú tối đa ${MAX_NOTE_LENGTH} ký tự` }
  }

  let matchConfig: MobileMatchConfig | undefined
  if (match !== undefined && match !== null) {
    const parsed = parseMatchConfig(match)
    if (!parsed.ok) return parsed
    matchConfig = parsed.value
  }

  return { ok: true, value: { courtId, startTime, endTime, ...(note ? { note } : {}), ...(matchConfig ? { match: matchConfig } : {}) } }
}

export interface RespondBody {
  status: 'accepted' | 'rejected'
}

/** Thân yêu cầu duyệt/từ chối người xin vào kèo. */
export function parseRespondBody(body: unknown): ParsedBody<RespondBody> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Dữ liệu gửi lên không hợp lệ' }
  }
  const { status } = body as Record<string, unknown>
  if (status !== 'accepted' && status !== 'rejected') return { ok: false, error: 'Trạng thái không hợp lệ' }
  return { ok: true, value: { status } }
}

export interface OwnerStatusBody {
  status: 'confirmed' | 'cancelled' | 'completed'
}

/** Thân yêu cầu đổi trạng thái đơn của chủ sân. */
export function parseOwnerStatusBody(body: unknown): ParsedBody<OwnerStatusBody> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Dữ liệu gửi lên không hợp lệ' }
  }
  const { status } = body as Record<string, unknown>
  if (status !== 'confirmed' && status !== 'cancelled' && status !== 'completed') {
    return { ok: false, error: 'Trạng thái không hợp lệ' }
  }
  return { ok: true, value: { status } }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Chuỗi tùy chọn có giới hạn độ dài: undefined/null/'' coi như bỏ trống. */
function optionalText(value: unknown, max: number): { ok: true; value?: string } | { ok: false } {
  if (value === undefined || value === null || value === '') return { ok: true }
  if (typeof value !== 'string' || value.trim().length > max) return { ok: false }
  return { ok: true, value: value.trim() }
}

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/
export const COURT_SPORTS = ['football', 'badminton', 'pickleball', 'tennis', 'basketball'] as const

export interface CreateClubBody {
  name: string
  address: string
  description?: string
  city?: string
  district?: string
  openTime?: string
  closeTime?: string
  amenities?: string[]
  latitude?: number
  longitude?: number
}

/** Thân yêu cầu tạo cụm sân. Ảnh chưa hỗ trợ trên mobile nên cụm sân dùng ảnh mặc định. */
export function parseCreateClubBody(body: unknown): ParsedBody<CreateClubBody> {
  if (!isPlainObject(body)) return { ok: false, error: 'Dữ liệu gửi lên không hợp lệ' }
  const { name, address, description, city, district, openTime, closeTime, amenities, latitude, longitude } = body

  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) return { ok: false, error: 'Tên cụm sân phải từ 1 đến 100 ký tự' }
  if (typeof address !== 'string' || !address.trim() || address.trim().length > 200) return { ok: false, error: 'Địa chỉ phải từ 1 đến 200 ký tự' }

  const desc = optionalText(description, 1000)
  const cityText = optionalText(city, 60)
  const districtText = optionalText(district, 60)
  if (!desc.ok || !cityText.ok || !districtText.ok) return { ok: false, error: 'Thông tin cụm sân quá dài hoặc không hợp lệ' }

  for (const time of [openTime, closeTime]) {
    if (time !== undefined && time !== null && time !== '' && (typeof time !== 'string' || !CLOCK.test(time))) {
      return { ok: false, error: 'Giờ mở cửa hoặc đóng cửa không đúng định dạng HH:MM' }
    }
  }
  if (openTime && closeTime && String(openTime) >= String(closeTime)) return { ok: false, error: 'Giờ đóng cửa phải sau giờ mở cửa' }

  let amenityList: string[] | undefined
  if (amenities !== undefined && amenities !== null) {
    if (!Array.isArray(amenities) || amenities.length > 20 || amenities.some((a) => typeof a !== 'string' || !a.trim() || a.length > 30)) {
      return { ok: false, error: 'Danh sách tiện ích không hợp lệ' }
    }
    amenityList = amenities.map((a) => (a as string).trim())
  }

  const hasLat = latitude !== undefined && latitude !== null
  const hasLng = longitude !== undefined && longitude !== null
  if (hasLat !== hasLng || (hasLat && (typeof latitude !== 'number' || typeof longitude !== 'number'))) {
    return { ok: false, error: 'Toạ độ vị trí không hợp lệ' }
  }

  return {
    ok: true,
    value: {
      name: name.trim(),
      address: address.trim(),
      ...(desc.value ? { description: desc.value } : {}),
      ...(cityText.value ? { city: cityText.value } : {}),
      ...(districtText.value ? { district: districtText.value } : {}),
      ...(openTime ? { openTime: openTime as string } : {}),
      ...(closeTime ? { closeTime: closeTime as string } : {}),
      ...(amenityList?.length ? { amenities: amenityList } : {}),
      ...(hasLat ? { latitude: latitude as number, longitude: longitude as number } : {}),
    },
  }
}

export interface UpdateClubBody {
  name?: string
  address?: string
  description?: string | null
  city?: string
  district?: string | null
  openTime?: string
  closeTime?: string
  amenities?: string[]
}

/**
 * Thân yêu cầu sửa cụm sân: chỉ gửi trường nào cần đổi, phải có ít nhất một trường.
 * description/district gửi chuỗi rỗng hoặc null là xóa; amenities gửi mảng rỗng là xóa hết. Vị trí và ảnh có API riêng.
 */
export function parseUpdateClubBody(body: unknown): ParsedBody<UpdateClubBody> {
  if (!isPlainObject(body)) return { ok: false, error: 'Dữ liệu gửi lên không hợp lệ' }
  const { name, address, description, city, district, openTime, closeTime, amenities } = body
  const value: UpdateClubBody = {}

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) return { ok: false, error: 'Tên cụm sân phải từ 1 đến 100 ký tự' }
    value.name = name.trim()
  }
  if (address !== undefined) {
    if (typeof address !== 'string' || !address.trim() || address.trim().length > 200) return { ok: false, error: 'Địa chỉ phải từ 1 đến 200 ký tự' }
    value.address = address.trim()
  }
  for (const [key, raw, max] of [['description', description, 1000], ['district', district, 60]] as const) {
    if (raw === undefined) continue
    const text = optionalText(raw, max)
    if (!text.ok) return { ok: false, error: 'Thông tin cụm sân quá dài hoặc không hợp lệ' }
    value[key] = text.value ?? null
  }
  if (city !== undefined) {
    const cityText = optionalText(city, 60)
    if (!cityText.ok) return { ok: false, error: 'Thông tin cụm sân quá dài hoặc không hợp lệ' }
    if (cityText.value) value.city = cityText.value
  }

  for (const [key, time] of [['openTime', openTime], ['closeTime', closeTime]] as const) {
    if (time === undefined || time === null || time === '') continue
    if (typeof time !== 'string' || !CLOCK.test(time)) return { ok: false, error: 'Giờ mở cửa hoặc đóng cửa không đúng định dạng HH:MM' }
    value[key] = time
  }
  if (value.openTime && value.closeTime && value.openTime >= value.closeTime) return { ok: false, error: 'Giờ đóng cửa phải sau giờ mở cửa' }

  if (amenities !== undefined) {
    if (!Array.isArray(amenities) || amenities.length > 20 || amenities.some((a) => typeof a !== 'string' || !a.trim() || a.length > 30)) {
      return { ok: false, error: 'Danh sách tiện ích không hợp lệ' }
    }
    value.amenities = amenities.map((a) => (a as string).trim())
  }

  if (Object.keys(value).length === 0) return { ok: false, error: 'Không có gì để cập nhật' }
  return { ok: true, value }
}

export interface CreateCourtBody {
  name: string
  sportType: (typeof COURT_SPORTS)[number]
  surfaceType?: string
  basePricePerHour: number
  depositPercentage: number
}

/** Thân yêu cầu thêm sân con vào một cụm sân (mã cụm sân nằm trên đường dẫn). */
export function parseCreateCourtBody(body: unknown): ParsedBody<CreateCourtBody> {
  if (!isPlainObject(body)) return { ok: false, error: 'Dữ liệu gửi lên không hợp lệ' }
  const { name, sportType, surfaceType, basePricePerHour, depositPercentage } = body

  if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) return { ok: false, error: 'Tên sân phải từ 1 đến 80 ký tự' }
  if (!(COURT_SPORTS as readonly unknown[]).includes(sportType)) return { ok: false, error: 'Môn thể thao không hợp lệ' }
  const surface = optionalText(surfaceType, 40)
  if (!surface.ok) return { ok: false, error: 'Loại mặt sân quá dài hoặc không hợp lệ' }
  if (typeof basePricePerHour !== 'number' || !Number.isFinite(basePricePerHour) || basePricePerHour < 1_000 || basePricePerHour > 50_000_000) {
    return { ok: false, error: 'Giá mỗi giờ phải từ 1.000 đ đến 50.000.000 đ' }
  }
  if (typeof depositPercentage !== 'number' || !Number.isInteger(depositPercentage) || depositPercentage < 1 || depositPercentage > 100) {
    return { ok: false, error: 'Phần trăm cọc phải từ 1 đến 100' }
  }

  return {
    ok: true,
    value: {
      name: name.trim(),
      sportType: sportType as CreateCourtBody['sportType'],
      ...(surface.value ? { surfaceType: surface.value } : {}),
      basePricePerHour: Math.round(basePricePerHour),
      depositPercentage,
    },
  }
}

export interface PricingRuleBody {
  name: string
  startTime: string
  endTime: string
  pricePerHour: number
}

/** Thân yêu cầu thêm khung giá. Kiểm tra chi tiết (giờ, giá) do validatePricingRule làm ở server, ở đây chỉ chặn sai kiểu. */
export function parsePricingRuleBody(body: unknown): ParsedBody<PricingRuleBody> {
  if (!isPlainObject(body)) return { ok: false, error: 'Dữ liệu gửi lên không hợp lệ' }
  const { name, startTime, endTime, pricePerHour } = body
  if (typeof name !== 'string' || typeof startTime !== 'string' || typeof endTime !== 'string' || typeof pricePerHour !== 'number') {
    return { ok: false, error: 'Vui lòng nhập đầy đủ thông tin khung giá' }
  }
  return { ok: true, value: { name, startTime, endTime, pricePerHour } }
}

export interface UpdateCourtBody {
  name?: string
  surfaceType?: string
  basePricePerHour?: number
  depositPercentage?: number
  isActive?: boolean
}

/** Thân yêu cầu sửa sân con: chỉ gửi trường nào cần đổi, phải có ít nhất một trường. */
export function parseUpdateCourtBody(body: unknown): ParsedBody<UpdateCourtBody> {
  if (!isPlainObject(body)) return { ok: false, error: 'Dữ liệu gửi lên không hợp lệ' }
  const { name, surfaceType, basePricePerHour, depositPercentage, isActive } = body
  const value: UpdateCourtBody = {}

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) return { ok: false, error: 'Tên sân phải từ 1 đến 80 ký tự' }
    value.name = name.trim()
  }
  if (surfaceType !== undefined) {
    const surface = optionalText(surfaceType, 40)
    if (!surface.ok) return { ok: false, error: 'Loại mặt sân quá dài hoặc không hợp lệ' }
    if (surface.value) value.surfaceType = surface.value
  }
  if (basePricePerHour !== undefined) {
    if (typeof basePricePerHour !== 'number' || !Number.isFinite(basePricePerHour) || basePricePerHour < 1_000 || basePricePerHour > 50_000_000) {
      return { ok: false, error: 'Giá mỗi giờ phải từ 1.000 đ đến 50.000.000 đ' }
    }
    value.basePricePerHour = Math.round(basePricePerHour)
  }
  if (depositPercentage !== undefined) {
    if (typeof depositPercentage !== 'number' || !Number.isInteger(depositPercentage) || depositPercentage < 1 || depositPercentage > 100) {
      return { ok: false, error: 'Phần trăm cọc phải từ 1 đến 100' }
    }
    value.depositPercentage = depositPercentage
  }
  if (isActive !== undefined) {
    if (typeof isActive !== 'boolean') return { ok: false, error: 'Dữ liệu gửi lên không hợp lệ' }
    value.isActive = isActive
  }

  if (Object.keys(value).length === 0) return { ok: false, error: 'Không có gì để cập nhật' }
  return { ok: true, value }
}

export interface LocationBody {
  latitude: number | null
  longitude: number | null
}

/** Thân yêu cầu ghim vị trí: hai số, hoặc cả hai null để gỡ vị trí. Phạm vi toạ độ do lib kiểm tra. */
export function parseLocationBody(body: unknown): ParsedBody<LocationBody> {
  if (!isPlainObject(body)) return { ok: false, error: 'Dữ liệu gửi lên không hợp lệ' }
  const { latitude, longitude } = body
  const bothNull = latitude === null && longitude === null
  const bothNumbers = typeof latitude === 'number' && typeof longitude === 'number'
  if (!bothNull && !bothNumbers) return { ok: false, error: 'Toạ độ vị trí không hợp lệ' }
  return { ok: true, value: { latitude: bothNull ? null : (latitude as number), longitude: bothNull ? null : (longitude as number) } }
}

export const MAX_IMAGE_URL_LENGTH = 500

/** Thân yêu cầu lưu danh sách ảnh cụm sân. Việc ảnh có nằm trong kho của cụm sân hay không do lib kiểm tra. */
export function parseImagesBody(body: unknown): ParsedBody<{ images: string[] }> {
  if (!isPlainObject(body)) return { ok: false, error: 'Dữ liệu gửi lên không hợp lệ' }
  const { images } = body
  if (!Array.isArray(images) || images.length > 8 || images.some((u) => typeof u !== 'string' || u.length > MAX_IMAGE_URL_LENGTH)) {
    return { ok: false, error: 'Danh sách ảnh không hợp lệ' }
  }
  return { ok: true, value: { images: images as string[] } }
}

/** Thân yêu cầu gửi thư đặt lại mật khẩu từ app (chưa đăng nhập nên không có token). */
export function parseForgotPasswordBody(body: unknown): ParsedBody<{ email: string }> {
  if (!isPlainObject(body)) return { ok: false, error: 'Dữ liệu gửi lên không hợp lệ' }
  const email = parseResetEmail(body.email)
  return email ? { ok: true, value: { email } } : { ok: false, error: 'Vui lòng nhập email hợp lệ' }
}
