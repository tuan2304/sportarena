import { getTranslations } from 'next-intl/server'
import { getSupabase, getCurrentUser } from '@/lib/supabase/session'
import { RecurringRequests, type OwnerSeries } from '@/components/owner/recurring-requests'
import { fetchReputations } from '@/lib/reputation'

export default async function OwnerRecurringPage() {
  const t = await getTranslations('ownerRecurring')
  const supabase = await getSupabase()
  const user = await getCurrentUser()

  // RLS cho chủ sân đọc lịch cố định ở sân của mình
  const { data: rows } = await supabase
    .from('recurring_bookings')
    .select('id, user_id, weekday, start_time, end_time, ends_on, note, status, court:courts!inner ( name, club:clubs!inner ( name, owner_id ) )')
    .in('status', ['pending', 'active'])
    .eq('court.club.owner_id', user?.id ?? '')
    .order('created_at', { ascending: false })

  const userIds = [...new Set((rows ?? []).map((r) => r.user_id))]
  const [reputations, { data: profiles }] = await Promise.all([
    fetchReputations(supabase, userIds),
    userIds.length
      ? supabase.from('profiles').select('id, full_name').in('id', userIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string }> }),
  ])
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]))

  const items: OwnerSeries[] = (rows ?? []).map((r) => {
    const court = r.court as unknown as { name: string; club: { name: string } | null } | null
    return {
      id: r.id,
      userId: r.user_id,
      customer: nameById.get(r.user_id) || t('guest'),
      courtName: court?.name ?? '',
      clubName: court?.club?.name ?? '',
      weekday: r.weekday,
      startTime: r.start_time,
      endTime: r.end_time,
      endsOn: r.ends_on,
      note: r.note,
      status: r.status as OwnerSeries['status'],
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>
      <RecurringRequests items={items} reputations={Object.fromEntries(reputations)} />
    </div>
  )
}
