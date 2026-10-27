import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, ChevronUp, Loader2, ShieldCheck, Zap } from 'lucide-react'
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
    <>
    <Card id="booking-summary" className="scroll-mt-20 border-border shadow-md sticky top-24 bg-card/90 backdrop-blur-sm">
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

    {/* Điện thoại: tóm tắt nằm cuối trang nên thanh cố định này luôn giữ giá cọc và nút giữ chỗ trong tầm ngón cái.
        Nằm ngay trên thanh điều hướng dưới (md trở lên không có thanh đó nên sát đáy). */}
    {slot && (
      <div
        data-testid="sticky-book-bar"
        className="lg:hidden fixed inset-x-0 z-30 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] md:bottom-0 border-t border-border bg-background/95 backdrop-blur-md shadow-[0_-6px_20px_-12px_rgba(0,0,0,0.35)]"
      >
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground truncate">
              {formatTimeRange(slot.start, slot.end)} · {courtName}
            </div>
            <div className="font-extrabold text-base text-emerald-700 dark:text-emerald-400 leading-tight whitespace-nowrap">
              {t('stickyDeposit', { amount: formatVnd(price.depositAmount) })}
            </div>
          </div>
          <a
            href="#booking-summary"
            aria-label={t('moreOptionsLabel')}
            title={t('moreOptions')}
            className="shrink-0 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border text-muted-foreground active:bg-muted"
          >
            <ChevronUp className="h-5 w-5" aria-hidden />
          </a>
          <Button
            type="button"
            disabled={loading}
            onClick={onSubmit}
            className="shrink-0 h-11 pointer-coarse:h-11 px-5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-md shadow-emerald-600/30 cursor-pointer text-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-label={t('holding')} /> : t('stickyHold')}
          </Button>
        </div>
      </div>
    )}
    </>
  )
}
