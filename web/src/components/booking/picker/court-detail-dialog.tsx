'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Clock, MapPinned, ShieldCheck, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useLabels } from '@/i18n/labels'
import { formatNumber } from '@/lib/format'
import type { CourtData } from './types'

interface CourtDetailDialogProps {
  court: CourtData | null
  open: boolean
  onOpenChange: (open: boolean) => void
  selected: boolean
  onSelect: (courtId: string) => void
  clubOpenTime: string
  clubCloseTime: string
  /** Chính sách hủy của cụm sân, đã dịch; bỏ trống thì không hiện mục này */
  cancelPolicy?: string
}

const hhmm = (time: string) => time.slice(0, 5)

/** Thứ trong tuần dạng ngắn theo ngôn ngữ đang dùng (0 = Chủ nhật). 7/1/2024 là Chủ nhật. */
function weekdayShort(day: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, 7 + day))
}

/** Hộp thoại (overlay) chi tiết một sân con: thông tin, tiền cọc, bảng giá theo khung giờ, chính sách hủy. */
export function CourtDetailDialog({
  court,
  open,
  onOpenChange,
  selected,
  onSelect,
  clubOpenTime,
  clubCloseTime,
  cancelPolicy,
}: CourtDetailDialogProps) {
  const t = useTranslations('booking.picker')
  const locale = useLocale()
  const labels = useLabels()

  if (!court) return null

  const rules = [...court.court_pricing_rules].sort((a, b) => a.start_time.localeCompare(b.start_time))
  const depositSample = Math.round((court.base_price_per_hour * court.deposit_percentage) / 100)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold">{court.name}</DialogTitle>
          <DialogDescription>
            {labels.sport(court.sport_type)}
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border border-border bg-card p-3">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPinned className="w-3.5 h-3.5" aria-hidden /> {t('detailSurface')}
            </dt>
            <dd className="mt-1 font-semibold text-foreground">{court.surface_type || t('detailStandard')}</dd>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" aria-hidden /> {t('detailHours')}
            </dt>
            <dd className="mt-1 font-semibold text-foreground">
              {hhmm(clubOpenTime)} - {hhmm(clubCloseTime)}
            </dd>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 sm:col-span-2">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Wallet className="w-3.5 h-3.5" aria-hidden /> {t('detailDeposit')}
            </dt>
            <dd className="mt-1 font-semibold text-foreground">
              {t('detailDepositValue', { percent: court.deposit_percentage, amount: formatNumber(depositSample) })}
            </dd>
          </div>
        </dl>

        <section aria-labelledby={`court-pricing-${court.id}`} className="space-y-2">
          <h3 id={`court-pricing-${court.id}`} className="text-sm font-bold text-foreground">
            {t('detailPricing')}
          </h3>
          <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden text-sm">
            <li className="flex items-center justify-between gap-3 p-3 bg-card">
              <div>
                <p className="font-semibold text-foreground">{t('detailBase')}</p>
                <p className="text-xs text-muted-foreground">{rules.length > 0 ? t('detailBaseHint') : t('detailNoRules')}</p>
              </div>
              <span className="font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                {t('detailPerHour', { price: formatNumber(court.base_price_per_hour) })}
              </span>
            </li>
            {rules.map((rule) => {
              const everyDay = new Set(rule.days_of_week).size >= 7
              return (
                <li key={rule.id} className="flex items-center justify-between gap-3 p-3 bg-card">
                  <div>
                    <p className="font-semibold text-foreground">{rule.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {hhmm(rule.start_time)} - {hhmm(rule.end_time)} •{' '}
                      {everyDay ? t('detailEveryDay') : [...rule.days_of_week].sort().map((d) => weekdayShort(d, locale)).join(', ')}
                    </p>
                  </div>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                    {t('detailPerHour', { price: formatNumber(rule.price_per_hour) })}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>

        {cancelPolicy && (
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden />
            <span>
              <strong className="text-foreground">{t('detailPolicy')}</strong> {cancelPolicy}
            </span>
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="cursor-pointer">
            {t('detailClose')}
          </Button>
          <Button
            type="button"
            disabled={selected}
            onClick={() => {
              onSelect(court.id)
              onOpenChange(false)
            }}
            className="bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer"
          >
            {selected ? t('detailSelected') : t('detailSelect')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
