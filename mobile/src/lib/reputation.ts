import { supabase } from './supabase'
import { buildReputation, type Reputation } from '../shared/reputation-score'

export type { Reputation }

/**
 * Điểm uy tín của nhiều người chơi (tối đa 100 mỗi lần). Hàm get_player_reputation chỉ trả số đếm công khai; điểm và hạng
 * tính bằng cùng công thức với web (shared/reputation-score.ts). Lỗi mạng thì trả rỗng vì uy tín chỉ là thông tin tham khảo.
 */
export async function fetchReputations(userIds: readonly string[]): Promise<Record<string, Reputation>> {
  const ids = [...new Set(userIds.filter(Boolean))].slice(0, 100)
  const out: Record<string, Reputation> = {}
  if (ids.length === 0) return out

  const { data, error } = await supabase.rpc('get_player_reputation', { p_user_ids: ids })
  if (error) {
    console.warn('Không tải được điểm uy tín:', error.message)
    return out
  }
  for (const id of ids) out[id] = buildReputation({ played: 0, noShows: 0, lateCancels: 0 })
  for (const row of (data ?? []) as Array<{ user_id: string; played: number; no_shows: number; late_cancels: number }>) {
    out[row.user_id] = buildReputation({ played: row.played, noShows: row.no_shows, lateCancels: row.late_cancels })
  }
  return out
}
