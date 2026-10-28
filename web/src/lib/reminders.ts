import type { SupabaseClient } from '@supabase/supabase-js'
import { notifyUser } from '@/lib/notify'
import { formatTime } from '@/lib/format'
import type { Database } from '@/types/database'

/**
 * Nhắc lịch trước giờ chơi khoảng 2 giờ: người đặt sân và các thành viên đã được duyệt của kèo gắn với đơn.
 * Hàm claim_due_reminders() trong database chọn đơn tới hạn và đánh dấu đã nhắc trong cùng một câu lệnh nên chạy
 * chồng nhau cũng không nhắc trùng. Thông báo vào chuông kèm thông báo đẩy (notifyUser).
 */
export const REMINDER_LEAD = '2 hours'

export interface DueReminder {
  booking_id: string
  user_id: string
  start_time: string
  court_name: string
  club_name: string
  match_id: string | null
  match_title: string | null
  member_ids: string[]
}

export interface ReminderMessage {
  userId: string
  title: string
  message: string
  link: string
}

/** Các thông báo cần gửi cho một đơn: một cho người đặt, một cho mỗi thành viên (không gửi hai lần cho cùng một người). */
export function buildReminderMessages(row: DueReminder): ReminderMessage[] {
  const time = formatTime(row.start_time)
  const out: ReminderMessage[] = [
    {
      userId: row.user_id,
      title: 'Sắp đến giờ chơi ⏰',
      message: `Bạn có lịch chơi lúc ${time} tại ${row.court_name} (${row.club_name}). Hãy ra sân đúng giờ nhé!`,
      link: row.match_id ? `/matches/${row.match_id}` : '/my-bookings',
    },
  ]

  if (row.match_id) {
    for (const memberId of new Set(row.member_ids)) {
      if (memberId === row.user_id) continue
      out.push({
        userId: memberId,
        title: 'Sắp đến giờ vào kèo ⏰',
        message: `Kèo "${row.match_title ?? 'giao lưu'}" bắt đầu lúc ${time} tại ${row.court_name} (${row.club_name}). Hãy ra sân đúng giờ nhé!`,
        link: `/matches/${row.match_id}`,
      })
    }
  }
  return out
}

/** Gửi nhắc cho mọi đơn tới hạn. Trả về số thông báo đã gửi. */
export async function sendDueReminders(admin: SupabaseClient<Database>): Promise<number> {
  const { data, error } = await admin.rpc('claim_due_reminders', { p_lead: REMINDER_LEAD })
  if (error) {
    console.error('sendDueReminders: không lấy được đơn tới hạn', error)
    return 0
  }

  const messages = (data ?? []).flatMap((row) => buildReminderMessages(row))
  const results = await Promise.all(
    messages.map((m) => notifyUser({ userId: m.userId, title: m.title, message: m.message, type: 'booking', link: m.link }))
  )
  return results.filter(Boolean).length
}
