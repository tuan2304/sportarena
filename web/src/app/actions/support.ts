'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyAdmins, notifyUser, pushAfterResponse } from '@/lib/notify'
import { isSupportAiEnabled, maybeAutoReply } from '@/lib/support-ai-reply'
import { canAutoReplyCategory } from '@/lib/support-ai'
import { enforceRateLimit } from '@/lib/rate-limit'
import { tr } from '@/lib/localize-error'
import {
  isTicketStatus,
  MAX_ACTIVE_TICKETS_PER_USER,
  validateNewTicket,
  validateReply,
  type TicketStatus,
} from '@/lib/support'

/**
 * Mọi thao tác ghi phiếu hỗ trợ đi qua đây (người dùng không có quyền ghi trực tiếp vào bảng),
 * nên quyền được kiểm tra rõ ràng ở từng hàm.
 */

/**
 * Báo quản trị có phiếu cần xử lý. Nếu trợ lý AI được phép trả lời phiếu này thì để AI thử trước (sau khi
 * phản hồi đã gửi đi, không làm người dùng chờ) và chỉ báo quản trị khi AI không trả lời được.
 */
async function notifyAdminsOrAutoReply(
  ticketId: string,
  category: string,
  notice: { title: string; message: string; link: string },
) {
  if (!isSupportAiEnabled() || !canAutoReplyCategory(category)) {
    await notifyAdmins(notice)
    return
  }
  await pushAfterResponse(async () => {
    let outcome: Awaited<ReturnType<typeof maybeAutoReply>> = 'failed'
    try {
      outcome = await maybeAutoReply(ticketId)
    } catch (err) {
      console.error('support-ai: lỗi ngoài dự kiến', err)
    }
    if (outcome !== 'replied' && outcome !== 'superseded') await notifyAdmins(notice)
  })
}

async function currentActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle()
  return { supabase, user, name: profile?.full_name?.trim() || 'Người dùng', isAdmin: profile?.role === 'admin' }
}

export async function createTicket(input: {
  subject: string
  category: string
  body: string
  clubId?: string | null
}): Promise<{ error?: string; ticketId?: string }> {
  const actor = await currentActor()
  if (!actor) return { error: await tr('Vui lòng đăng nhập để gửi yêu cầu hỗ trợ') }
  const limited = await enforceRateLimit('ticket', actor.user.id)
  if (limited) return { error: await tr(limited) }

  const parsed = validateNewTicket(input)
  if (!parsed.ok) return { error: await tr(parsed.error) }

  const admin = createAdminClient()

  const { count } = await admin
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', actor.user.id)
    .in('status', ['open', 'answered'])
  if ((count ?? 0) >= MAX_ACTIVE_TICKETS_PER_USER) {
    return { error: await tr(`Bạn đang có ${MAX_ACTIVE_TICKETS_PER_USER} yêu cầu chưa giải quyết. Vui lòng chờ hỗ trợ trả lời hoặc đóng bớt yêu cầu cũ.`) }
  }

  // Chỉ gắn cụm sân của chính mình (chủ sân báo vấn đề về sân)
  let clubId: string | null = null
  if (input.clubId) {
    const { data: club } = await actor.supabase.from('clubs').select('id, owner_id').eq('id', input.clubId).maybeSingle()
    if (club && club.owner_id === actor.user.id) clubId = club.id
  }

  const { data: ticket, error } = await admin
    .from('support_tickets')
    .insert({
      user_id: actor.user.id,
      club_id: clubId,
      subject: parsed.value.subject,
      category: parsed.value.category,
      status: 'open',
    })
    .select('id')
    .single()
  if (error || !ticket) {
    console.error('createTicket: lỗi tạo phiếu', error)
    return { error: await tr('Không gửi được yêu cầu. Vui lòng thử lại.') }
  }

  const { error: msgError } = await admin.from('ticket_messages').insert({
    ticket_id: ticket.id,
    sender_id: actor.user.id,
    is_staff: false,
    sender_name: actor.name,
    body: parsed.value.body,
  })
  if (msgError) {
    console.error('createTicket: lỗi lưu nội dung', msgError)
    await admin.from('support_tickets').delete().eq('id', ticket.id)
    return { error: await tr('Không gửi được yêu cầu. Vui lòng thử lại.') }
  }

  await notifyAdminsOrAutoReply(ticket.id, parsed.value.category, {
    title: 'Yêu cầu hỗ trợ mới',
    message: `${actor.name}: ${parsed.value.subject}`,
    link: `/admin/tickets/${ticket.id}`,
  })

  revalidatePath('/support')
  revalidatePath('/admin/tickets')
  return { ticketId: ticket.id }
}

