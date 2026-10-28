import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Bell, Check } from 'lucide-react'
import { DURATION_OPTIONS } from '@/lib/booking-slots'

interface HourStepProps {
  hours: number[]
  startHour: number | null
  duration: number
  isBooked: (hour: number) => boolean
  isPast: (hour: number) => boolean
  isDurationAvailable: (duration: number) => boolean
  onSelectHour: (hour: number) => void
  onSelectDuration: (duration: number) => void
  /** Đăng ký chờ một giờ đang kín; không truyền thì không hiện mục này */
  onJoinWaitlist?: (hour: number) => Promise<void>
}

export function HourStep({
  hours,
  startHour,
  duration,
  isBooked,
  isPast,
  isDurationAvailable,
  onSelectHour,
  onSelectDuration,
  onJoinWaitlist,
}: HourStepProps) {
  const t = useTranslations('booking.picker')
  const [waitHour, setWaitHour] = useState('')
  const [waiting, setWaiting] = useState(false)
  // Chỉ những giờ đã kín mà chưa trôi qua mới đăng ký chờ được
  const fullHours = onJoinWaitlist ? hours.filter((h) => isBooked(h) && !isPast(h)) : []
  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-bold text-foreground">{t('stepHour')}</Label>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> {t('available')}
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" /> {t('full')}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {hours.map((hour) => {
            const booked = isBooked(hour)
            const unavailable = booked || isPast(hour)
            const isSelected = startHour === hour
            const label = `${hour.toString().padStart(2, '0')}:00`

            return (
              <button
                key={hour}
                type="button"
                disabled={unavailable}
                aria-pressed={isSelected}
                aria-label={booked ? t('slotBooked', { label }) : label}
                onClick={() => onSelectHour(hour)}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
                  unavailable
                    ? 'bg-muted/40 text-muted-foreground/60 border border-border/40 cursor-not-allowed line-through'
                    : isSelected
                    ? 'bg-emerald-700 text-white shadow-md shadow-emerald-600/30 scale-102 ring-2 ring-emerald-500 ring-offset-2 ring-offset-background'
                    : 'bg-card border border-border text-foreground hover:border-emerald-500/50 hover:bg-emerald-500/5 cursor-pointer'
                }`}
              >
                <span>{label}</span>
                {isSelected && <Check className="w-3 h-3 text-white" aria-hidden />}
              </button>
            )
          })}
        </div>

        {fullHours.length > 0 && onJoinWaitlist && (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3 space-y-2">
            <div className="flex items-start gap-2 text-xs">
              <Bell className="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden />
              <div>
                <div className="font-bold text-foreground">{t('waitlistTitle')}</div>
                <div className="text-muted-foreground">{t('waitlistHint')}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label={t('waitlistSelect')}
                value={waitHour}
                onChange={(e) => setWaitHour(e.target.value)}
                className="h-8 rounded-lg border border-border bg-background px-2 text-xs"
              >
                <option value="">{t('waitlistSelect')}</option>
                {fullHours.map((h) => (
                  <option key={h} value={h}>
                    {`${h.toString().padStart(2, '0')}:00`}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={waiting || waitHour === ''}
                onClick={async () => {
                  setWaiting(true)
                  await onJoinWaitlist(Number(waitHour))
                  setWaiting(false)
                }}
                className="h-8 text-xs cursor-pointer"
              >
                {t('waitlistJoin')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {startHour !== null && (
        <div className="space-y-2 pt-2 border-t border-border">
          <Label className="text-xs font-bold text-foreground">{t('duration')}</Label>
          <div className="flex flex-wrap items-center gap-2">
            {DURATION_OPTIONS.map((dur) => {
              const available = isDurationAvailable(dur)
              return (
                <button
                  key={dur}
                  type="button"
                  disabled={!available}
                  aria-pressed={duration === dur}
                  onClick={() => onSelectDuration(dur)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    !available
                      ? 'bg-muted/40 text-muted-foreground/60 cursor-not-allowed line-through'
                      : duration === dur
                      ? 'bg-emerald-700 text-white shadow-xs cursor-pointer'
                      : 'bg-muted text-muted-foreground hover:text-foreground cursor-pointer'
                  }`}
                >
                  {t('hours', { count: dur })}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
