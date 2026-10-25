import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { CalendarDays } from 'lucide-react'
import { addDaysToDateKey } from '@/lib/datetime'

interface DateStepProps {
  selectedDate: string
  /** Ngày hôm nay theo giờ VN (yyyy-mm-dd) */
  todayKey: string
  onChange: (dateKey: string) => void
}

export function DateStep({ selectedDate, todayKey, onChange }: DateStepProps) {
  const t = useTranslations('booking.picker')
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-bold text-foreground">{t('stepDate')}</Label>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => onChange(todayKey)} className="h-7 text-xs cursor-pointer">
            {t('today')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onChange(addDaysToDateKey(todayKey, 1))}
            className="h-7 text-xs cursor-pointer"
          >
            {t('tomorrow')}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-card max-w-xs">
        <CalendarDays className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" aria-hidden />
        <input
          type="date"
          aria-label={t('dateLabel')}
          value={selectedDate}
          min={todayKey}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="bg-transparent text-sm font-semibold focus:outline-none cursor-pointer w-full"
        />
      </div>
    </div>
  )
}
