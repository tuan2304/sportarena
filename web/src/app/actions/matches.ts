'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyUser } from '@/lib/notify'

import { isMatchSkill } from '@/lib/constants'
import { enforceRateLimit } from '@/lib/rate-limit'
import { tr } from '@/lib/localize-error'
import { respondToParticipant } from '@/lib/match-members'
export interface CreateMatchInput {
  bookingId: string
  title: string
  description?: string
  sportType: string
  skillLevel?: 'all' | 'beginner' | 'intermediate' | 'advanced'
  requiredPlayers: number
  costSharingType?: 'split' | 'host_covers'
  costPerPerson?: number
}


/** Lấy người dùng hiện tại; mọi ghi vào DB sau đó dùng admin client nên phải tự kiểm tra quyền. */
async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function createMatch(input: CreateMatchInput) {
  const { supabase, user } = await requireUser()
  if (!user) {
    return { error: await tr('Vui lòng đăng nhập để tạo bài ghép kèo') }
  }

  const limited = await enforceRateLimit('createMatch', user.id)
  if (limited) return { error: await tr(limited) }
  const title = input.title?.trim()
  if (!title) return { error: await tr('Vui lòng nhập tên kèo') }

  // 1. Booking phải tồn tại, của chính user, còn hiệu lực và chưa kết thúc
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select('id, user_id, status, end_time, total_price, court:courts (sport_type)')
    .eq('id', input.bookingId)
    .single()

  if (bookingErr || !booking) {
    return { error: await tr('Không tìm thấy thông tin đơn đặt sân tương ứng') }
  }
  if (booking.user_id !== user.id) {
    return { error: await tr('Bạn chỉ có thể tạo ghép kèo cho đơn đặt sân của chính mình') }
  }
  if (!['pending', 'confirmed'].includes(booking.status)) {
    return { error: await tr('Đơn đặt sân này không còn hiệu lực để mở kèo') }
  }
  if (new Date(booking.end_time).getTime() < Date.now()) {
    return { error: await tr('Khung giờ này đã kết thúc, không thể mở kèo') }
  }

  const admin = createAdminClient()

  // 2. Mỗi đơn chỉ mở một kèo
  const { data: existingMatch } = await admin
    .from('matches')
    .select('id')
    .eq('booking_id', input.bookingId)
    .maybeSingle()
  if (existingMatch) {
    return { error: await tr('Đơn đặt sân này đã được mở ghép kèo trước đó') }
  }

  // 3. Chuẩn hóa dữ liệu và tính chi phí mỗi người
  const requiredPlayers = Math.min(50, Math.max(2, Math.floor(input.requiredPlayers || 2)))
  const costSharingType = input.costSharingType === 'host_covers' ? 'host_covers' : 'split'
  const totalPrice = Number(booking.total_price) || 0
  let costPerPerson = 0
  if (costSharingType === 'split') {
    const requested = Number(input.costPerPerson)
    costPerPerson =
      requested > 0 && requested <= totalPrice ? Math.round(requested) : Math.round(totalPrice / requiredPlayers)
  }

  const courtData = booking.court as unknown as { sport_type: string } | null
  const sportType = courtData?.sport_type || input.sportType || 'football'

  const { data: match, error: matchErr } = await admin
    .from('matches')
    .insert({
      booking_id: input.bookingId,
      creator_id: user.id,
      title: title.slice(0, 100),
      description: input.description?.trim().slice(0, 500) || null,
      sport_type: sportType,
      skill_level: isMatchSkill(input.skillLevel) ? input.skillLevel : 'all',
      required_players: requiredPlayers,
      current_players: 1,
      cost_sharing_type: costSharingType,
      cost_per_person: costPerPerson,
      status: 'open',
    })
    .select('id')
    .single()

  if (matchErr || !match) {
    console.error('createMatch lỗi', matchErr)
    return { error: await tr('Không thể tạo kèo ghép. Vui lòng thử lại.') }
  }

  await admin.from('bookings').update({ is_open_match: true }).eq('id', input.bookingId)

  revalidatePath('/matches')
  revalidatePath('/my-bookings')
  revalidatePath(`/matches/${match.id}`)

  return { matchId: match.id }
}

