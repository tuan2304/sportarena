import { Label } from '@/components/ui/label'
import { useTranslations } from 'next-intl'
import { useLabels } from '@/i18n/labels'
import { formatNumber } from '@/lib/format'
import type { CourtData } from './types'

interface CourtStepProps {
  courts: CourtData[]
  selectedCourtId: string
  onSelect: (courtId: string) => void
}

export function CourtStep({ courts, selectedCourtId, onSelect }: CourtStepProps) {
  const t = useTranslations('booking.picker')
  const labels = useLabels()
  return (
    <div className="space-y-3">
      <Label className="text-sm font-bold text-foreground">{t('stepCourt')}</Label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {courts.map((court) => {
          const isSelected = court.id === selectedCourtId
          return (
            <button
              key={court.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(court.id)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                isSelected
                  ? 'border-emerald-700 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-bold shadow-xs'
                  : 'border-border bg-card text-muted-foreground hover:border-emerald-500/30 hover:text-foreground'
              }`}
            >
              <div className="text-sm">{court.name}</div>
              <div className="text-xs opacity-80 font-normal">
                {labels.sport(court.sport_type)} • {formatNumber(court.base_price_per_hour)} đ/h
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
