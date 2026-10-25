import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyUser } from '@/lib/notify'

/**
 * Chủ kèo duyệt hoặc từ chối một người xin tham gia. Dùng chung cho Server Action của web và API của ứng dụng mobile
 * (nút "Duyệt/Từ chối" ngay trên thông báo đẩy). Trả lỗi bằng tiếng Việt, nơi gọi dịch.
 */
export async function respondToParticipant(
  userId: string,
  participantId: string,
  newStatus: 'accepted' | 'rejected'
): Promise<{ error: string } | { success: true }> {
  const admin = createAdminClient()

  const { data: participant, error: pErr } = await admin
    .from('match_participants')
    .select('id, status, user_id, match:matches ( id, title, creator_id, status )')
    .eq('id', participantId)
    .single()

  if (pErr || !participant) {
    return { error: 'Không tìm thấy thông tin người tham gia' }
  }

  const match = participant.match as unknown as {
    id: string
    title: string
    creator_id: string
    status: string
  } | null

  if (!match || match.creator_id !== userId) {
    return { error: 'Chỉ chủ phòng mới có quyền duyệt thành viên' }
  }
  if (participant.status !== 'pending') {
    return { error: 'Yêu cầu này đã được xử lý trước đó' }
  }
  if (newStatus === 'accepted' && !['open', 'full'].includes(match.status)) {
    return { error: 'Kèo này đã đóng, không thể duyệt thêm thành viên' }
  }

  // current_players và status của kèo do trigger trong database tự cập nhật; trigger cũng chặn duyệt quá số người
  const { error: updateErr } = await admin
    .from('match_participants')
    .update({ status: newStatus })
    .eq('id', participantId)
    .eq('status', 'pending')

  if (updateErr) {
    if (updateErr.message.includes('MATCH_FULL')) {
      return { error: 'Kèo đã đủ người, không thể duyệt thêm' }
    }
    if (updateErr.message.includes('MATCH_CLOSED')) {
      return { error: 'Kèo này đã đóng, không thể duyệt thêm thành viên' }
    }
    console.error('respondParticipant lỗi', updateErr)
    return { error: 'Không thể cập nhật yêu cầu' }
  }

  const isAccepted = newStatus === 'accepted'
  await notifyUser({
    userId: participant.user_id,
    title: isAccepted ? 'Yêu cầu tham gia đã được duyệt! 🎉' : 'Yêu cầu tham gia bị từ chối',
    message: isAccepted
      ? `Chủ kèo đã duyệt bạn vào kèo "${match.title || 'giao lưu'}". Hãy chuẩn bị đồ và ra sân đúng giờ nhé!`
      : `Rất tiếc, yêu cầu tham gia kèo "${match.title || 'giao lưu'}" của bạn đã bị từ chối bởi chủ kèo.`,
    type: 'match',
    link: `/matches/${match.id}`,
  })

  revalidatePath(`/matches/${match.id}`)
  return { success: true }
}
