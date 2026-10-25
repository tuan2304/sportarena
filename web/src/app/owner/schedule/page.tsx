import { getTranslations } from 'next-intl/server'
import { getSupabase, getCurrentUser } from '@/lib/supabase/session'
import { ScheduleView } from '@/components/owner/schedule-view'
import type { BookingStatus } from '@/types/database'

export default async function OwnerSchedulePage() {
  const t = await getTranslations('ownerSchedule')
  const supabase = await getSupabase()
  const user = await getCurrentUser()

  // 1. Lấy tất cả sân con của các cụm sân mà user làm chủ
  const { data: clubs } = await supabase
    .from('clubs')
    .select(`
      id,
      name,
      courts (
        id,
        name,
        sport_type
      )
    `)
    .eq('owner_id', user?.id || '')

  const courts = (clubs || []).flatMap((club) =>
    (club.courts || []).map((court: { id: string; name: string; sport_type: string }) => ({
      id: court.id,
      name: court.name,
      club_name: club.name,
      sport_type: court.sport_type,
    }))
  )

  const courtIds = courts.map((c) => c.id)

  // 2. Lấy danh sách booking của các sân này
  let bookings: Array<{
    id: string
    court_id: string
    start_time: string
    end_time: string
    total_price: number
    deposit_amount: number
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
    user_name: string
    user_phone: string
    court_name: string
  }> = []

  if (courtIds.length > 0) {
    const { data: bookingData } = await supabase
      .from('bookings')
      .select(`
        id,
        court_id,
        start_time,
        end_time,
        total_price,
        deposit_amount,
        status,
        court:courts(name),
        profile:profiles(full_name)
      `)
      .in('court_id', courtIds)
      .order('start_time', { ascending: true })

    // Số điện thoại không đọc được trực tiếp từ profiles; hàm này chỉ trả khách đặt sân của chủ sân
    const { data: contacts } = await supabase.rpc('get_booking_contacts', {
      p_booking_ids: (bookingData || []).map((b) => b.id),
    })
    const phoneByBooking = new Map((contacts || []).map((c) => [c.booking_id, c.phone_number]))

    bookings = (bookingData || []).map((item) => ({
      id: item.id,
      court_id: item.court_id,
      start_time: item.start_time,
      end_time: item.end_time,
      total_price: Number(item.total_price),
      deposit_amount: Number(item.deposit_amount),
      status: item.status as BookingStatus,
      user_name: item.profile?.full_name || t('guest'),
      user_phone: phoneByBooking.get(item.id) || t('noPhone'),
      court_name: item.court?.name || t('standardCourt'),
    }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('subtitle')}
        </p>
      </div>

      <ScheduleView courts={courts} initialBookings={bookings} />
    </div>
  )
}
