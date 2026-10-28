import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSupabase, getCurrentUser } from '@/lib/supabase/session'
import { MainHeader } from '@/components/layout/main-header'
import { RecurringManager, type CourtOption, type SeriesItem, type WaitItem } from '@/components/booking/recurring-manager'
import { todayKey } from '@/lib/recurring'

export async function generateMetadata() {
  const t = await getTranslations('recurring')
  return { title: t('metaTitle'), robots: { index: false, follow: false } }
}

interface RecurringPageProps {
  searchParams: Promise<{ court?: string }>
}

export default async function RecurringPage({ searchParams }: RecurringPageProps) {
  const { court } = await searchParams
  const t = await getTranslations('recurring')
  const supabase = await getSupabase()
  const user = await getCurrentUser()

  if (!user) redirect('/login?next=/recurring')

  const [{ data: courtRows }, { data: seriesRows }, { data: waitRows }] = await Promise.all([
    supabase
      .from('courts')
      .select('id, name, club:clubs!inner ( name, is_active )')
      .eq('is_active', true)
      .eq('club.is_active', true)
      .order('name')
      .limit(300),
    supabase
      .from('recurring_bookings')
      .select('id, weekday, start_time, end_time, starts_on, ends_on, status, court:courts ( name, club:clubs ( name ) )')
      .eq('user_id', user.id)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false }),
    supabase
      .from('slot_waitlist')
      .select('id, start_time, end_time, status, court:courts ( name, club:clubs ( name ) )')
      .eq('user_id', user.id)
      .in('status', ['waiting', 'notified'])
      .order('start_time'),
  ])

  const courts: CourtOption[] = (courtRows ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    clubName: (c.club as unknown as { name: string } | null)?.name ?? '',
  }))
  const names = (row: unknown) => {
    const c = row as { name: string; club: { name: string } | null } | null
    return { courtName: c?.name ?? '', clubName: c?.club?.name ?? '' }
  }
  const series: SeriesItem[] = (seriesRows ?? []).map((s) => ({
    id: s.id,
    ...names(s.court),
    weekday: s.weekday,
    startTime: s.start_time,
    endTime: s.end_time,
    startsOn: s.starts_on,
    endsOn: s.ends_on,
    status: s.status as SeriesItem['status'],
  }))
  const waits: WaitItem[] = (waitRows ?? []).map((w) => ({
    id: w.id,
    ...names(w.court),
    startTime: w.start_time,
    endTime: w.end_time,
    status: w.status as WaitItem['status'],
  }))

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <MainHeader />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{t('heading')}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">{t('subheading')}</p>
        </div>
        <RecurringManager courts={courts} series={series} waits={waits} initialCourtId={court} todayKey={todayKey()} />
      </main>
    </div>
  )
}
