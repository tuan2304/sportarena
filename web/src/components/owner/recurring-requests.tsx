'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { ReputationBadge } from '@/components/profile/reputation-badge'
import { decideRecurringRequest, endRecurringAsOwner } from '@/app/actions/recurring'
import { intlLocale, isLocale } from '@/i18n/config'
import { weekdayName } from '@/lib/recurring-labels'
import type { Reputation } from '@/lib/reputation'

export interface OwnerSeries {
  id: string
  customer: string
  userId: string
  courtName: string
  clubName: string
  weekday: number
  startTime: string
  endTime: string
  endsOn: string | null
  note: string | null
  status: 'pending' | 'active'
}

export function RecurringRequests({ items, reputations }: { items: OwnerSeries[]; reputations: Record<string, Reputation> }) {
  const t = useTranslations('ownerRecurring')
  const lang = useLocale()
  const locale = intlLocale(isLocale(lang) ? lang : 'vi')
  const router = useRouter()
  const askConfirm = useConfirm()
  const [busy, setBusy] = useState<string | null>(null)

  async function decide(id: string, decision: 'approve' | 'reject') {
    setBusy(id)
    const res = await decideRecurringRequest(id, decision)
    setBusy(null)
    if (res.error) toast.error(res.error)
    else {
      toast.success(decision === 'approve' ? t('approved') : t('rejected'))
      router.refresh()
    }
  }

  async function end(id: string) {
    const ok = await askConfirm({
      title: t('endTitle'),
      description: t('endText'),
      confirmText: t('endConfirm'),
      cancelText: t('endKeep'),
      destructive: true,
    })
    if (!ok) return
    setBusy(id)
    const res = await endRecurringAsOwner(id)
    setBusy(null)
    if (res.error) toast.error(res.error)
    else {
      toast.success(t('ended'))
      router.refresh()
    }
  }

  const pending = items.filter((i) => i.status === 'pending')
  const active = items.filter((i) => i.status === 'active')

  const row = (s: OwnerSeries, actions: React.ReactNode) => (
    <li key={s.id}>
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="font-bold text-sm">
              {t('seriesLabel', { day: weekdayName(s.weekday, locale), start: s.startTime.slice(0, 5), end: s.endTime.slice(0, 5) })}
            </div>
            <div className="text-xs text-muted-foreground">
              {s.clubName} — {s.courtName}
              {s.endsOn ? ` · ${t('until', { date: s.endsOn.split('-').reverse().join('/') })}` : ''}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-foreground">{s.customer}</span>
              <ReputationBadge reputation={reputations[s.userId]} />
            </div>
            {s.note && <div className="text-xs text-muted-foreground italic">&ldquo;{s.note}&rdquo;</div>}
          </div>
          <div className="flex items-center gap-2">{actions}</div>
        </CardContent>
      </Card>
    </li>
  )

  return (
    <div className="space-y-8">
      <section className="space-y-3" aria-labelledby="req-pending">
        <h2 id="req-pending" className="text-lg font-bold flex items-center gap-2">
          {t('pending')}
          <Badge variant="outline">{pending.length}</Badge>
        </h2>
        {pending.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">{t('noPending')}</CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {pending.map((s) =>
              row(
                s,
                <>
                  <Button size="sm" disabled={busy === s.id} onClick={() => decide(s.id, 'approve')} className="bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" aria-hidden />
                    {t('approve')}
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy === s.id} onClick={() => decide(s.id, 'reject')} className="text-red-600 dark:text-red-400 border-red-500/30 cursor-pointer">
                    <XCircle className="w-3.5 h-3.5 mr-1" aria-hidden />
                    {t('reject')}
                  </Button>
                </>
              )
            )}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="req-active">
        <h2 id="req-active" className="text-lg font-bold flex items-center gap-2">
          {t('active')}
          <Badge variant="outline">{active.length}</Badge>
        </h2>
        {active.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">{t('noActive')}</CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {active.map((s) =>
              row(
                s,
                <Button size="sm" variant="ghost" disabled={busy === s.id} onClick={() => end(s.id)} className="text-red-600 dark:text-red-400 cursor-pointer">
                  {t('end')}
                </Button>
              )
            )}
          </ul>
        )}
      </section>
    </div>
  )
}
