import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSupabase, getCurrentUser } from '@/lib/supabase/session'
import { MainHeader } from '@/components/layout/main-header'
import { MyBookingsView } from '@/components/booking/my-bookings-view'

export async function generateMetadata() {
  const t = await getTranslations('myBookings')
  return { title: t('metaTitle'), robots: { index: false, follow: false } }
}

export default async function MyBookingsPage() {
  const t = await getTranslations('myBookings')
  const supabase = await getSupabase()
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login?next=/my-bookings')
  }

  // 1. Fetch user bookings with court, club, and matches
  const { data: bookings } = await supabase
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
          free_cancel_hours
        )
      ),
      matches (*)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // 2. Fetch matches the user participated in
  const { data: participations } = await supabase
    .from('match_participants')
    .select(`
      id,
      match_id,
      user_id,
      status,
      message,
      joined_at,
      match:matches (
        id,
        title,
        status,
        sport_type,
        cost_sharing_type,
        cost_per_person,
        current_players,
        required_players,
        start_time,
        end_time,
        court:courts (
          id,
          name,
          club:clubs (
            id,
            name,
            address
          )
        )
      )
    `)
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <MainHeader />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            {t('heading')}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {t('subheading')}
          </p>
          <Link href="/recurring" className="inline-block mt-2 py-2.5 -my-1 text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:underline underline-offset-2">
            {t('recurringLink')}
          </Link>
        </div>

        <MyBookingsView
          bookings={bookings || []}
          participations={participations || []}
        />
      </main>
    </div>
  )
}
