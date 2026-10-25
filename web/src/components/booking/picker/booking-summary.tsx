import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Loader2, ShieldCheck, Zap } from 'lucide-react'
import { formatDate, formatNumber, formatTimeRange, formatVnd } from '@/lib/format'
import { MatchOptions } from './match-options'
import type { MatchDraft } from './types'

interface BookingSummaryProps {
  courtName: string | undefined
  selectedDate: string
  /** Khung giờ đã chọn (đã tính thời lượng) hoặc null nếu chưa chọn */
  slot: { start: Date; end: Date; durationHours: number } | null
  price: {
    pricePerHour: number
    totalPrice: number
    depositAmount: number
    depositPercent: number
    isPeak: boolean
  }
  note: string
  onNoteChange: (value: string) => void
  matchDraft: MatchDraft
  onMatchDraftChange: (patch: Partial<MatchDraft>) => void
  error: string | null
  loading: boolean
  onSubmit: () => void
}

export function BookingSummary({
  courtName,
  selectedDate,
  slot,
  price,
  note,
  onNoteChange,
  matchDraft,
  onMatchDraftChange,
  error,
  loading,
  onSubmit,
}: BookingSummaryProps) {
  const t = useTranslations('booking.summary')
  return (
    <Card className="border-border shadow-md sticky top-24 bg-card/90 backdrop-blur-sm">
      <CardHeader className="pb-3 border-b border-border/60">
        <CardTitle className="text-base font-bold">{t('title')}</CardTitle>
        <CardDescription className="text-xs">{t('subtitle')}</CardDescription>
      </CardHeader>

      <CardContent className="p-5 space-y-4 text-xs">
        {error && (
          <div
            role="alert"
            className="p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-lg flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-2 pb-3 border-b border-border/60">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('court')}</span>
            <span className="font-bold text-foreground">{courtName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('date')}</span>
            <span className="font-semibold text-foreground">{formatDate(selectedDate)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('time')}</span>
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              {slot ? `${formatTimeRange(slot.start, slot.end)} (${slot.durationHours}h)` : t('noTime')}
            </span>
          </div>
          {price.isPeak && (
            <div className="flex items-center gap-1 text-xs text-amber-800 dark:text-amber-400 bg-amber-500/10 p-1.5 rounded-md font-medium">
              <Zap className="w-3.5 h-3.5" aria-hidden />
              {t('peak')}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="bookingNote" className="text-xs text-muted-foreground">
            {t('noteLabel')}
          </Label>
          <Input
            id="bookingNote"
            value={note}
            maxLength={500}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder={t('notePlaceholder')}
            className="h-8 text-xs"
          />
        </div>

        <MatchOptions draft={matchDraft} totalPrice={price.totalPrice} onChange={onMatchDraftChange} />

        <div className="space-y-2 pt-2">
          <div className="flex justify-between text-muted-foreground">
            <span>{t('pricePerHour')}</span>
            <span>{formatNumber(price.pricePerHour)} đ/h</span>
          </div>
          <div className="flex justify-between font-bold text-foreground text-sm">
            <span>{t('total')}</span>
            <span>{formatVnd(price.totalPrice)}</span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-emerald-700 dark:text-emerald-400">
            <span className="font-semibold">{t('deposit', { percent: price.depositPercent })}</span>
            <span className="font-extrabold text-base">{formatVnd(price.depositAmount)}</span>
          </div>
        </div>

        <Button
          type="button"
          disabled={!slot || loading}
          onClick={onSubmit}
          className="w-full h-11 bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-md shadow-emerald-600/30 cursor-pointer text-sm"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t('holding')}
            </>
          ) : (
            t('confirm')
          )}
        </Button>

        <div className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
          <ShieldCheck className="w-3 h-3 text-emerald-700 dark:text-emerald-400" aria-hidden />
          {t('holdNote')}
        </div>
      </CardContent>
    </Card>
  )
}
