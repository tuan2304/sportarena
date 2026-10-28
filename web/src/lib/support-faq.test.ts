import { describe, expect, it } from 'vitest'
import { DEFAULT_FREE_CANCEL_HOURS, HOLD_MINUTES, HOLD_MINUTES_MANUAL } from './constants'
import { BODY_MAX } from './support'
import { FAQ_ENTRIES, answerTicket, bestMatch, detectLang, normalize, renderReply } from './support-faq'

const ask = (body: string, subject = '') => answerTicket({ subject, messages: [{ is_staff: false, is_ai: false, body }] })

/** id mục FAQ mà câu trả lời thuộc về, hoặc 'escalate:<lý do>' */
function outcome(body: string, subject = ''): string {
  const d = ask(body, subject)
  if (d.action === 'escalate') return `escalate:${d.reason}`
  const lang = detectLang(body)
  return FAQ_ENTRIES.find((e) => d.reply.startsWith(e[lang]))?.id ?? 'unknown-reply'
}

describe('normalize', () => {
  it('bỏ dấu tiếng Việt, đ → d, bỏ ký tự thừa', () => {
    expect(normalize('  Đặt sân, THẾ NÀO?! ')).toBe('dat san the nao')
    expect(normalize("didn't")).toBe('didn t')
  })
})

describe('detectLang', () => {
  it('có dấu tiếng Việt là vi; câu tiếng Anh là en; không dấu thì so từ chức năng', () => {
    expect(detectLang('Làm sao để hủy đơn')).toBe('vi')
    expect(detectLang('How can I cancel my booking')).toBe('en')
    expect(detectLang('toi muon huy don dat san')).toBe('vi')
    expect(detectLang('')).toBe('vi')
  })
})

describe('trả lời đúng mục FAQ', () => {
  const cases: Array<[string, string]> = [
    // tiếng Việt có dấu
    ['Làm sao để đặt sân vậy ạ?', 'how-to-book'],
    ['Tiền cọc là bao nhiêu phần trăm?', 'deposit-amount'],
    ['Giữ chỗ được bao lâu thì hết hạn?', 'hold-timer'],
    ['Cọc bằng cách nào, quét mã QR à?', 'pay-deposit'],
    ['Tôi muốn hủy đơn đặt sân thì có được hoàn cọc không?', 'cancel-policy'],
    ['Khi nào mình được hoàn cọc?', 'refund-status'],
    ['Ghép kèo là gì và cách mở kèo?', 'open-match'],
    ['Xin vào kèo mà chủ kèo chưa duyệt', 'join-match'],
    ['Tôi quên mật khẩu', 'forgot-password'],
    ['Làm sao đổi ảnh đại diện?', 'edit-profile'],
    ['Có app mobile không?', 'mobile-app'],
    ['Làm sao để cụm sân của tôi hiện công khai? Kết nối PayOS ở đâu', 'owner-payment-setup'],
    // không dấu
    ['quen mat khau thi lam sao', 'forgot-password'],
    ['huy don dat san co mat coc khong', 'cancel-policy'],
    // tiếng Anh
    ['How do I book a court?', 'how-to-book'],
    ['I forgot my password', 'forgot-password'],
    ['What is the cancellation policy? Will I get my deposit back?', 'cancel-policy'],
    ['How long is my slot held?', 'hold-timer'],
    ['Is there a mobile app I can download?', 'mobile-app'],
  ]
  it.each(cases)('%s → %s', (question, id) => {
    expect(outcome(question)).toBe(id)
  })

  it('tính cả tiêu đề phiếu khi người dùng mới nhắn một lần', () => {
    expect(outcome('Mong được giải đáp giúp', 'Quên mật khẩu')).toBe('forgot-password')
  })

  it('câu trả lời gồm nội dung mục + câu kết, đúng ngôn ngữ, vừa giới hạn của bảng', () => {
    const vi = ask('Tôi quên mật khẩu')
    const en = ask('I forgot my password')
    expect(vi.action === 'reply' && vi.reply).toContain('Quên mật khẩu')
    expect(vi.action === 'reply' && vi.reply).toContain('trả lời tin nhắn này')
    expect(en.action === 'reply' && en.reply).toContain('Forgot password')
    expect(en.action === 'reply' && en.reply).toContain('just reply to this message')
    for (const e of FAQ_ENTRIES) {
      expect(renderReply(e, 'vi').length).toBeLessThanOrEqual(BODY_MAX)
      expect(renderReply(e, 'en').length).toBeLessThanOrEqual(BODY_MAX)
    }
  })

  it('con số trong câu trả lời lấy từ hằng số của hệ thống, không ghi cứng', () => {
    const hold = FAQ_ENTRIES.find((e) => e.id === 'hold-timer')!
    expect(hold.vi).toContain(`${HOLD_MINUTES} phút`)
    expect(hold.vi).toContain(`${HOLD_MINUTES_MANUAL} phút`)
    const cancel = FAQ_ENTRIES.find((e) => e.id === 'cancel-policy')!
    expect(cancel.vi).toContain(`${DEFAULT_FREE_CANCEL_HOURS} giờ`)
  })
})

