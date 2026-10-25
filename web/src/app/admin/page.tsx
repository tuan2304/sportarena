import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPlatformStats, parsePeriod, percent, PERIOD_OPTIONS } from '@/lib/admin-stats'
import { formatNumber, formatVnd } from '@/lib/format'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart } from '@/components/admin/bar-chart'
import { AlertTriangle } from 'lucide-react'

export async function generateMetadata() {
  const t = await getTranslations('admin.overview')
  return { title: t('metaTitle') }
}

function dayLabel(day: string) {
  const [, m, d] = day.split('-')
  return `${d}/${m}`
}

function Kpi({ label, value, hint, accent = false }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-5 space-y-1">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className={`text-2xl font-extrabold tabular-nums ${accent ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>{value}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  )
}

export default async function AdminOverviewPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const t = await getTranslations('admin.overview')
  const { days: daysParam } = await searchParams
  const days = parsePeriod(daysParam)
  const stats = await getPlatformStats(createAdminClient(), days)

  const confirmedRate = percent(stats.bookings.confirmed, stats.bookings.created)
  const cancelRate = percent(stats.bookings.cancelled, stats.bookings.created)

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle', { days })}</p>
        </div>
        <nav className="inline-flex rounded-xl border border-border bg-card p-1" aria-label={t('period')}>
          {PERIOD_OPTIONS.map((d) => (
            <Link
              key={d}
              href={`/admin?days=${d}`}
              aria-current={d === days ? 'page' : undefined}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold ${
                d === days ? 'bg-emerald-700 text-white' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('days', { days: d })}
            </Link>
          ))}
        </nav>
      </div>

      {stats.open_tickets > 0 && (
        <Link href="/admin/tickets" className="flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm hover:bg-amber-500/15">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden />
          <span>{t.rich('openTickets', { count: stats.open_tickets, b: (c) => <b>{c}</b> })}</span>
        </Link>
      )}

      <section aria-labelledby="sec-revenue" className="space-y-3">
        <h2 id="sec-revenue" className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{t('revenueTitle')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label={t('kpiProRevenue')} value={formatVnd(stats.subscriptions.revenue)} hint={t('kpiPayments', { count: formatNumber(stats.subscriptions.count) })} accent />
          <Kpi label={t('kpiGmv')} value={formatVnd(stats.bookings.gmv)} hint={t('kpiGmvHint')} />
          <Kpi label={t('kpiDeposits')} value={formatVnd(stats.deposits.collected)} hint={t('kpiDepositsHint')} />
          <Kpi label={t('kpiPro')} value={formatNumber(stats.clubs.pro)} hint={t('kpiProHint', { count: formatNumber(stats.clubs.total) })} />
        </div>
      </section>

      <section aria-labelledby="sec-ops" className="space-y-3">
        <h2 id="sec-ops" className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{t('opsTitle')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label={t('kpiBookings')} value={formatNumber(stats.bookings.created)} hint={t('kpiBookingsHint', { confirmed: confirmedRate, cancelled: cancelRate, pending: stats.bookings.pending })} />
          <Kpi label={t('kpiUsers')} value={formatNumber(stats.users.total)} hint={t('kpiUsersHint', { new: stats.users.new, owners: stats.users.owners, players: stats.users.players })} />
          <Kpi label={t('kpiClubs')} value={formatNumber(stats.clubs.total)} hint={t('kpiClubsHint', { new: stats.clubs.new, pro: stats.clubs.pro, payos: stats.clubs.own_payos })} />
          <Kpi label={t('kpiCourts')} value={formatNumber(stats.courts_active)} hint={t('kpiCourtsHint', { created: stats.matches.created, open: stats.matches.open })} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('chartBookings')}</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart title={t('chartBookingsLabel')} data={stats.daily.map((d) => ({ label: dayLabel(d.day), value: Number(d.bookings) }))} format={formatNumber} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('chartDeposits')}</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart title={t('chartDepositsLabel')} data={stats.daily.map((d) => ({ label: dayLabel(d.day), value: Number(d.deposits) }))} format={formatVnd} barClassName="bg-amber-500" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('topTitle')}</CardTitle>
          <CardDescription>{t('topSubtitle', { days })}</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.top_clubs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('topEmpty')}</p>
          ) : (
            <ol className="divide-y divide-border">
              {stats.top_clubs.map((c, i) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-muted text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="font-semibold truncate">{c.name}</span>
                  </span>
                  <span className="text-right shrink-0">
                    {t.rich('topBookings', { count: formatNumber(c.bookings), b: (x) => <b>{x}</b> })} · <span className="text-muted-foreground">{formatVnd(c.gmv)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
