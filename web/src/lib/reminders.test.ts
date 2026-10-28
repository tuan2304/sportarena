import { describe, expect, it } from 'vitest'
import { buildReminderMessages, type DueReminder } from './reminders'

const base: DueReminder = {
  booking_id: 'b1',
  user_id: 'host',
  // 19:00 giờ Việt Nam
  start_time: '2026-11-10T12:00:00Z',
  court_name: 'Sân 1',
  club_name: 'CLB Hoa Sen',
  match_id: null,
  match_title: null,
  member_ids: [],
}

describe('buildReminderMessages', () => {
  it('đơn không có kèo chỉ nhắc người đặt, dẫn tới lịch của tôi', () => {
    const out = buildReminderMessages(base)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ userId: 'host', link: '/my-bookings' })
    expect(out[0].message).toContain('19:00')
    expect(out[0].message).toContain('Sân 1 (CLB Hoa Sen)')
  })

  it('đơn có kèo nhắc cả người đặt lẫn từng thành viên, dẫn tới trang kèo', () => {
    const out = buildReminderMessages({ ...base, match_id: 'm1', match_title: 'Kèo tối', member_ids: ['p1', 'p2'] })
    expect(out.map((m) => m.userId)).toEqual(['host', 'p1', 'p2'])
    expect(out.every((m) => m.link === '/matches/m1')).toBe(true)
    expect(out[1].message).toContain('Kèo "Kèo tối"')
  })

  it('không nhắc hai lần cho cùng một người, kể cả khi chủ kèo cũng nằm trong danh sách thành viên', () => {
    const out = buildReminderMessages({ ...base, match_id: 'm1', match_title: 'K', member_ids: ['host', 'p1', 'p1'] })
    expect(out.map((m) => m.userId)).toEqual(['host', 'p1'])
  })
})
