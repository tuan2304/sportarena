import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, MapPin } from 'lucide-react'
import { skillInfo } from '@/lib/constants'
import { useLocale, useTranslations } from 'next-intl'
import { useLabels } from '@/i18n/labels'
import { SportIcon } from '@/components/ui/sport-icon'
import { formatTime, formatLongDate } from '@/lib/format'
import type { MatchPhase } from '@/lib/match-time'
import { DirectionsLinks } from '@/components/maps/directions-links'
import { fullAddress } from '@/lib/maps'
import type { MatchDetail } from './types'

interface MatchBannerProps {
  match: MatchDetail
  isFull: boolean
  slotsLeft: number
  /** Chưa tới giờ, đang diễn ra hay đã kết thúc (theo giờ của khung đã đặt) */
  phase: MatchPhase
}

/** Thẻ đầu trang: môn, trình độ, trạng thái chỗ trống, thời gian và địa điểm. */
export function MatchBanner({ match, isFull, slotsLeft, phase }: MatchBannerProps) {
  const t = useTranslations('matches')
  const labels = useLabels()
  const lang = useLocale() === 'en' ? 'en' : 'vi'
  const skill = skillInfo(match.skill_level)
  const court = match.court
  const club = court?.club
  const startTime = match.start_time ? new Date(match.start_time) : null
  const endTime = match.end_time ? new Date(match.end_time) : null

  return (
    <Card className="border-border shadow-sm overflow-hidden">
      <CardHeader className="bg-muted/30 border-b border-border/60 pb-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs font-semibold py-1 px-2.5 bg-background">
              <SportIcon sport={match.sport_type} className="w-3.5 h-3.5 mr-1" />
              {labels.sport(match.sport_type)}
            </Badge>
            <Badge variant="outline" className={`text-xs font-semibold py-1 px-2.5 ${skill.badge}`}>
              {labels.skillLong(match.skill_level)}
            </Badge>
          </div>

          <Badge
            variant="outline"
            className={
              match.status === 'cancelled'
                ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 text-xs font-bold'
                : phase === 'ended' || isFull
                ? 'bg-muted text-muted-foreground border-border text-xs'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs font-bold'
            }
          >
            {match.status === 'cancelled'
              ? t('banner.cancelled')
              : phase === 'ended'
              ? t('banner.ended')
              : isFull
              ? t('card.full')
              : t('card.slotsLeft', { count: slotsLeft })}
          </Badge>
        </div>

        <CardTitle className="text-xl sm:text-2xl font-black text-foreground">
          {match.title}
        </CardTitle>

        {match.description && (
          <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed">
            {match.description}
          </p>
        )}
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        {/* Venue & Time Slot Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-1">
            <div className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              {t('banner.time')}
            </div>
            <div className="font-bold text-sm text-foreground flex items-center gap-2 flex-wrap">
              <span>
                {startTime && endTime
                  ? `${formatTime(startTime)} - ${formatTime(endTime)}`
                  : t('banner.timeTbd')}
              </span>
              {phase === 'live' && (
                <Badge className="bg-emerald-600 text-white text-xs py-0 px-1.5 font-bold">{t('banner.live')}</Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {startTime && formatLongDate(startTime, lang)}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-1">
            <div className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
              {t('banner.place')}
            </div>
            <div className="font-bold text-sm text-foreground">
              {club?.name || t('banner.venueFallback')} - {court?.name || t('banner.courtFallback')}
            </div>
            <div className="text-xs text-muted-foreground line-clamp-1">
              {club?.address || club?.district || t('banner.areaFallback')}
            </div>
            {club && (
              <DirectionsLinks
                compact
                className="pt-1"
                place={{ lat: club.latitude, lng: club.longitude, name: club.name, address: fullAddress(club) }}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
