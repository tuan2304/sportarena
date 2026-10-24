/**
 * Phần thuần túy của API cho ứng dụng mobile: tách token khỏi header và kiểm tra thân yêu cầu.
 * Mobile gọi API này vì ghi vào bảng đặt sân bị khóa với người dùng, mọi thao tác ghi phải qua server.
 */
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
