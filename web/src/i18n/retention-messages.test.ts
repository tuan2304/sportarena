import { describe, expect, it } from 'vitest'
import { translateServerMessage } from './server-messages'
import { buildReminderMessages } from '@/lib/reminders'
import { describeRecurring } from '@/lib/recurring'

const en = (text: string) => translateServerMessage(text, 'en')

describe('bản dịch tiếng Anh cho thông báo nhắc lịch / chờ / lịch cố định', () => {
  it('nhắc lịch trước giờ chơi', () => {
    const [booker, member] = buildReminderMessages({
      booking_id: 'b',
      user_id: 'u1',
      start_time: '2026-11-10T12:00:00Z',
      court_name: 'Sân 1',
      club_name: 'CLB A',
      match_id: 'm',
      match_title: 'Kèo tối',
      member_ids: ['u2'],
    })
    expect(en(booker.title)).toBe('Game time is coming up ⏰')
    expect(en(booker.message)).toBe('You are playing at 19:00 at Sân 1 (CLB A). Please arrive on time!')
    expect(en(member.title)).toBe('Your match is about to start ⏰')
    expect(en(member.message)).toBe('The match "Kèo tối" starts at 19:00 at Sân 1 (CLB A). Please arrive on time!')
  })

  it('nhãn lịch cố định trong câu được đổi sang tiếng Anh', () => {
    const label = describeRecurring(2, 19 * 60, 20 * 60)
    expect(en(`Một khách muốn đặt cố định Sân 1 (CLB A) vào ${label}. Bấm để xem và duyệt.`)).toBe(
      'A customer wants to book Sân 1 (CLB A) on a recurring basis: every Tuesday, 19:00 - 20:00. Tap to review and approve.'
    )
    expect(en(`Chủ sân CLB A đã từ chối lịch cố định ${describeRecurring(0, 450, 540)} tại Sân 1.`)).toBe(
      'The owner of CLB A declined your recurring booking every Sunday, 07:30 - 09:00 at Sân 1.'
    )
  })

  it('tiếng Việt giữ nguyên', () => {
    const text = 'Khung giờ bạn chờ đã trống 🎉'
    expect(translateServerMessage(text, 'vi')).toBe(text)
  })

  it('câu lỗi có số', () => {
    expect(en('Bạn đang chờ tối đa 10 khung giờ. Hãy rút bớt rồi đăng ký thêm.')).toBe('You can wait for at most 10 time slots. Leave some before joining more.')
    expect(en('Đã quá 14 ngày kể từ buổi chơi nên không thể thay đổi báo không đến')).toContain('more than 14 days')
  })
})
