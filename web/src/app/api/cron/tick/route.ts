import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendDueReminders } from '@/lib/reminders'
import { notifyFreedWaitlist } from '@/lib/waitlist'
import { generateAllActive } from '@/lib/recurring-service'
import { bearerToken } from '@/lib/mobile-api'

/**
 * Tác vụ định kỳ (gọi mỗi 5-10 phút bởi GitHub Actions, Vercel Cron hoặc pg_cron + pg_net):
 *   1. nhắc lịch trước giờ chơi khoảng 2 giờ
 *   2. báo người trong danh sách chờ khi khung giờ được nhả (có người hủy hoặc hết hạn giữ chỗ)
 *   3. sinh các buổi của lịch cố định hằng tuần cho 4 tuần tới
 * Mỗi bước tự đánh dấu việc đã làm trong database nên gọi chồng nhau hay gọi lại không gửi trùng.
 * Bảo vệ bằng CRON_SECRET (Authorization: Bearer ...); chưa đặt thì từ chối hết thay vì mở cho mọi người gọi.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  const token = bearerToken(request.headers.get('authorization'))
  if (!secret || !token) return false
  const a = Buffer.from(token)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function run(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET chưa được cấu hình' }, { status: 503 })
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Không được phép' }, { status: 401 })
  }

  const admin = createAdminClient()
  // Nhả các đơn giữ chỗ quá hạn trước để danh sách chờ và lịch cố định thấy đúng khung giờ trống
  await admin.rpc('expire_pending_bookings')

  // Ba bước độc lập: một bước lỗi không được chặn hai bước còn lại
  const [reminders, waitlist, recurring] = await Promise.allSettled([
    sendDueReminders(admin),
    notifyFreedWaitlist(admin),
    generateAllActive(admin),
  ])
  const value = <T,>(r: PromiseSettledResult<T>): T | { error: string } =>
    r.status === 'fulfilled' ? r.value : { error: r.reason instanceof Error ? r.reason.message : String(r.reason) }
  for (const [name, r] of [['reminders', reminders], ['waitlist', waitlist], ['recurring', recurring]] as const) {
    if (r.status === 'rejected') console.error(`cron/tick: bước ${name} lỗi`, r.reason)
  }

  return NextResponse.json({ reminders: value(reminders), waitlist: value(waitlist), recurring: value(recurring) })
}

export const GET = run
export const POST = run
