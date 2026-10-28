import { describe, expect, it } from 'vitest'
import { MAX_AI_REPLIES_PER_TICKET, aiSkipReason, canAutoReplyCategory } from './support-ai'

const user = { is_staff: false, is_ai: false }
const ai = { is_staff: true, is_ai: true }
const human = { is_staff: true, is_ai: false }

describe('canAutoReplyCategory', () => {
  it('cho AI trả lời đặt sân, tài khoản, khác', () => {
    expect(canAutoReplyCategory('booking')).toBe(true)
    expect(canAutoReplyCategory('account')).toBe(true)
    expect(canAutoReplyCategory('other')).toBe(true)
  })

  it('không bao giờ tự trả lời thanh toán và lỗi kỹ thuật', () => {
    expect(canAutoReplyCategory('payment')).toBe(false)
    expect(canAutoReplyCategory('technical')).toBe(false)
  })

  it('từ chối nhóm lạ hoặc không phải chuỗi', () => {
    expect(canAutoReplyCategory('refund')).toBe(false)
    expect(canAutoReplyCategory(undefined)).toBe(false)
    expect(canAutoReplyCategory(null)).toBe(false)
  })
})

describe('aiSkipReason', () => {
  const base = { category: 'booking', status: 'open', messages: [user] }

  it('trả lời phiếu mới của người dùng', () => {
    expect(aiSkipReason(base)).toBeNull()
  })

  it('bỏ qua nhóm thanh toán dù nội dung thế nào', () => {
    expect(aiSkipReason({ ...base, category: 'payment' })).toBe('category')
  })

  it('bỏ qua phiếu đã giải quyết hoặc đã đóng', () => {
    expect(aiSkipReason({ ...base, status: 'resolved' })).toBe('status')
    expect(aiSkipReason({ ...base, status: 'closed' })).toBe('status')
  })

  it('chỉ trả lời khi người dùng nói sau cùng', () => {
    expect(aiSkipReason({ ...base, messages: [user, ai] })).toBe('not-awaiting-staff')
    expect(aiSkipReason({ ...base, messages: [] })).toBe('not-awaiting-staff')
  })

  it('không chen vào khi nhân viên thật đã tham gia', () => {
    expect(aiSkipReason({ ...base, messages: [user, human, user] })).toBe('human-involved')
  })

  it('cho trả lời tiếp khi người dùng nhắn thêm sau lời AI, đến hết hạn mức', () => {
    expect(aiSkipReason({ ...base, status: 'open', messages: [user, ai, user] })).toBeNull()
    const full = [user, ...Array.from({ length: MAX_AI_REPLIES_PER_TICKET }, () => [ai, user]).flat()]
    expect(aiSkipReason({ ...base, messages: full })).toBe('ai-limit')
  })
})