export async function joinMatch(matchId: string, message?: string) {
  const { user } = await requireUser()
  if (!user) {
    return { error: await tr('Vui lòng đăng nhập để gửi yêu cầu tham gia') }
  }

  const limited = await enforceRateLimit('joinMatch', user.id)
  if (limited) return { error: await tr(limited) }
  const admin = createAdminClient()

  const { data: match, error: matchErr } = await admin
    .from('matches')
    .select('id, creator_id, title, status')
    .eq('id', matchId)
    .single()

  if (matchErr || !match) {
    return { error: await tr('Không tìm thấy thông tin kèo thể thao') }
  }
  if (match.creator_id === user.id) {
    return { error: await tr('Bạn là chủ tạo kèo này nên không cần gửi yêu cầu tham gia') }
  }
  if (match.status !== 'open') {
    return { error: await tr('Kèo này hiện đã đóng hoặc đã đủ người tham gia') }
  }

  const note = message?.trim().slice(0, 300) || null
  let participantId: string | null = null

  const { data: existing } = await admin
    .from('match_participants')
    .select('id, status')
    .eq('match_id', matchId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'pending') {
      return { error: await tr('Bạn đã gửi yêu cầu tham gia rồi, vui lòng chờ chủ kèo duyệt') }
    }
    if (existing.status === 'accepted') {
      return { error: await tr('Bạn đã là thành viên chính thức của kèo này') }
    }
    if (existing.status === 'rejected') {
      return { error: await tr('Yêu cầu trước đó của bạn đã bị từ chối bởi chủ kèo') }
    }
    // status = 'left' → cho phép xin tham gia lại
    const { error: reapplyErr } = await admin
      .from('match_participants')
      .update({ status: 'pending', message: note, joined_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (reapplyErr) return { error: await tr('Không thể gửi lại yêu cầu tham gia') }
    participantId = existing.id
  } else {
    const { data: inserted, error: insertErr } = await admin
      .from('match_participants')
      .insert({ match_id: matchId, user_id: user.id, status: 'pending', message: note })
      .select('id')
      .single()
    if (inserted) participantId = inserted.id
    if (insertErr) {
      console.error('joinMatch lỗi', insertErr)
      return { error: await tr('Không thể gửi yêu cầu tham gia') }
    }
  }

  await notifyUser({
    userId: match.creator_id,
    title: 'Có người xin tham gia kèo! 🏓',
    message: `Một người chơi vừa gửi yêu cầu tham gia kèo "${match.title}". Bấm để xem và duyệt thành viên.`,
    type: 'match',
    // Thông báo đẩy có nút Duyệt / Từ chối ngay trên thông báo (app mobile gọi API respond với participantId này)
    push: participantId ? { categoryId: 'join_request', data: { participantId } } : undefined,
    link: `/matches/${matchId}`,
  })

  revalidatePath(`/matches/${matchId}`)
  return { success: true }
}

export async function respondParticipant(participantId: string, newStatus: 'accepted' | 'rejected'): Promise<{ error?: string; success?: boolean }> {
  const { user } = await requireUser()
  if (!user) {
    return { error: await tr('Vui lòng đăng nhập') }
  }
  if (newStatus !== 'accepted' && newStatus !== 'rejected') {
    return { error: await tr('Trạng thái không hợp lệ') }
  }

  const result = await respondToParticipant(user.id, participantId, newStatus)
  if ('error' in result) return { error: await tr(result.error) }
  return result
}

export async function leaveMatch(matchId: string) {
  const { user } = await requireUser()
  if (!user) {
    return { error: await tr('Vui lòng đăng nhập') }
  }

  const admin = createAdminClient()

  const { data: participant } = await admin
    .from('match_participants')
    .select('id, status')
    .eq('match_id', matchId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!participant || !['pending', 'accepted'].includes(participant.status)) {
    return { error: await tr('Bạn chưa tham gia kèo này') }
  }

  // Trigger tự trừ current_players và mở lại kèo nếu đang "đủ người"
  const { error: updateErr } = await admin
    .from('match_participants')
    .update({ status: 'left' })
    .eq('id', participant.id)

  if (updateErr) {
    console.error('leaveMatch lỗi', updateErr)
    return { error: await tr('Không thể rời kèo') }
  }

  revalidatePath(`/matches/${matchId}`)
  return { success: true }
}

export async function cancelMatch(matchId: string) {
  const { user } = await requireUser()
  if (!user) {
    return { error: await tr('Vui lòng đăng nhập') }
  }

  const admin = createAdminClient()

  const { data: match } = await admin
    .from('matches')
    .select('id, creator_id, booking_id, title')
    .eq('id', matchId)
    .single()

  if (!match || match.creator_id !== user.id) {
    return { error: await tr('Chỉ chủ phòng mới có thể hủy kèo này') }
  }

  await admin.from('matches').update({ status: 'cancelled' }).eq('id', matchId)
  await admin.from('bookings').update({ is_open_match: false }).eq('id', match.booking_id)

  // Báo cho các thành viên đã được duyệt
  const { data: members } = await admin
    .from('match_participants')
    .select('user_id')
    .eq('match_id', matchId)
    .eq('status', 'accepted')

  await Promise.all(
    (members ?? []).map((m) =>
      notifyUser({
        userId: m.user_id,
        title: 'Kèo đã bị hủy',
        message: `Chủ kèo đã hủy kèo "${match.title}".`,
        type: 'match',
        link: `/matches/${matchId}`,
      })
    )
  )

  revalidatePath('/matches')
  revalidatePath('/my-bookings')
  revalidatePath(`/matches/${matchId}`)

  return { success: true }
}
