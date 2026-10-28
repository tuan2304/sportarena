import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyUser } from '@/lib/notify'
import { captureError } from '@/lib/monitoring'
import { AI_SENDER_NAME, aiSkipReason } from '@/lib/support-ai'
import { answerTicket } from '@/lib/support-faq'

/**
 * Trợ lý tự trả lời phiếu hỗ trợ (chỉ khi đủ điều kiện, xem support-ai.ts). Chạy hoàn toàn trong app: câu trả lời
 * là một mục có sẵn trong kho FAQ (support-faq.ts), không có dịch vụ ngoài, không tốn phí và không thể đổi dữ liệu,
 * hoàn tiền hay đóng phiếu.
 */

/** Bật mặc định (không cần khóa nào); đặt SUPPORT_AI_ENABLED=false để tắt, khi đó mọi phiếu do quản trị trả lời. */
export function isSupportAiEnabled(): boolean {
  return process.env.SUPPORT_AI_ENABLED !== 'false'
}

/**
 * replied: đã gửi câu trả lời · escalated/skipped/failed: AI không trả lời, người gọi phải báo quản trị ·
 * superseded: có tin mới hơn nên lượt này bỏ qua (lượt của tin mới sẽ lo).
 */
export type AiReplyOutcome = 'replied' | 'escalated' | 'skipped' | 'failed' | 'superseded'

export async function maybeAutoReply(ticketId: string): Promise<AiReplyOutcome> {
  if (!isSupportAiEnabled()) return 'skipped'
  const admin = createAdminClient()

  const { data: ticket } = await admin
    .from('support_tickets')
    .select('id, user_id, subject, category, status, club:clubs(name)')
    .eq('id', ticketId)
    .maybeSingle()
  if (!ticket) return 'skipped'

  const { data: rows } = await admin
    .from('ticket_messages')
    .select('id, is_staff, is_ai, sender_name, body')
    .eq('ticket_id', ticketId)
    .order('created_at')
  const messages = rows ?? []

  const skip = aiSkipReason({ category: ticket.category, status: ticket.status, messages })
  if (skip) {
    console.info(`support-ai: bỏ qua phiếu ${ticketId} (${skip})`)
    return 'skipped'
  }
  const lastSeenId = messages[messages.length - 1].id

  let decision
  try {
    decision = answerTicket({ subject: ticket.subject, messages })
  } catch (err) {
    // Không bao giờ nên xảy ra (hàm thuần), nhưng nếu có thì mọi phiếu sau đó cũng hỏng: báo cho người trực
    captureError('support-ai', err, { ticketId }, { alert: true })
    return 'failed'
  }

  if (decision.action === 'escalate') {
    console.info(`support-ai: phiếu ${ticketId} chuyển quản trị (${decision.reason})`)
    return 'escalated'
  }

  // Người dùng hoặc nhân viên có thể nhắn thêm ngay lúc ta đang xử lý: nếu vậy thì câu trả lời này đã cũ
  const { data: latest } = await admin
    .from('ticket_messages')
    .select('id')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (latest?.id !== lastSeenId) return 'superseded'

  const { error } = await admin.from('ticket_messages').insert({
    ticket_id: ticketId,
    sender_id: null,
    is_staff: true,
    is_ai: true,
    sender_name: AI_SENDER_NAME,
    body: decision.reply,
  })
  if (error) {
    captureError('support-ai', error, { ticketId, step: 'save-reply' }, { alert: true })
    return 'failed'
  }

  await admin.from('support_tickets').update({ status: 'answered', last_message_at: new Date().toISOString() }).eq('id', ticketId)
  await notifyUser({
    userId: ticket.user_id,
    title: 'Hỗ trợ đã trả lời bạn',
    message: ticket.subject,
    type: 'system',
    link: `/support/${ticketId}`,
  })

  revalidatePath(`/support/${ticketId}`)
  revalidatePath(`/admin/tickets/${ticketId}`)
  revalidatePath('/admin/tickets')
  revalidatePath('/support')
  return 'replied'
}
