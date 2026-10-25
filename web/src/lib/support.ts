/** Hằng số và kiểm tra dữ liệu cho phiếu hỗ trợ (ticket) giữa người dùng và quản trị nền tảng. */

export const TICKET_CATEGORIES = [
  { id: 'payment', label: 'Thanh toán, tiền cọc' },
  { id: 'booking', label: 'Đặt sân, lịch đặt' },
  { id: 'technical', label: 'Lỗi kỹ thuật' },
  { id: 'account', label: 'Tài khoản' },
  { id: 'other', label: 'Khác' },
] as const

export type TicketCategory = (typeof TICKET_CATEGORIES)[number]['id']
export type TicketStatus = 'open' | 'answered' | 'resolved' | 'closed'

export const TICKET_STATUS: Record<TicketStatus, { label: string; adminLabel: string; tone: string }> = {
  open: {
    label: 'Đang chờ hỗ trợ',
    adminLabel: 'Chờ trả lời',
    tone: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30',
  },
  answered: {
    label: 'Đã được trả lời',
    adminLabel: 'Đã trả lời, chờ người dùng',
    tone: 'bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-500/30',
  },
  resolved: {
    label: 'Đã giải quyết',
    adminLabel: 'Đã giải quyết',
    tone: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
  },
  closed: {
    label: 'Đã đóng',
    adminLabel: 'Đã đóng',
    tone: 'bg-muted text-muted-foreground border-border',
  },
}

export function categoryLabel(id: string): string {
  return TICKET_CATEGORIES.find((c) => c.id === id)?.label ?? 'Khác'
}

export function isTicketCategory(value: unknown): value is TicketCategory {
  return TICKET_CATEGORIES.some((c) => c.id === value)
}

export function isTicketStatus(value: unknown): value is TicketStatus {
  return value === 'open' || value === 'answered' || value === 'resolved' || value === 'closed'
}

/** Mỗi người chỉ được có tối đa chừng này phiếu chưa giải quyết cùng lúc (chống spam). */
export const MAX_ACTIVE_TICKETS_PER_USER = 5

const SUBJECT_MIN = 3
export const SUBJECT_MAX = 120
export const BODY_MAX = 2000

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string }

export function validateNewTicket(input: { subject?: unknown; category?: unknown; body?: unknown }): Validation<{
  subject: string
  category: TicketCategory
  body: string
}> {
  const subject = typeof input.subject === 'string' ? input.subject.trim().replace(/\s+/g, ' ') : ''
  const body = typeof input.body === 'string' ? input.body.trim() : ''
  const category = isTicketCategory(input.category) ? input.category : 'other'

  if (subject.length < SUBJECT_MIN) return { ok: false, error: `Tiêu đề cần ít nhất ${SUBJECT_MIN} ký tự` }
  if (subject.length > SUBJECT_MAX) return { ok: false, error: `Tiêu đề tối đa ${SUBJECT_MAX} ký tự` }
  if (!body) return { ok: false, error: 'Vui lòng mô tả vấn đề bạn gặp' }
  if (body.length > BODY_MAX) return { ok: false, error: `Nội dung tối đa ${BODY_MAX} ký tự` }
  return { ok: true, value: { subject, category, body } }
}

export function validateReply(body: unknown): Validation<string> {
  const text = typeof body === 'string' ? body.trim() : ''
  if (!text) return { ok: false, error: 'Vui lòng nhập nội dung' }
  if (text.length > BODY_MAX) return { ok: false, error: `Nội dung tối đa ${BODY_MAX} ký tự` }
  return { ok: true, value: text }
}

export type AnnouncementKind = 'update' | 'maintenance' | 'promo'
export type AnnouncementAudience = 'all' | 'owners' | 'players'

export const ANNOUNCEMENT_KINDS: Array<{ id: AnnouncementKind; label: string }> = [
  { id: 'update', label: 'Cập nhật tính năng' },
  { id: 'maintenance', label: 'Bảo trì hệ thống' },
  { id: 'promo', label: 'Ưu đãi, thông tin chung' },
]

export const ANNOUNCEMENT_AUDIENCES: Array<{ id: AnnouncementAudience; label: string }> = [
  { id: 'all', label: 'Tất cả người dùng' },
  { id: 'owners', label: 'Chỉ chủ sân' },
  { id: 'players', label: 'Chỉ người chơi' },
]

export function validateAnnouncement(input: {
  title?: unknown
  body?: unknown
  kind?: unknown
  audience?: unknown
  link?: unknown
}): Validation<{
  title: string
  body: string
  kind: AnnouncementKind
  audience: AnnouncementAudience
  link: string | null
}> {
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  const body = typeof input.body === 'string' ? input.body.trim() : ''
  const kind = ANNOUNCEMENT_KINDS.find((k) => k.id === input.kind)?.id
  const audience = ANNOUNCEMENT_AUDIENCES.find((a) => a.id === input.audience)?.id
  const rawLink = typeof input.link === 'string' ? input.link.trim() : ''

  if (title.length < 3 || title.length > 120) return { ok: false, error: 'Tiêu đề từ 3 đến 120 ký tự' }
  if (body.length < 3 || body.length > 1000) return { ok: false, error: 'Nội dung từ 3 đến 1000 ký tự' }
  if (!kind) return { ok: false, error: 'Loại thông báo không hợp lệ' }
  if (!audience) return { ok: false, error: 'Đối tượng nhận không hợp lệ' }

  // Chỉ cho đường dẫn nội bộ (/clubs, /support...). Chặn link ra ngoài để thông báo không thể dùng để lừa đảo.
  let link: string | null = null
  if (rawLink) {
    if (!rawLink.startsWith('/') || rawLink.startsWith('//') || rawLink.includes('\\') || rawLink.length > 200) {
      return { ok: false, error: 'Đường dẫn chỉ được là địa chỉ trong web, ví dụ /clubs hoặc /matches' }
    }
    link = rawLink
  }
  return { ok: true, value: { title, body, kind, audience, link } }
}
