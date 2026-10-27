import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, MapPin, Users, ArrowRight } from 'lucide-react'

import { skillInfo } from '@/lib/constants'
import { useLocale, useTranslations } from 'next-intl'
import { useLabels } from '@/i18n/labels'
import { SportIcon } from '@/components/ui/sport-icon'
import { formatNumber, formatTime, formatShortDate } from '@/lib/format'
import { matchPhase } from '@/lib/match-time'
export interface MatchCardProps {
  /** Mốc "bây giờ" do server chốt để biết kèo đang diễn ra hay chưa tới giờ */
  nowMs?: number
  match: {
    id: string
    title: string
    description: string | null
    sport_type: string
    skill_level: string
    required_players: number
    current_players: number
    cost_sharing_type: string
    cost_per_person: number | null
    status: string
    created_at: string
    creator: {
      id: string
      full_name: string
      avatar_url: string | null
      rating: number | null
    } | null
    /** Giờ và sân của kèo (bản sao từ đơn đặt sân, đọc công khai) */
    start_time: string
    end_time: string
    court: {
      id: string
      name: string
      club: {
        id: string
        name: string
        address: string | null
        district: string | null
      } | null
    } | null
  }
}

export function MatchCard({ match, nowMs }: MatchCardProps) {
  const t = useTranslations('matches.card')
  const labels = useLabels()
  const lang = useLocale() === 'en' ? 'en' : 'vi'
  const sportName = labels.sport(match.sport_type)
  const skill = skillInfo(match.skill_level)

  const court = match.court
  const club = court?.club
  const startTime = match.start_time ? new Date(match.start_time) : null
  const endTime = match.end_time ? new Date(match.end_time) : null

  const isLive = nowMs !== undefined && matchPhase(match.start_time, match.end_time, nowMs) === 'live'
  const isFull = match.status === 'full' || match.current_players >= match.required_players
  const slotsLeft = Math.max(0, match.required_players - match.current_players)

  const timeStr = startTime && endTime
    ? `${formatTime(startTime)} - ${formatTime(endTime)}`
    : t('timeTbd')

  const dateStr = startTime
    ? formatShortDate(startTime, lang)
    : ''

  const isHostCovers = match.cost_sharing_type === 'host_covers'
  const costNumber = Number(match.cost_per_person) || 0

  return (
    <Card className="card-lift animate-fade-up overflow-hidden border-border/80 shadow-sm hover:border-amber-500/40 group flex flex-col justify-between">
      <CardContent className="p-5 space-y-4 flex-1 flex flex-col justify-between">
        <div className="space-y-3">
          {/* Header Badges */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className="text-xs font-semibold py-0.5 px-2 bg-muted/60">
                <SportIcon sport={match.sport_type} className="w-3.5 h-3.5 mr-1" />
                {sportName}
              </Badge>
              <Badge variant="outline" className={`text-xs font-semibold py-0.5 px-2 ${skill.badge}`}>
                {skill.label}
              </Badge>
            </div>

            <Badge
              variant="outline"
              className={
                isFull
                  ? 'bg-muted text-muted-foreground border-border text-xs'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs font-bold'
              }
            >
              {isFull ? t('full') : t('slotsLeft', { count: slotsLeft })}
            </Badge>
          </div>

          {/* Title */}
          <div>
            <h3 className="font-bold text-base text-foreground group-hover:text-amber-500 transition-colors line-clamp-2">
              {match.title}
            </h3>
            {match.description && (
              <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                {match.description}
              </p>
            )}
          </div>

          {/* Time & Venue */}
          <div className="space-y-1.5 text-xs text-muted-foreground pt-1">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>{timeStr} • {dateStr}</span>
              {isLive && (
                <Badge className="bg-emerald-600 text-white text-xs py-0 px-1.5 font-bold">{t('live')}</Badge>
              )}
            </div>

            {club && (
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <span className="line-clamp-1">
                  <strong className="text-foreground">{club.name}</strong> ({court?.name || t('courtFallback')}) - {club.address || club.district || t('cityFallback')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer info: Host & Price */}
        <div className="pt-3 border-t border-border/60 space-y-3">
          <div className="flex items-center justify-between">
            {/* Host info */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold flex items-center justify-center text-xs border border-amber-500/30">
                {match.creator?.full_name ? match.creator.full_name.charAt(0).toUpperCase() : 'H'}
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground text-xs block">{t('host')}</span>
                <span className="font-semibold text-foreground line-clamp-1">
                  {match.creator?.full_name || t('userFallback')}
                </span>
              </div>
            </div>

            {/* Players count */}
            <div className="flex items-center gap-1.5 bg-muted/60 px-2.5 py-1 rounded-full text-xs font-semibold text-foreground">
              <Users className="w-3.5 h-3.5 text-amber-500" />
              <span>
                {match.current_players}/{match.required_players}
              </span>
            </div>
          </div>

          {/* Pricing & CTA */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div>
              <div className="text-xs text-muted-foreground">{t('cost')}</div>
              <div className="font-extrabold text-sm text-foreground">
                {isHostCovers ? (
                  <span className="text-emerald-700 dark:text-emerald-400">{t('free')}</span>
                ) : (
                  <span className="text-amber-700 dark:text-amber-400">{t('perPerson', { price: formatNumber(costNumber) })}</span>
                )}
              </div>
            </div>

            <Link href={`/matches/${match.id}`}>
              <Button
                size="sm"
                className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold cursor-pointer text-xs shadow-xs shadow-amber-500/20"
              >
                {t('view')}
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
