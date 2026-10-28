import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Điểm uy tín của người chơi, tính từ ba số đếm do hàm get_player_reputation() trả về:
 *   played        số buổi đã chơi (không tính buổi bị báo không đến)
 *   noShows       số buổi không đến trong 180 ngày gần nhất
 *   lateCancels   số lần hủy/rời muộn trong 180 ngày gần nhất
 * Công thức nằm ở đây (không nằm trong database) để chỉnh mà không cần migration; thuần túy nên kiểm thử được mọi nhánh.
 */
export interface ReputationCounts {
  played: number
  noShows: number
  lateCancels: number
}

export type ReputationTier = 'new' | 'excellent' | 'good' | 'fair' | 'risky'

export interface Reputation extends ReputationCounts {
  /** 0-100; null với người chưa có lịch sử nào */
  score: number | null
  tier: ReputationTier
}

export const NO_SHOW_PENALTY = 30
export const LATE_CANCEL_PENALTY = 10

export function reputationScore({ played, noShows, lateCancels }: ReputationCounts): number | null {
  if (played + noShows + lateCancels === 0) return null
  return Math.min(100, Math.max(0, 100 - NO_SHOW_PENALTY * noShows - LATE_CANCEL_PENALTY * lateCancels))
}

export function reputationTier(score: number | null): ReputationTier {
  if (score === null) return 'new'
  if (score >= 90) return 'excellent'
  if (score >= 75) return 'good'
  if (score >= 50) return 'fair'
  return 'risky'
}

export function buildReputation(counts: ReputationCounts): Reputation {
  const score = reputationScore(counts)
  return { ...counts, score, tier: reputationTier(score) }
}

const EMPTY: ReputationCounts = { played: 0, noShows: 0, lateCancels: 0 }

/** Số đếm uy tín của nhiều người cùng lúc (một lần gọi database). Người không có dòng nào được coi là mới. */
export async function fetchReputations(
  supabase: SupabaseClient<Database>,
  userIds: readonly string[]
): Promise<Map<string, Reputation>> {
  const ids = [...new Set(userIds)].slice(0, 100)
  const out = new Map<string, Reputation>(ids.map((id) => [id, buildReputation(EMPTY)]))
  if (ids.length === 0) return out

  const { data, error } = await supabase.rpc('get_player_reputation', { p_user_ids: ids })
  if (error) {
    // Uy tín chỉ là thông tin tham khảo cho chủ kèo, không được làm hỏng trang chứa nó
    console.error('fetchReputations lỗi:', error.message)
    return out
  }
  for (const row of data ?? []) {
    out.set(row.user_id, buildReputation({ played: row.played, noShows: row.no_shows, lateCancels: row.late_cancels }))
  }
  return out
}
