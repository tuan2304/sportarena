import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeClient, createFakeDb, type FakeDb } from '@/test/fake-supabase'

const notifyUser = vi.fn()
let db: FakeDb

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => createFakeClient(db) }))
vi.mock('@/lib/notify', () => ({ notifyUser: (...args: unknown[]) => notifyUser(...args) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { settlePayment } from './payments'

const ORDER = 10000001

function seed(overrides: { paymentStatus?: string; bookingStatus?: string; amount?: number } = {}) {
  db = createFakeDb({
    payments: [
      {
        id: 'pay-1',
        order_code: ORDER,
        booking_id: 'bk-1',
        user_id: 'player-1',
        amount: overrides.amount ?? 30000,
        status: overrides.paymentStatus ?? 'pending',
        metadata: { channel: 'club', club_id: 'club-1', bin: '970422' },
        booking: {
          id: 'bk-1',
          status: overrides.bookingStatus ?? 'pending',
          court: { name: 'Sân 1', club: { name: 'CLB Thảo Điền', owner_id: 'owner-1' } },
        },
      },
    ],
    bookings: [{ id: 'bk-1', status: overrides.bookingStatus ?? 'pending' }],
    matches: [{ id: 'm-1', booking_id: 'bk-1', status: 'cancelled' }],
  })
  installSettleRpc()
}

/**
 * Giả lập hàm SQL settle_booking_payment (supabase/migrations/20261106...). Hàm thật chạy trong một transaction;
 * ở đây `slotTaken` mô phỏng lỗi trùng lịch (23P01) và `failure` mô phỏng lỗi database: cả hai trường hợp, thay đổi
 * dở dang phải được hoàn tác, đúng như transaction thật.
 */
function installSettleRpc(opts: { slotTaken?: boolean; failure?: string } = {}) {
  db.rpc.settle_booking_payment = (args) => {
    if (opts.failure) return { data: null, error: { message: opts.failure } }
    const pay = db.tables.payments.find((p) => p.id === args.p_payment_id)
    if (!pay || !['pending', 'cancelled'].includes(pay.status as string)) return { data: 'already_paid', error: null }
    Object.assign(pay, { status: 'paid', payos_transaction_id: args.p_reference || 'SIM_x' })
    if (opts.slotTaken) {
      pay.metadata = { ...(pay.metadata as object), needs_refund: true, reason: 'slot_taken_after_expiry' }
      return { data: 'slot_taken', error: null }
    }
    const bk = db.tables.bookings.find((b) => b.id === pay.booking_id)
    if (bk && ['pending', 'cancelled'].includes(bk.status as string)) bk.status = 'confirmed'
    db.tables.matches.filter((m) => m.booking_id === pay.booking_id && m.status === 'cancelled').forEach((m) => (m.status = 'open'))
    return { data: 'confirmed', error: null }
  }
}

const payment = () => db.tables.payments[0]
const booking = () => db.tables.bookings[0]
const notified = () => notifyUser.mock.calls.map((c) => (c[0] as { userId: string }).userId)

beforeEach(() => {
  notifyUser.mockReset()
})

describe('settlePayment', () => {
  it('trả 404 khi không có đơn thanh toán tương ứng', async () => {
    seed()
    const r = await settlePayment({ orderCode: 999, reference: 'x' })
    expect(r).toMatchObject({ ok: false, status: 404 })
    expect(notifyUser).not.toHaveBeenCalled()
  })

  it('xác nhận cọc: payment → paid, booking → confirmed, báo cả người chơi và chủ sân', async () => {
    seed()
    const r = await settlePayment({ orderCode: ORDER, paidAmount: 30000, reference: 'TF123' })

    expect(r).toEqual({ ok: true, needsRefund: false })
    expect(payment().status).toBe('paid')
    expect(payment().payos_transaction_id).toBe('TF123')
    expect(booking().status).toBe('confirmed')
    expect(notified().sort()).toEqual(['owner-1', 'player-1'])
  })

  it('PayOS gọi lại webhook: chỉ xử lý một lần, không báo trùng', async () => {
    seed()
    await settlePayment({ orderCode: ORDER, paidAmount: 30000, reference: 'TF123' })
    notifyUser.mockClear()

    const again = await settlePayment({ orderCode: ORDER, paidAmount: 30000, reference: 'TF123' })
    expect(again).toMatchObject({ ok: true, alreadyPaid: true })
    expect(notifyUser).not.toHaveBeenCalled()
  })

  it('chuyển thiếu tiền thì từ chối và không đụng vào đơn', async () => {
    seed({ amount: 30000 })
    const r = await settlePayment({ orderCode: ORDER, paidAmount: 20000, reference: 'TF1' })

    expect(r).toMatchObject({ ok: false, status: 400 })
    expect(payment().status).toBe('pending')
    expect(booking().status).toBe('pending')
    expect(notifyUser).not.toHaveBeenCalled()
  })

  it('chuyển dư tiền vẫn được chấp nhận', async () => {
    seed({ amount: 30000 })
    const r = await settlePayment({ orderCode: ORDER, paidAmount: 50000, reference: 'TF1' })
    expect(r).toMatchObject({ ok: true })
    expect(payment().status).toBe('paid')
  })

  it('tiền về sau khi đơn đã hết hạn nhưng sân còn trống: giành lại sân và mở lại kèo', async () => {
    seed({ paymentStatus: 'cancelled', bookingStatus: 'cancelled' })
    const r = await settlePayment({ orderCode: ORDER, paidAmount: 30000, reference: 'LATE' })

    expect(r).toMatchObject({ ok: true, needsRefund: false })
    expect(booking().status).toBe('confirmed')
    expect(payment().status).toBe('paid')
    expect(db.tables.matches[0].status).toBe('open')
  })

  it('tiền về muộn mà sân đã có người khác đặt: ghi nhận để hoàn tiền, chỉ báo người chơi', async () => {
    seed({ paymentStatus: 'cancelled', bookingStatus: 'cancelled' })
    installSettleRpc({ slotTaken: true })

    const r = await settlePayment({ orderCode: ORDER, paidAmount: 30000, reference: 'LATE' })

    expect(r).toMatchObject({ ok: true, needsRefund: true })
    expect(payment().status).toBe('paid')
    // Phải giữ nguyên channel/club_id/bin: webhook gọi lại vẫn cần chúng để chọn đúng khóa kiểm chữ ký
    expect(payment().metadata).toMatchObject({ needs_refund: true, channel: 'club', club_id: 'club-1', bin: '970422' })
    expect(booking().status).toBe('cancelled')
    expect(notified()).toEqual(['player-1'])
  })

  it('lỗi database khi ghi nhận: trả 500 để PayOS gọi lại, payment vẫn pending (đã hoàn tác trọn gói)', async () => {
    seed()
    installSettleRpc({ failure: 'connection lost' })

    const r = await settlePayment({ orderCode: ORDER, paidAmount: 30000, reference: 'TF1' })

    expect(r).toMatchObject({ ok: false, status: 500 })
    expect(payment().status).toBe('pending')
    expect(booking().status).toBe('pending')
    expect(notifyUser).not.toHaveBeenCalled()
  })

  it('không ghi payments/bookings từng bước từ ứng dụng: mọi thay đổi đi qua một lần gọi RPC duy nhất', async () => {
    seed()
    await settlePayment({ orderCode: ORDER, paidAmount: 30000, reference: 'TF1' })

    expect(db.log.filter((l) => l.startsWith('rpc settle_booking_payment'))).toHaveLength(1)
    expect(db.log.filter((l) => /^update (payments|bookings|matches)/.test(l))).toEqual([])
  })
})