export async function replyToTicket(ticketId: string, body: string): Promise<{ error?: string }> {
  const actor = await currentActor()
  if (!actor) return { error: await tr('Vui lòng đăng nhập') }
  const limited = await enforceRateLimit('ticketReply', actor.user.id)
  if (limited) return { error: await tr(limited) }

  const parsed = validateReply(body)
  if (!parsed.ok) return { error: await tr(parsed.error) }

  const admin = createAdminClient()
  const { data: ticket } = await admin.from('support_tickets').select('id, user_id, subject, status, category').eq('id', ticketId).maybeSingle()
  if (!ticket) return { error: await tr('Không tìm thấy yêu cầu hỗ trợ') }

  const isAuthor = ticket.user_id === actor.user.id
  if (!isAuthor && !actor.isAdmin) return { error: await tr('Bạn không có quyền trả lời yêu cầu này') }
  if (ticket.status === 'closed' && !actor.isAdmin) {
    return { error: await tr('Yêu cầu này đã đóng. Hãy tạo yêu cầu mới nếu bạn cần thêm hỗ trợ.') }
  }

  // Quản trị trả lời phiếu của người khác = nhân viên hỗ trợ; còn lại là người dùng
  const isStaff = actor.isAdmin && !isAuthor
  const { error } = await admin.from('ticket_messages').insert({
    ticket_id: ticketId,
    sender_id: actor.user.id,
    is_staff: isStaff,
    sender_name: isStaff ? 'Hỗ trợ SportArena' : actor.name,
    body: parsed.value,
  })
  if (error) {
    console.error('replyToTicket lỗi', error)
    return { error: await tr('Không gửi được tin nhắn. Vui lòng thử lại.') }
  }

  // Nhân viên trả lời → chờ người dùng; người dùng trả lời (kể cả phiếu đã giải quyết) → mở lại chờ hỗ trợ
  await admin
    .from('support_tickets')
    .update({ status: isStaff ? 'answered' : 'open', last_message_at: new Date().toISOString() })
    .eq('id', ticketId)

  if (isStaff) {
    await notifyUser({
      userId: ticket.user_id,
      title: 'Hỗ trợ đã trả lời bạn',
      message: ticket.subject,
      type: 'system',
      link: `/support/${ticketId}`,
    })
  } else {
    await notifyAdminsOrAutoReply(ticketId, ticket.category, {
      title: 'Người dùng vừa trả lời yêu cầu hỗ trợ',
      message: `${actor.name}: ${ticket.subject}`,
      link: `/admin/tickets/${ticketId}`,
    })
  }

  revalidatePath(`/support/${ticketId}`)
  revalidatePath(`/admin/tickets/${ticketId}`)
  revalidatePath('/admin/tickets')
  return {}
}

export async function setTicketStatus(ticketId: string, status: string): Promise<{ error?: string }> {
  const actor = await currentActor()
  if (!actor) return { error: await tr('Vui lòng đăng nhập') }
  if (!isTicketStatus(status)) return { error: await tr('Trạng thái không hợp lệ') }

  const admin = createAdminClient()
  const { data: ticket } = await admin.from('support_tickets').select('id, user_id, subject').eq('id', ticketId).maybeSingle()
  if (!ticket) return { error: await tr('Không tìm thấy yêu cầu hỗ trợ') }

  const isAuthor = ticket.user_id === actor.user.id
  // Người dùng chỉ được tự đóng yêu cầu của mình; mọi trạng thái khác là việc của quản trị
  if (!actor.isAdmin && !(isAuthor && status === 'closed')) {
    return { error: await tr('Bạn không có quyền đổi trạng thái này') }
  }

  const next: TicketStatus = status
  const { error } = await admin.from('support_tickets').update({ status: next }).eq('id', ticketId)
  if (error) {
    console.error('setTicketStatus lỗi', error)
    return { error: await tr('Không cập nhật được trạng thái') }
  }

  if (actor.isAdmin && !isAuthor && (next === 'resolved' || next === 'closed')) {
    await notifyUser({
      userId: ticket.user_id,
      title: next === 'resolved' ? 'Yêu cầu hỗ trợ đã được giải quyết' : 'Yêu cầu hỗ trợ đã được đóng',
      message: ticket.subject,
      type: 'system',
      link: `/support/${ticketId}`,
    })
  }

  revalidatePath(`/support/${ticketId}`)
  revalidatePath(`/admin/tickets/${ticketId}`)
  revalidatePath('/admin/tickets')
  revalidatePath('/support')
  return {}
}
