import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type Admin = SupabaseClient<Database>

/**
 * Đối soát thanh toán cho quản trị. Tiền cọc đi thẳng vào tài khoản chủ sân nên nền tảng không "chi trả", nhưng sổ sách
 * vẫn có thể lệch và cần người xử lý:
 *   needs_refund  tiền về sau khi đơn hết hạn mà sân đã có người khác đặt: khách đã trả, không có sân
 *   stuck         payment đã 'paid' nhưng đơn vẫn pending, hoặc bị cron hết hạn hủy (cancelled_by trống): khách đã trả mà
 *                 đơn không được xác nhận. Đơn do khách/chủ sân chủ động hủy thì cọc đi theo luồng hoàn cọc, không phải kẹt
 *   overdue       khách hủy hợp lệ được hoàn cọc nhưng chủ sân chưa chuyển trả quá OVERDUE_REFUND_DAYS ngày
 */
export const OVERDUE_REFUND_DAYS = 3
const LIMIT = 100

export interface ReconPayment {
  id: string
  orderCode: number
  amount: number
  paidAt: string | null
  channel: string
  customerName: string
  clubName: string
  courtName: string
  bookingId: string
  bookingStatus: string
  startTime: string
  reason: string | null
}

export interface OverdueRefund {
  bookingId: string
  amount: number
  cancelledAt: string
  customerName: string
  clubName: string
  ownerName: string
  daysOverdue: number
}

export interface Reconciliation {
  needsRefund: ReconPayment[]
  stuck: ReconPayment[]
  overdue: OverdueRefund[]
}

interface PaymentRow {
  id: string
  order_code: number
  amount: number
  paid_at: string | null
  created_at: string
  metadata: Record<string, unknown> | null
  customer: { full_name: string } | null
  booking: {
    id: string
    status: string
    start_time: string
    court: { name: string; club: { name: string } | null } | null
  } | null
}

const PAYMENT_SELECT =
  'id, order_code, amount, paid_at, created_at, metadata, customer:profiles(full_name), booking:bookings!inner(id, status, start_time, cancelled_by, court:courts(name, club:clubs(name)))'

function toRecon(row: PaymentRow): ReconPayment {
  const meta = row.metadata ?? {}
  return {
    id: row.id,
    orderCode: Number(row.order_code),
    amount: Number(row.amount),
    paidAt: row.paid_at ?? row.created_at,
    channel: typeof meta.channel === 'string' ? meta.channel : 'platform',
    customerName: row.customer?.full_name || '—',
    clubName: row.booking?.court?.club?.name ?? '—',
    courtName: row.booking?.court?.name ?? '—',
    bookingId: row.booking?.id ?? '',
    bookingStatus: row.booking?.status ?? '',
    startTime: row.booking?.start_time ?? '',
    reason: typeof meta.reason === 'string' ? meta.reason : null,
  }
}

/** Khoản giả lập ở môi trường dev không phải tiền thật nên không đối soát. */
const isReal = (row: PaymentRow) => row.metadata?.simulated !== true
const needsRefundFlag = (row: PaymentRow) => row.metadata?.needs_refund === true

export function daysBetween(from: string, to: Date): number {
  return Math.floor((to.getTime() - new Date(from).getTime()) / 86_400_000)
}

export async function loadReconciliation(admin: Admin, now = new Date()): Promise<Reconciliation> {
  const [refundRes, stuckRes, overdueRes] = await Promise.all([
    admin
      .from('payments')
      .select(PAYMENT_SELECT)
      .eq('status', 'paid')
      .eq('metadata->>needs_refund', 'true')
      .order('paid_at', { ascending: true })
      .limit(LIMIT),
    admin
      .from('payments')
      .select(PAYMENT_SELECT)
      .eq('status', 'paid')
      .in('booking.status', ['pending', 'cancelled'])
      .is('booking.cancelled_by', null)
      .order('paid_at', { ascending: true })
      .limit(LIMIT),
    admin
      .from('bookings')
      .select(
        'id, refund_amount, cancelled_at, customer:profiles(full_name), court:courts(club:clubs(name, owner:profiles!clubs_owner_id_fkey(full_name)))'
      )
      .eq('refund_status', 'pending')
      .lt('cancelled_at', new Date(now.getTime() - OVERDUE_REFUND_DAYS * 86_400_000).toISOString())
      .order('cancelled_at', { ascending: true })
      .limit(LIMIT),
  ])

  for (const res of [refundRes, stuckRes, overdueRes]) {
    if (res.error) {
      console.error('loadReconciliation lỗi', res.error)
      throw new Error('Không tải được dữ liệu đối soát')
    }
  }

  const refundRows = ((refundRes.data ?? []) as unknown as PaymentRow[]).filter(isReal)
  const stuckRows = ((stuckRes.data ?? []) as unknown as PaymentRow[]).filter((r) => isReal(r) && !needsRefundFlag(r))

  const overdue = (
    (overdueRes.data ?? []) as unknown as Array<{
      id: string
      refund_amount: number
      cancelled_at: string
      customer: { full_name: string } | null
      court: { club: { name: string; owner: { full_name: string } | null } | null } | null
    }>
  ).map((b) => ({
    bookingId: b.id,
    amount: Number(b.refund_amount),
    cancelledAt: b.cancelled_at,
    customerName: b.customer?.full_name || '—',
    clubName: b.court?.club?.name ?? '—',
    ownerName: b.court?.club?.owner?.full_name || '—',
    daysOverdue: daysBetween(b.cancelled_at, now),
  }))

  return { needsRefund: refundRows.map(toRecon), stuck: stuckRows.map(toRecon), overdue }
}

/** Số khoản cần quản trị ra tay (hiện ở thanh bên). Không tính khoản chủ sân chưa hoàn vì quản trị không xử lý trực tiếp được. */
export async function countReconciliationIssues(admin: Admin): Promise<number> {
  const [refund, stuck] = await Promise.all([
    admin.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'paid').eq('metadata->>needs_refund', 'true'),
    admin
      .from('payments')
      .select('id, booking:bookings!inner(id)', { count: 'exact', head: true })
      .eq('status', 'paid')
      .in('booking.status', ['pending', 'cancelled'])
      .is('booking.cancelled_by', null),
  ])
  return (refund.count ?? 0) + (stuck.count ?? 0)
}
