import { getTranslations } from 'next-intl/server'
import { getSupabase, getCurrentUser } from '@/lib/supabase/session'
import { RefundList, type RefundRow } from '@/components/owner/refund-list'
import { RotateCcw } from 'lucide-react'

export async function generateMetadata() {
  const t = await getTranslations('ownerRefunds')
  return { title: t('metaTitle') }
}

export default async function OwnerRefundsPage() {
  const t = await getTranslations('ownerRefunds')
  const supabase = await getSupabase()
  const user = await getCurrentUser()

  // RLS cho chủ sân xem đơn thuộc cụm sân của mình; chỉ lấy các đơn có phát sinh hoàn cọc
  const { data } = await supabase
    .from('bookings')
    .select('id, start_time, end_time, refund_amount, refund_status, cancelled_by, refunded_at, user_id, court:courts ( name, club:clubs ( name, owner_id ) )')
    .in('refund_status', ['pending', 'refunded'])
    .order('refund_status', { ascending: true }) // 'pending' xếp trước 'refunded'
    .order('cancelled_at', { ascending: false })
    .limit(100)

  const mine = (data ?? []).filter((b) => {
    const court = b.court as unknown as { club: { owner_id: string } | null } | null
    return court?.club?.owner_id === user?.id
  })

  // Số điện thoại không đọc trực tiếp được từ profiles; hàm này chỉ trả khách đặt sân của cụm sân do mình sở hữu
  const { data: contacts } = mine.length
    ? await supabase.rpc('get_booking_contacts', { p_booking_ids: mine.map((b) => b.id) })
    : { data: [] }
  const contactByBooking = new Map((contacts ?? []).map((c) => [c.booking_id, c]))

  const rows: RefundRow[] = mine.map((b) => {
    const court = b.court as unknown as { name: string; club: { name: string } | null } | null
    const contact = contactByBooking.get(b.id)
    return {
      id: b.id,
      clubName: court?.club?.name ?? t('clubFallback'),
      courtName: court?.name ?? t('courtFallback'),
      start_time: b.start_time,
      end_time: b.end_time,
      refund_amount: Number(b.refund_amount),
      refund_status: b.refund_status as 'pending' | 'refunded',
      cancelled_by: b.cancelled_by,
      refunded_at: b.refunded_at,
      customerName: contact?.full_name || t('customerFallback'),
      customerPhone: contact?.phone_number ?? null,
    }
  })

  const pendingCount = rows.filter((r) => r.refund_status === 'pending').length

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
          <RotateCcw className="w-7 h-7 text-emerald-700 dark:text-emerald-400" aria-hidden />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('subtitle')}
          {pendingCount > 0 && (
            <strong className="text-amber-700 dark:text-amber-400"> {t('pending', { count: pendingCount })}</strong>
          )}
        </p>
      </div>

      <RefundList rows={rows} />
    </div>
  )
}
