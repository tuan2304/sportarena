import type { SupabaseClient } from '@supabase/supabase-js'
import { computeOwnerStats, rangeFor, type OwnerStats, type StatBooking, type StatCourt } from '@/lib/owner-stats'
import { vnDateKey } from '@/lib/datetime'
import type { Database } from '@/types/database'

/**
 * Đọc dữ liệu thống kê của chủ sân qua RLS (client mang phiên của chính chủ sân). Luôn lọc theo sân thuộc cụm sân của
 * người này: chủ sân cũng có thể là người chơi và RLS cho họ đọc cả đơn mình đặt ở cụm sân khác.
 */
const PAGE = 1000
const MAX_PAGES = 20

export interface OwnerClub {
  id: string
  name: string
}

export interface OwnerAnalytics {
  clubs: OwnerClub[]
  courts: StatCourt[]
  bookings: StatBooking[]
  stats: OwnerStats
  fromKey: string
  toKey: string
  /** Đã chạm giới hạn số dòng đọc được: số liệu có thể thiếu */
  truncated: boolean
}

interface BookingRow {
  id: string
  court_id: string
  start_time: string
  end_time: string
  total_price: number
  deposit_amount: number
  status: string
  cancelled_by: string | null
  no_show_at: string | null
  late_cancel: boolean
  refund_amount: number
  refund_status: string
  recurring_id: string | null
  profile: { full_name: string } | null
}

export async function loadOwnerAnalytics(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  options: { days: number; clubId?: string | null; now?: number; guestLabel?: string }
): Promise<OwnerAnalytics> {
  const { fromKey, toKey, from, to } = rangeFor(vnDateKey(options.now ?? Date.now()), options.days)

  const { data: clubRows } = await supabase
    .from('clubs')
    .select('id, name, open_time, close_time, courts ( id, name, is_active )')
    .eq('owner_id', ownerId)
    .order('name')
  const clubs: OwnerClub[] = (clubRows ?? []).map((c) => ({ id: c.id, name: c.name }))

  const courts: StatCourt[] = (clubRows ?? [])
    .filter((c) => !options.clubId || c.id === options.clubId)
    .flatMap((c) =>
      ((c.courts ?? []) as Array<{ id: string; name: string; is_active: boolean }>).map((court) => ({
        id: court.id,
        name: court.name,
        clubName: c.name,
        openTime: c.open_time,
        closeTime: c.close_time,
        active: court.is_active,
      }))
    )

  const courtById = new Map(courts.map((c) => [c.id, c]))
  const bookings: StatBooking[] = []
  let truncated = false

  if (courts.length > 0) {
    const courtIds = courts.map((c) => c.id)
    for (let page = 0; page < MAX_PAGES; page++) {
      const { data, error } = await supabase
        .from('bookings')
        .select(
          'id, court_id, start_time, end_time, total_price, deposit_amount, status, cancelled_by, no_show_at, late_cancel, refund_amount, refund_status, recurring_id, profile:profiles ( full_name )'
        )
        .in('court_id', courtIds)
        .gte('start_time', from.toISOString())
        .lt('start_time', to.toISOString())
        .order('start_time')
        .range(page * PAGE, page * PAGE + PAGE - 1)
      if (error) {
        console.error('loadOwnerAnalytics: không đọc được đơn đặt sân', error)
        break
      }

      const rows = (data ?? []) as unknown as BookingRow[]
      for (const r of rows) {
        const court = courtById.get(r.court_id)
        bookings.push({
          id: r.id,
          courtId: r.court_id,
          courtName: court?.name ?? '',
          clubName: court?.clubName ?? '',
          customer: r.profile?.full_name || options.guestLabel || '',
          startTime: r.start_time,
          endTime: r.end_time,
          totalPrice: Number(r.total_price),
          depositAmount: Number(r.deposit_amount),
          status: r.status,
          cancelledBy: r.cancelled_by,
          noShow: Boolean(r.no_show_at),
          lateCancel: r.late_cancel,
          refundAmount: Number(r.refund_amount),
          refundStatus: r.refund_status,
          recurring: Boolean(r.recurring_id),
        })
      }
      if (rows.length < PAGE) break
      if (page === MAX_PAGES - 1) truncated = true
    }
  }

  return { clubs, courts, bookings, stats: computeOwnerStats({ bookings, courts, fromKey, toKey }), fromKey, toKey, truncated }
}
