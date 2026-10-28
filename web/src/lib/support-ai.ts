import { isTicketCategory, type TicketCategory } from '@/lib/support'

/**
 * Phần thuần (không gọi mạng, không đụng database) của trợ lý trả lời phiếu hỗ trợ: khi nào được tự trả lời.
 * Nội dung câu trả lời do bộ so khớp FAQ chạy trong app quyết định (support-faq.ts); phần đọc/ghi database nằm ở
 * support-ai-reply.ts.
 */

export const AI_SENDER_NAME = 'Trợ lý AI SportArena'

/** Mỗi phiếu trợ lý chỉ trả lời tối đa chừng này lần; sau đó giao cho quản trị (chặn vòng lặp). */
export const MAX_AI_REPLIES_PER_TICKET = 2

/**
 * Nhóm trợ lý được tự trả lời. Thanh toán (tiền thật, chủ sân giữ tiền) và lỗi kỹ thuật (cần người xem để
 * không bỏ sót lỗi thật) luôn do quản trị xử lý.
 */
const AI_AUTO_CATEGORIES: readonly TicketCategory[] = ['booking', 'account', 'other']

export function canAutoReplyCategory(category: unknown): boolean {
  return isTicketCategory(category) && AI_AUTO_CATEGORIES.includes(category)
}

export interface AiTicketState {
  category: string
  status: string
  messages: Array<{ is_staff: boolean; is_ai: boolean }>
}

/** Lý do AI không nên trả lời phiếu này lúc này; null nghĩa là được phép. */
export function aiSkipReason(state: AiTicketState): string | null {
  if (!canAutoReplyCategory(state.category)) return 'category'
  if (state.status === 'closed' || state.status === 'resolved') return 'status'
  const last = state.messages[state.messages.length - 1]
  // Chỉ trả lời khi người dùng là người nói sau cùng
  if (!last || last.is_staff) return 'not-awaiting-staff'
  // Đã có nhân viên thật tham gia thì AI không chen vào nữa
  if (state.messages.some((m) => m.is_staff && !m.is_ai)) return 'human-involved'
  if (state.messages.filter((m) => m.is_ai).length >= MAX_AI_REPLIES_PER_TICKET) return 'ai-limit'
  return null
}
