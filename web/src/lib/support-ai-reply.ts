import Anthropic from '@anthropic-ai/sdk'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyUser } from '@/lib/notify'
import {
  AI_DECISION_SCHEMA,
  AI_SENDER_NAME,
  AI_SYSTEM_PROMPT,
  aiSkipReason,
  buildAiUserPrompt,
  parseAiDecision,
} from '@/lib/support-ai'

/**
 * Trợ lý AI tự trả lời phiếu hỗ trợ (chỉ khi đủ điều kiện, xem support-ai.ts).
 * Model chỉ trả về văn bản; nó không có công cụ nên không thể đổi dữ liệu, hoàn tiền hay đóng phiếu.
 */

const DEFAULT_MODEL = 'claude-opus-5-5'

/** Cần ANTHROPIC_API_KEY; đặt SUPPORT_AI_ENABLED=false để tắt mà không phải xóa khóa. */
export function isSupportAiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.SUPPORT_AI_ENABLED !== 'false'
}

/**
 * replied: đã gửi câu trả lời · escalated/skipped/failed: AI không trả lời, người gọi phải báo quản trị ·
 * superseded: có tin mới hơn nên lượt này bỏ qua (lượt của tin mới sẽ lo).
 */
export type AiReplyOutcome = 'replied' | 'escalated' | 'skipped' | 'failed' | 'superseded'

let client: Anthropic | null = null
function getClient(): Anthropic {
  client ??= new Anthropic({ timeout: 90_000, maxRetries: 1 })
  return client
}

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
    const response = await getClient().messages.create({
      model: process.env.SUPPORT_AI_MODEL?.trim() || DEFAULT_MODEL,
      max_tokens: 8000,
      system: AI_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: buildAiUserPrompt({
            subject: ticket.subject,
            category: ticket.category,
            clubName: ticket.club?.name,
            messages,
          }),
        },
      ],
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: AI_DECISION_SCHEMA } },
    })
    console.info(`support-ai: phiếu ${ticketId} stop=${response.stop_reason} in=${response.usage.input_tokens} out=${response.usage.output_tokens}`)

    // Bị từ chối hoặc cụt giữa chừng thì không có câu trả lời đáng tin: giao cho người
    if (response.stop_reason !== 'end_turn') return 'escalated'
    const text = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text ?? ''
    decision = parseAiDecision(text)
  } catch (err) {
    if (err instanceof Anthropic.APIError) console.error(`support-ai: lỗi API ${err.status} cho phiếu ${ticketId}`, err.message)
    else console.error(`support-ai: lỗi không mong đợi cho phiếu ${ticketId}`, err)
    return 'failed'
  }

  if (decision.action === 'escalate') {
    console.info(`support-ai: phiếu ${ticketId} chuyển quản trị (${decision.reason})`)
    return 'escalated'
  }

  // Trong lúc model nghĩ, người dùng hoặc nhân viên có thể đã nhắn thêm: nếu vậy thì câu trả lời này đã cũ
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
    console.error(`support-ai: không lưu được câu trả lời cho phiếu ${ticketId}`, error)
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
