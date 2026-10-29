/**
 * Điểm uy tín của người chơi, tính từ ba số đếm do hàm get_player_reputation() trả về (xem migration 20261107):
 *   played        số buổi đã chơi (không tính buổi bị báo không đến)
 *   noShows       số buổi không đến trong 180 ngày gần nhất
 *   lateCancels   số lần hủy/rời muộn trong 180 ngày gần nhất
 * File thuần túy (không import gì) và được sao chép sang mobile/src/shared bằng `npm run sync:mobile`.
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
