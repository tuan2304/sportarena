import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { Download, TriangleAlert } from 'lucide-react'
import { getSupabase, getCurrentUser } from '@/lib/supabase/session'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { loadOwnerAnalytics } from '@/lib/owner-analytics'
import { groupDailyByWeek, parseRangeDays, RANGE_OPTIONS } from '@/lib/owner-stats'
import { intlLocale, isLocale } from '@/i18n/config'
import { weekdayName } from '@/lib/recurring-labels'
import { isUuid } from '@/lib/mobile-api'
import { formatVnd } from '@/lib/format'

interface AnalyticsPageProps {
  searchParams: Promise<{ days?: string; club?: string }>
}

const pct = (n: number) => `${Math.round(n * 100)}%`
const oneDecimal = (n: number) => (Math.round(n * 10) / 10).toString()

export default async function OwnerAnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const params = await searchParams
  const t = await getTranslations('ownerAnalytics')
  const lang = await getLocale()
  const locale = intlLocale(isLocale(lang) ? lang : 'vi')
  const supabase = await getSupabase()
  const user = await getCurrentUser()

  const days = parseRangeDays(params.days)
  const clubId = isUuid(params.club) ? params.club : null
  const data = await loadOwnerAnalytics(supabase, user?.id ?? '', { days, clubId, guestLabel: t('guest') })
  const { stats } = data

  const href = (patch: { days?: number; club?: string | null }) => {
    const q = new URLSearchParams()
    q.set('days', String(patch.days ?? days))
    const club = patch.club === undefined ? clubId : patch.club
    if (club) q.set('club', club)
    return `/owner/analytics?${q.toString()}`
  }
  const exportQuery = new URLSearchParams({ days: String(days), ...(clubId ? { club: clubId } : {}) }).toString()

  // Biểu đồ doanh thu: theo ngày, hoặc theo tuần khi khoảng dài để cột không quá dày
  const series = days > 60 ? groupDailyByWeek(stats.daily) : stats.daily
  const maxRevenue = Math.max(1, ...series.map((d) => d.revenue))
  const dateLabel = (key: string) => {
    const [, m, d] = key.split('-')
    return `${d}/${m}`
  }

  const maxCell = Math.max(0, ...stats.heatmap.flat())
  const openHours = data.courts.length
    ? (() => {
        const opens = data.courts.map((c) => parseInt(c.openTime.slice(0, 2), 10) || 0)
        const closes = data.courts.map((c) => parseInt(c.closeTime.slice(0, 2), 10) || 24)
        return Array.from({ length: Math.max(...closes) - Math.min(...opens) }, (_, i) => Math.min(...opens) + i)
      })()
    : []
  const weekdayOrder = [1, 2, 3, 4, 5, 6, 0]
  const shortDay = (d: number) => new Date(Date.UTC(2026, 10, 8 + d)).toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' })

  const kpis = [
    { label: t('kpi.revenue'), value: formatVnd(stats.revenue), hint: t('kpi.revenueHint') },
    { label: t('kpi.bookings'), value: String(stats.bookings), hint: t('kpi.bookingsHint', { avg: formatVnd(stats.averageBooking) }) },
    { label: t('kpi.occupancy'), value: pct(stats.occupancy), hint: t('kpi.occupancyHint', { booked: oneDecimal(stats.bookedHours), available: oneDecimal(stats.availableHours) }) },
    { label: t('kpi.cancelRate'), value: pct(stats.cancelRate), hint: t('kpi.cancelHint', { cancelled: stats.cancelled, noShows: stats.noShows }) },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <a href={`/owner/analytics/export?${exportQuery}`} download>
          <Button variant="outline" className="cursor-pointer">
            <Download className="w-4 h-4 mr-1.5" aria-hidden />
            {t('export')}
          </Button>
        </a>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {RANGE_OPTIONS.map((d) => (
          <Link
            key={d}
            href={href({ days: d })}
            aria-current={d === days ? 'true' : undefined}
            className={`px-3 py-2.5 md:py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              d === days ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-card border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('range', { days: d })}
          </Link>
        ))}
        {data.clubs.length > 1 && (
          <>
            <span className="mx-1 h-4 w-px bg-border" aria-hidden />
            <Link
              href={href({ club: null })}
              aria-current={!clubId ? 'true' : undefined}
              className={`px-3 py-2.5 md:py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                !clubId ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-card border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('allClubs')}
            </Link>
            {data.clubs.map((c) => (
              <Link
                key={c.id}
                href={href({ club: c.id })}
                aria-current={c.id === clubId ? 'true' : undefined}
                className={`px-3 py-2.5 md:py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  c.id === clubId ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-card border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {c.name}
              </Link>
            ))}
          </>
        )}
      </div>

      {data.truncated && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
          {t('truncated')}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className="border-border/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{k.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{k.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground -mt-4">{t('definition')}</p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{days > 60 ? t('revenueByWeek') : t('revenueByDay')}</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.revenue === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('noData')}</p>
          ) : (
            <div className="flex items-end gap-px h-40" role="img" aria-label={t('revenueChartLabel')}>
              {series.map((d) => (
                <div
                  key={d.date}
                  className="flex-1 min-w-px rounded-t bg-emerald-600/80 hover:bg-emerald-500 transition-colors"
                  style={{ height: `${Math.max(d.revenue > 0 ? 2 : 0, (d.revenue / maxRevenue) * 100)}%` }}
                  title={`${days > 60 ? t('weekOf', { date: dateLabel(d.date) }) : dateLabel(d.date)}: ${formatVnd(d.revenue)}`}
                />
              ))}
            </div>
          )}
          {stats.revenue > 0 && (
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>{dateLabel(series[0].date)}</span>
              <span>{dateLabel(series[series.length - 1].date)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('peakTitle')}</CardTitle>
            <CardDescription>{t('peakHint')}</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.peaks.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t('noData')}</p>
            ) : (
              <ol className="space-y-2">
                {stats.peaks.map((p, i) => (
                  <li key={`${p.weekday}-${p.hour}`} className="flex items-center justify-between text-sm">
                    <span className="font-semibold">
                      {i + 1}. {weekdayName(p.weekday, locale)}, {String(p.hour).padStart(2, '0')}:00
                    </span>
                    <span className="text-muted-foreground">{t('peakHours', { hours: oneDecimal(p.hours) })}</span>
                  </li>
                ))}
              </ol>
            )}
            {stats.peakHour !== null && (
              <p className="mt-4 text-xs text-muted-foreground">{t('busiestHour', { hour: String(stats.peakHour).padStart(2, '0') })}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('byCourt')}</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {stats.byCourt.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t('noCourts')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-muted-foreground uppercase border-b border-border">
                    <tr>
                      <th className="py-2 px-4">{t('col.court')}</th>
                      <th className="py-2 px-2 text-right">{t('col.revenue')}</th>
                      <th className="py-2 px-2 text-right">{t('col.bookings')}</th>
                      <th className="py-2 px-4 text-right">{t('col.occupancy')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {stats.byCourt.map((c) => (
                      <tr key={c.courtId}>
                        <td className="py-2 px-4">
                          <div className="font-semibold text-foreground">{c.name}</div>
                          <div className="text-muted-foreground">{c.clubName}</div>
                        </td>
                        <td className="py-2 px-2 text-right font-semibold">{formatVnd(c.revenue)}</td>
                        <td className="py-2 px-2 text-right">{c.bookings}</td>
                        <td className="py-2 px-4 text-right">{pct(c.occupancy)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('heatmapTitle')}</CardTitle>
          <CardDescription>{t('heatmapHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          {maxCell === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('noData')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-xs border-separate border-spacing-1" aria-label={t('heatmapTitle')}>
                <thead>
                  <tr>
                    <th />
                    {openHours.map((h) => (
                      <th key={h} scope="col" className="font-medium text-muted-foreground px-1">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weekdayOrder.map((d) => (
                    <tr key={d}>
                      <th scope="row" className="text-left font-medium text-muted-foreground pr-2 whitespace-nowrap">
                        {shortDay(d)}
                      </th>
                      {openHours.map((h) => {
                        const v = stats.heatmap[d][h]
                        return (
                          <td
                            key={h}
                            title={`${weekdayName(d, locale)} ${String(h).padStart(2, '0')}:00 — ${t('peakHours', { hours: oneDecimal(v) })}`}
                            className="h-6 min-w-6 rounded bg-emerald-600"
                            style={{ opacity: v === 0 ? 0.08 : 0.2 + 0.8 * (v / maxCell) }}
                          />
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{t('legendLow')}</span>
                {[0.1, 0.35, 0.6, 0.85, 1].map((o) => (
                  <span key={o} className="h-3 w-5 rounded bg-emerald-600" style={{ opacity: o }} aria-hidden />
                ))}
                <span>{t('legendHigh')}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
