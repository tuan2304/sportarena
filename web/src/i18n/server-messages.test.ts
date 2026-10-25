import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EN_EXACT, EN_PATTERNS, translateServerMessage } from './server-messages'

const SRC = join(process.cwd(), 'src')
const VIETNAMESE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i

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
  'lib/auth-guards.ts',
  'lib/booking-service.ts',
  'lib/booking-cancel.ts',
  'lib/manual-payment.ts',
  'lib/image-upload.ts',
  'lib/profile.ts',
  'lib/rate-limit.ts',
  'lib/support.ts',
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
    for (const [vi, en] of Object.entries(EN_EXACT)) expect(VIETNAMESE.test(en), `${vi} -> ${en}`).toBe(false)
    for (const [, en] of EN_PATTERNS) expect(VIETNAMESE.test(en), en).toBe(false)
  })
})
