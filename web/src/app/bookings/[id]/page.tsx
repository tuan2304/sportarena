import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSupabase, getCurrentUser } from '@/lib/supabase/session'
import { MainHeader } from '@/components/layout/main-header'
import { BookingPaymentView, type BookingPaymentViewProps } from '@/components/booking/booking-payment-view'
import { isPaymentSimulationEnabled } from '@/lib/payos'

interface BookingPageProps {
  params: Promise<{
    id: string
  }>
}

export async function generateMetadata() {
  const t = await getTranslations('myBookings')
  return { title: t('detailMetaTitle'), robots: { index: false, follow: false } }
}

export default async function BookingPage({ params }: BookingPageProps) {
  const { id } = await params
  const t = await getTranslations('myBookings')
  const supabase = await getSupabase()
  const user = await getCurrentUser()

  if (!user) {
    redirect(`/login?next=/bookings/${id}`)
  }

  // Lấy booking kèm thông tin court, club và payment
  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      *,
      court:courts (
        id,
        name,
        sport_type,
        club:clubs (
          id,
          name,
          address,
          district,
          city,
          latitude,
          longitude
        )
      ),
      payments (*)
    `)
    .eq('id', id)
    .single()

  // Chỉ người đặt mới xem được trang thanh toán (chủ sân xem đơn ở /owner/schedule)
  if (!booking || booking.user_id !== user.id) {
    notFound()
  }

  const courtData = booking.court || { name: t('defaultCourt'), sport_type: 'football' }
  const clubData = courtData.club || { name: t('defaultClub'), address: '' }
  // cột metadata là JSONB nên có kiểu Json; ép về dạng thông tin ngân hàng do createBooking ghi vào
  const paymentData = (booking.payments?.[0] ?? null) as unknown as BookingPaymentViewProps['payment']

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <MainHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <BookingPaymentView
          booking={{
            id: booking.id,
            court_id: booking.court_id,
            start_time: booking.start_time,
            end_time: booking.end_time,
            total_price: Number(booking.total_price),
            deposit_amount: Number(booking.deposit_amount),
            status: booking.status,
            expires_at: booking.expires_at,
            refund_status: booking.refund_status,
            refund_amount: Number(booking.refund_amount),
          }}
          payment={paymentData}
          simulationEnabled={isPaymentSimulationEnabled() && (paymentData as { metadata?: { simulated?: boolean } } | null)?.metadata?.simulated === true}
          // eslint-disable-next-line react-hooks/purity -- server component, chạy một lần mỗi request
          serverNow={Date.now()}
          court={courtData}
          club={clubData}
        />
      </main>
    </div>
  )
}
