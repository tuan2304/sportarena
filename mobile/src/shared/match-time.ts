/**
 * Khung giờ của kèo ghép: kèo gắn 1-1 với đơn đặt sân nên giờ bắt đầu/kết thúc của kèo chính là của đơn.
 * Qua giờ kết thúc thì kèo không còn nhận người tham gia và không hiện ở danh sách kèo.
 */
export type MatchPhase = 'upcoming' | 'live' | 'ended'

/** Chưa tới giờ, đang diễn ra, hay đã qua giờ kết thúc. Thiếu giờ thì coi như chưa tới (không tự ẩn kèo). */
export function matchPhase(
  startISO: string | null | undefined,
  endISO: string | null | undefined,
  nowMs: number
): MatchPhase {
  const end = endISO ? new Date(endISO).getTime() : NaN
  if (Number.isFinite(end) && end <= nowMs) return 'ended'
  const start = startISO ? new Date(startISO).getTime() : NaN
  if (Number.isFinite(start) && start <= nowMs) return 'live'
  return 'upcoming'
}

/** Kèo đã qua giờ kết thúc (đúng giờ kết thúc là đã hết). */
export function isMatchEnded(endISO: string | null | undefined, nowMs: number): boolean {
  return matchPhase(null, endISO, nowMs) === 'ended'
}