describe('chuyển cho quản trị thay vì đoán', () => {
  const cases: Array<[string, string]> = [
    ['Tôi muốn khiếu nại về chủ sân này', 'escalate:complaint'],
    ['Tôi nghi bị lừa đảo', 'escalate:complaint'],
    ['Cho mình gặp nhân viên với', 'escalate:wants-human'],
    ['I want to talk to a real person', 'escalate:wants-human'],
    ['Tài khoản của tôi bị hack rồi', 'escalate:security'],
    ['Tôi muốn xóa tài khoản và dữ liệu', 'escalate:data-deletion'],
    ['Tôi đã chuyển khoản cọc nhưng đơn chưa xác nhận', 'escalate:payment-issue'],
    ['Bị trừ tiền 2 lần', 'escalate:payment-issue'],
    ['I paid the deposit but it still shows pending', 'escalate:payment-issue'],
    ['Cách hủy đơn này vẫn chưa giải quyết được vấn đề của tôi', 'escalate:not-resolved'],
    ['App bị lỗi khi đặt sân', 'escalate:technical'],
    ['Không vào được trang đặt sân', 'escalate:technical'],
    ['Hủy đơn mã 12345678 giúp tôi', 'escalate:needs-account-data'],
    ['Cọc rồi mà không thấy báo gì', 'escalate:payment-issue'],
    ['Sao đơn của mình tự nhiên bị hủy vậy', 'escalate:about-their-order'],
    ['my booking was cancelled', 'escalate:about-their-order'],
    // chỉ trùng vài từ chung chung ("time", "booking") với một mục không liên quan: không được trả lời bừa
    ['Can I change the time of my booking?', 'escalate:low-confidence'],
    ['Sân có cho thuê vợt không', 'escalate:low-confidence'],
    ['Mình có thể đặt sân cho người khác không', 'escalate:low-confidence'],
    ['Thời tiết hôm nay thế nào', 'escalate:low-confidence'],
    ['hủy', 'escalate:no-match'],
  ]
  it.each(cases)('%s → %s', (question, expected) => {
    expect(outcome(question)).toBe(expected)
  })

  it('câu hỏi nhiều ý, quá dài thì giao cho người đọc', () => {
    expect(outcome('Tôi muốn hủy đơn đặt sân. '.repeat(30))).toBe('escalate:too-long')
  })

  it('câu hỏi nửa nạc nửa mỡ (có chủ đề lạ lẫn trong câu) không bị trả lời bừa', () => {
    expect(outcome('Hủy đơn rồi tôi muốn đổi sang giải đấu bóng chuyền cuối tuần thì sao')).toMatch(/^escalate:/)
  })

  it('không có tin nhắn của người dùng thì chuyển', () => {
    expect(answerTicket({ subject: 'x', messages: [] })).toEqual({ action: 'escalate', reason: 'no-user-message' })
  })

  it('đã trả lời đúng ý đó rồi mà người dùng hỏi lại thì chuyển, không lặp lại', () => {
    const first = ask('Tôi quên mật khẩu')
    expect(first.action).toBe('reply')
    const d = answerTicket({
      subject: '',
      messages: [
        { is_staff: false, is_ai: false, body: 'Tôi quên mật khẩu' },
        { is_staff: true, is_ai: true, body: first.action === 'reply' ? first.reply : '' },
        { is_staff: false, is_ai: false, body: 'Quên mật khẩu thì làm thế nào' },
      ],
    })
    expect(d).toEqual({ action: 'escalate', reason: 'repeat' })
  })

  it('lượt sau chỉ xét tin nhắn mới nhất, không lẫn tiêu đề phiếu cũ', () => {
    const d = answerTicket({
      subject: 'Quên mật khẩu',
      messages: [
        { is_staff: false, is_ai: false, body: 'Tôi quên mật khẩu' },
        { is_staff: true, is_ai: true, body: 'đã trả lời' },
        { is_staff: false, is_ai: false, body: 'Cảm ơn, còn cách hủy đơn thì sao' },
      ],
    })
    expect(d.action === 'reply' && d.reply.startsWith(FAQ_ENTRIES.find((e) => e.id === 'cancel-policy')!.vi)).toBe(true)
  })
})

describe('kho FAQ', () => {
  it('mỗi mục có id duy nhất, đủ cụm từ và cả hai ngôn ngữ', () => {
    const ids = FAQ_ENTRIES.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const e of FAQ_ENTRIES) {
      expect(e.phrases.length).toBeGreaterThanOrEqual(6)
      expect(e.vi.length).toBeGreaterThan(40)
      expect(e.en.length).toBeGreaterThan(40)
    }
  })

  it('mỗi cụm từ mẫu của một mục phải trả đúng mục đó (không bị mục khác giành)', () => {
    for (const e of FAQ_ENTRIES) {
      for (const p of e.phrases) {
        const m = bestMatch(p)
        // Cụm một từ đơn lẻ bị bỏ qua có chủ đích
        if (m) expect(m.entry.id, `"${p}" thuộc ${e.id} nhưng khớp ${m.entry.id}`).toBe(e.id)
      }
    }
  })
})
