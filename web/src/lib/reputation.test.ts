import { describe, expect, it } from 'vitest'
import { buildReputation, fetchReputations, reputationScore, reputationTier } from './reputation'

describe('reputationScore', () => {
  it('người chưa có lịch sử không có điểm', () => {
    expect(reputationScore({ played: 0, noShows: 0, lateCancels: 0 })).toBeNull()
  })

  it('chơi đều không vi phạm là 100', () => {
    expect(reputationScore({ played: 12, noShows: 0, lateCancels: 0 })).toBe(100)
  })

  it('trừ 30 mỗi lần không đến và 10 mỗi lần hủy muộn', () => {
    expect(reputationScore({ played: 5, noShows: 1, lateCancels: 0 })).toBe(70)
    expect(reputationScore({ played: 5, noShows: 0, lateCancels: 2 })).toBe(80)
    expect(reputationScore({ played: 5, noShows: 1, lateCancels: 2 })).toBe(50)
  })

  it('không xuống dưới 0', () => {
    expect(reputationScore({ played: 0, noShows: 9, lateCancels: 9 })).toBe(0)
  })

  it('một người chỉ có vi phạm vẫn có điểm (không bị coi là mới)', () => {
    expect(reputationScore({ played: 0, noShows: 1, lateCancels: 0 })).toBe(70)
  })
})

describe('reputationTier', () => {
  it.each([
    [null, 'new'],
    [100, 'excellent'],
    [90, 'excellent'],
    [89, 'good'],
    [75, 'good'],
    [74, 'fair'],
    [50, 'fair'],
    [49, 'risky'],
    [0, 'risky'],
  ] as const)('điểm %s → %s', (score, tier) => {
    expect(reputationTier(score)).toBe(tier)
  })

  it('một lần không đến là mức "trung bình", hai lần là "rủi ro"', () => {
    expect(buildReputation({ played: 10, noShows: 1, lateCancels: 0 }).tier).toBe('fair')
    expect(buildReputation({ played: 10, noShows: 2, lateCancels: 0 }).tier).toBe('risky')
  })
})

const stub = (rpc: (name: string, args: unknown) => { data: unknown; error: { message: string } | null }) =>
  ({ rpc: async (name: string, args: unknown) => rpc(name, args) }) as never

describe('fetchReputations', () => {
  it('gọi một lần với danh sách đã bỏ trùng và gắn điểm cho từng người', async () => {
    const calls: unknown[] = []
    const supabase = stub((name, args) => {
      calls.push([name, args])
      return { data: [{ user_id: 'u1', played: 4, no_shows: 1, late_cancels: 0 }], error: null }
    })
    const map = await fetchReputations(supabase, ['u1', 'u2', 'u1'])
    expect(calls).toEqual([['get_player_reputation', { p_user_ids: ['u1', 'u2'] }]])
    expect(map.get('u1')).toMatchObject({ score: 70, tier: 'fair', played: 4 })
    // Người không có dòng nào trả về là người mới
    expect(map.get('u2')).toMatchObject({ score: null, tier: 'new' })
  })

  it('lỗi database không làm hỏng: mọi người được coi là mới', async () => {
    const map = await fetchReputations(stub(() => ({ data: null, error: { message: 'boom' } })), ['u1'])
    expect(map.get('u1')?.tier).toBe('new')
  })

  it('danh sách rỗng không gọi database', async () => {
    const supabase = stub(() => {
      throw new Error('không được gọi')
    })
    expect((await fetchReputations(supabase, [])).size).toBe(0)
  })
})
