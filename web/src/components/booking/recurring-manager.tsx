'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { CalendarClock, Hourglass, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { requestRecurringBooking, endMyRecurring } from '@/app/actions/recurring'
import { leaveSlotWaitlist } from '@/app/actions/waitlist'
import { intlLocale, isLocale } from '@/i18n/config'
import { formatDate, formatTime } from '@/lib/format'
import { weekdayName } from '@/lib/recurring-labels'
import { minutesToTime } from '@/lib/recurring'

export interface CourtOption {
  id: string
  name: string
  clubName: string
}

export interface SeriesItem {
  id: string
  courtName: string
  clubName: string
  weekday: number
  startTime: string
  endTime: string
  startsOn: string
  endsOn: string | null
  status: 'pending' | 'active'
}

export interface WaitItem {
  id: string
  courtName: string
  clubName: string
  startTime: string
  endTime: string
  status: 'waiting' | 'notified'
}

interface Props {
  courts: CourtOption[]
  series: SeriesItem[]
  waits: WaitItem[]
  initialCourtId?: string
  todayKey: string
}

const selectClass = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm'
const startOptions = Array.from({ length: 36 }, (_, i) => 6 * 60 + i * 30) // 06:00 - 23:30
const endOptions = Array.from({ length: 37 }, (_, i) => 6 * 60 + 30 + i * 30).filter((m) => m <= 24 * 60) // 06:30 - 24:00

export function RecurringManager({ courts, series, waits, initialCourtId, todayKey }: Props) {
  const t = useTranslations('recurring')
  const lang = useLocale()
  const locale = intlLocale(isLocale(lang) ? lang : 'vi')
  const router = useRouter()
  const askConfirm = useConfirm()

  const [courtId, setCourtId] = useState(courts.some((c) => c.id === initialCourtId) ? initialCourtId! : (courts[0]?.id ?? ''))
  const [weekday, setWeekday] = useState(2)
  const [startMin, setStartMin] = useState(19 * 60)
  const [endMin, setEndMin] = useState(20 * 60)
  const [endsOn, setEndsOn] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy('form')
    const res = await requestRecurringBooking({
      courtId,
      weekday,
      startTime: minutesToTime(startMin),
      endTime: minutesToTime(endMin),
      endsOn: endsOn || null,
      note,
    })
    setBusy(null)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(t('requested'))
    setNote('')
    router.refresh()
  }

  async function endSeries(id: string) {
    const ok = await askConfirm({
      title: t('endTitle'),
      description: t('endText'),
      confirmText: t('endConfirm'),
      cancelText: t('endKeep'),
      destructive: true,
    })
    if (!ok) return
    setBusy(id)
    const res = await endMyRecurring(id)
    setBusy(null)
    if (res.error) toast.error(res.error)
    else {
      toast.success(t('ended'))
      router.refresh()
    }
  }

  async function leaveWait(id: string) {
    setBusy(id)
    const res = await leaveSlotWaitlist(id)
    setBusy(null)
    if (res.error) toast.error(res.error)
    else {
      toast.success(t('waitLeft'))
      router.refresh()
    }
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="w-4 h-4 text-emerald-700 dark:text-emerald-400" aria-hidden />
            {t('formTitle')}
          </CardTitle>
          <CardDescription>{t('formHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          {courts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noCourts')}</p>
          ) : (
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="r-court">{t('court')}</Label>
                <select id="r-court" value={courtId} onChange={(e) => setCourtId(e.target.value)} className={selectClass}>
                  {courts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.clubName} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-weekday">{t('weekday')}</Label>
                <select id="r-weekday" value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} className={selectClass}>
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                    <option key={d} value={d}>
                      {weekdayName(d, locale)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="r-start">{t('from')}</Label>
                  <select
                    id="r-start"
                    value={startMin}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setStartMin(v)
                      if (endMin <= v) setEndMin(Math.min(v + 60, 24 * 60))
                    }}
                    className={selectClass}
                  >
                    {startOptions.map((m) => (
                      <option key={m} value={m}>
                        {minutesToTime(m)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r-end">{t('to')}</Label>
                  <select id="r-end" value={endMin} onChange={(e) => setEndMin(Number(e.target.value))} className={selectClass}>
                    {endOptions
                      .filter((m) => m > startMin)
                      .map((m) => (
                        <option key={m} value={m}>
                          {minutesToTime(m)}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-ends">{t('endsOn')}</Label>
                <Input id="r-ends" type="date" min={todayKey} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
                <p className="text-xs text-muted-foreground">{t('endsOnHint')}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-note">{t('note')}</Label>
                <Input id="r-note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('notePlaceholder')} />
              </div>
              <div className="sm:col-span-2 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">{t('approvalHint')}</p>
                <Button type="submit" disabled={busy === 'form' || !courtId} className="bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer">
                  {busy === 'form' && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" aria-hidden />}
                  {t('submit')}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3" aria-labelledby="my-series">
        <h2 id="my-series" className="text-lg font-bold">{t('mySeries')}</h2>
        {series.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">{t('noSeries')}</CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {series.map((s) => (
              <li key={s.id}>
                <Card>
                  <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <div className="font-bold text-sm">
                        {t('seriesLabel', { day: weekdayName(s.weekday, locale), start: s.startTime.slice(0, 5), end: s.endTime.slice(0, 5) })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {s.clubName} — {s.courtName}
                        {s.endsOn ? ` · ${t('until', { date: s.endsOn.split('-').reverse().join('/') })}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={s.status === 'active' ? 'border-emerald-500/30 text-emerald-700 dark:text-emerald-400' : 'border-amber-500/30 text-amber-700 dark:text-amber-400'}>
                        {s.status === 'active' ? t('statusActive') : t('statusPending')}
                      </Badge>
                      <Button size="sm" variant="ghost" disabled={busy === s.id} onClick={() => endSeries(s.id)} className="text-red-600 dark:text-red-400 cursor-pointer">
                        {s.status === 'active' ? t('end') : t('withdraw')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
        {series.some((s) => s.status === 'active') && (
          <p className="text-xs text-muted-foreground">
            {t('seriesBookingsHint')}{' '}
            <Link href="/my-bookings" className="underline underline-offset-2">{t('seeBookings')}</Link>
          </p>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="my-waits">
        <h2 id="my-waits" className="text-lg font-bold flex items-center gap-2">
          <Hourglass className="w-4 h-4 text-amber-600 dark:text-amber-400" aria-hidden />
          {t('waitlist')}
        </h2>
        {waits.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">{t('noWaits')}</CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {waits.map((w) => (
              <li key={w.id}>
                <Card>
                  <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <div className="font-bold text-sm">
                        {formatTime(w.startTime)} - {formatTime(w.endTime)} ({formatDate(w.startTime)})
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {w.clubName} — {w.courtName}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={w.status === 'notified' ? 'border-emerald-500/30 text-emerald-700 dark:text-emerald-400' : ''}>
                        {w.status === 'notified' ? t('waitNotified') : t('waitWaiting')}
                      </Badge>
                      <Button size="sm" variant="ghost" disabled={busy === w.id} onClick={() => leaveWait(w.id)} className="cursor-pointer">
                        {t('waitLeave')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
