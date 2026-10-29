import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EN_EXACT, EN_PATTERNS, translateServerMessage } from './server-messages'

const SRC = join(process.cwd(), 'src')
const VIETNAMESE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i
// "đ" là ký hiệu đồng, được phép xuất hiện trong bản tiếng Anh
const VIETNAMESE_IN_ENGLISH = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹ]/i

/** Các file có câu lỗi trả về cho người chơi (khu vực chủ sân/quản trị vẫn dùng tiếng Việt nên không nằm ở đây) */
const FILES = [
  'app/actions/auth.ts',
  'app/actions/booking.ts',
  'app/actions/cancellation.ts',
  'app/actions/chat.ts',
  'app/actions/maps.ts',
  'app/actions/matches.ts',
  'app/actions/notifications.ts',
  'app/actions/profile.ts',
  'app/actions/reviews.ts',
  'app/actions/support.ts',
  'app/actions/owner.ts',
  'app/actions/payment-settings.ts',
  'app/actions/billing.ts',
  'app/actions/admin.ts',
  'app/actions/bank-account.ts',
  'app/actions/announcements.ts',
  'app/actions/account.ts',
  'app/actions/reconciliation.ts',
  'lib/account.ts',
  'app/api/mobile/account/delete/route.ts',
  'app/api/mobile/account/export/route.ts',
  'app/api/account/export/route.ts',
  'lib/pricing-rule.ts',
  'lib/club-limits.ts',
  'lib/deletion-guards.ts',
  'lib/vietqr.ts',
  'lib/mobile-api.ts',
  'lib/owner-booking.ts',
  'lib/match-members.ts',
  'app/api/mobile/matches/participants/[id]/respond/route.ts',
  'app/api/mobile/owner/bookings/[id]/status/route.ts',
  'app/api/mobile/owner/bookings/[id]/refunded/route.ts',
  'lib/mobile-auth.ts',
  'app/api/mobile/bookings/route.ts',
  'app/api/mobile/bookings/[id]/cancel/route.ts',
  'app/api/mobile/bookings/[id]/claim/route.ts',
  'lib/auth-guards.ts',
  'lib/booking-service.ts',
  'lib/booking-cancel.ts',
  'lib/manual-payment.ts',
  'lib/image-upload.ts',
  'lib/profile.ts',
  'lib/rate-limit.ts',
  'lib/support.ts',
  'lib/no-show.ts',
  'lib/waitlist.ts',
  'lib/recurring.ts',
  'lib/recurring-service.ts',
  'app/actions/waitlist.ts',
  'app/actions/phone-auth.ts',
  'app/api/mobile/waitlist/route.ts',
  'app/api/mobile/waitlist/[id]/route.ts',
  'app/api/mobile/recurring/route.ts',
  'app/api/mobile/recurring/[id]/route.ts',
  'app/api/mobile/owner/recurring/[id]/route.ts',
  'app/api/mobile/owner/analytics/route.ts',
  'app/actions/recurring.ts',
  'app/api/mobile/owner/bookings/[id]/no-show/route.ts',
  'app/api/mobile/matches/participants/[id]/no-show/route.ts',
]

/** Gom các câu đứng sau `error:` / `reason:` hoặc nằm trong tr('...'). Câu có ${...} được thay bằng số để thử khớp mẫu. */
function userFacingMessages(source: string): string[] {
  const out: string[] = []
  const patterns = [/\b(?:error|reason):\s*(['"`])((?:\\.|(?!\1).)*)\1/g, /\btr\(\s*(['"`])((?:\\.|(?!\1).)*)\1\s*\)/g]
  for (const pattern of patterns) {
    for (const m of source.matchAll(pattern)) {
      const text = m[2].replace(/\\'/g, "'").replace(/\$\{[^}]*\}/g, '7')
      if (VIETNAMESE.test(text)) out.push(text)
    }
  }
  return out
}

describe('bản dịch tiếng Anh cho lỗi do server trả về', () => {
  it('mọi câu lỗi tiếng Việt trong code người chơi đều có bản dịch', () => {
    const missing: string[] = []
    for (const file of FILES) {
      const source = readFileSync(join(SRC, file), 'utf-8')
      for (const message of userFacingMessages(source)) {
        if (translateServerMessage(message, 'en') === message) missing.push(`${file}: ${message}`)
      }
    }
    expect(missing, 'Thêm bản dịch vào src/i18n/server-messages.ts').toEqual([])
  })

  it('tiếng Việt giữ nguyên câu gốc', () => {
    for (const key of Object.keys(EN_EXACT).slice(0, 20)) expect(translateServerMessage(key, 'vi')).toBe(key)
  })

  it('câu không có trong bảng được trả lại nguyên vẹn', () => {
    expect(translateServerMessage('Một lỗi lạ chưa có bản dịch', 'en')).toBe('Một lỗi lạ chưa có bản dịch')
  })

  it('dịch câu có số theo mẫu', () => {
    expect(translateServerMessage('Bạn thao tác quá nhanh. Vui lòng thử lại sau 30 giây.', 'en')).toContain('30 seconds')
    expect(translateServerMessage('Mỗi đơn đặt tối đa 6 giờ', 'en')).toBe('Each booking can be at most 6 hours')
  })

  it('bản dịch không bỏ sót ký tự tiếng Việt', () => {
    for (const [vi, en] of Object.entries(EN_EXACT)) expect(VIETNAMESE_IN_ENGLISH.test(en), `${vi} -> ${en}`).toBe(false)
    for (const [, en] of EN_PATTERNS) expect(VIETNAMESE_IN_ENGLISH.test(en), en).toBe(false)
  })
})

/** Mọi lời gọi notifyUser/notifyAdmins({...}) trong code phải có bản dịch tiếng Anh cho tiêu đề và nội dung. */
describe('bản dịch thông báo trong chuông', () => {
  const NOTIFY_FILES = [
    'app/actions/admin.ts',
    'app/actions/matches.ts',
    'app/actions/owner.ts',
    'app/actions/support.ts',
    'lib/booking-cancel.ts',
    'lib/manual-payment.ts',
    'lib/payments.ts',
    'lib/subscriptions.ts',
  ]

  function callBlocks(source: string): string[] {
    const blocks: string[] = []
    for (const m of source.matchAll(/notify(?:User|Admins)\(\{/g)) {
      let depth = 1
      let i = (m.index ?? 0) + m[0].length
      const start = i
      while (depth > 0 && i < source.length) {
        if (source[i] === '{') depth++
        else if (source[i] === '}') depth--
        i++
      }
      blocks.push(source.slice(start, i - 1))
    }
    return blocks
  }

  it('mọi câu thông báo tiếng Việt đều có bản dịch', () => {
    const missing: string[] = []
    let seen = 0
    for (const file of NOTIFY_FILES) {
      const source = readFileSync(join(SRC, file), 'utf-8')
      for (const block of callBlocks(source)) {
        const flat = block.replace(/\$\{[^}]*\}/g, '7')
        for (const m of flat.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)) {
          if (!VIETNAMESE.test(m[2])) continue
          seen++
          if (translateServerMessage(m[2], 'en') === m[2]) missing.push(`${file}: ${m[2]}`)
        }
      }
    }
    expect(seen).toBeGreaterThan(20)
    expect(missing, 'Thêm bản dịch thông báo vào src/i18n/server-messages.ts').toEqual([])
  })
})

