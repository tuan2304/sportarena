'use client'

import { useState } from 'react'
import { Info } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { useTranslations } from 'next-intl'
import { useLabels } from '@/i18n/labels'
import { formatNumber } from '@/lib/format'
import { CourtDetailDialog } from './court-detail-dialog'
import type { CourtData } from './types'

interface CourtStepProps {
  courts: CourtData[]
  selectedCourtId: string
  onSelect: (courtId: string) => void
  clubOpenTime: string
  clubCloseTime: string
  cancelPolicy?: string
}

export function CourtStep({ courts, selectedCourtId, onSelect, clubOpenTime, clubCloseTime, cancelPolicy }: CourtStepProps) {
  const t = useTranslations('booking.picker')
  const labels = useLabels()
  // Chi tiết mở ở hộp thoại riêng: bấm thẻ sân vẫn là chọn sân để đặt, bấm "Chi tiết" mới xem thông tin
  const [detailId, setDetailId] = useState<string | null>(null)
  const detailCourt = courts.find((c) => c.id === detailId) ?? null

  return (
    <div className="space-y-3">
      <Label className="text-sm font-bold text-foreground">{t('stepCourt')}</Label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {courts.map((court) => {
          const isSelected = court.id === selectedCourtId
          return (
            <div key={court.id} className="relative">
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(court.id)}
                className={`w-full p-3 pb-9 rounded-xl border text-left transition-all cursor-pointer ${
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
              <button
                type="button"
                onClick={() => setDetailId(court.id)}
                aria-label={t('detailOf', { court: court.name })}
                className="absolute bottom-2 left-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                <Info className="w-3.5 h-3.5" aria-hidden />
                {t('detailButton')}
              </button>
            </div>
          )
        })}
      </div>

      <CourtDetailDialog
        court={detailCourt}
        open={detailCourt !== null}
        onOpenChange={(open) => {
          if (!open) setDetailId(null)
        }}
        selected={detailCourt?.id === selectedCourtId}
        onSelect={onSelect}
        clubOpenTime={clubOpenTime}
        clubCloseTime={clubCloseTime}
        cancelPolicy={cancelPolicy}
      />
    </div>
  )
}
