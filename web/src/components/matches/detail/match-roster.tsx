import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, Crown, MessageSquare, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import type { MatchDetail, MatchParticipantItem } from './types'

interface MatchRosterProps {
  match: MatchDetail
  participants: MatchParticipantItem[]
  isHost: boolean
  isFull: boolean
  loading: boolean
  onRespond: (participantId: string, status: 'accepted' | 'rejected') => void
}

/** Danh sách chủ kèo, thành viên đã duyệt và (với chủ kèo) các yêu cầu đang chờ. */
export function MatchRoster({ match, participants, isHost, isFull, loading, onRespond }: MatchRosterProps) {
  const t = useTranslations('matches.roster')
  const acceptedParticipants = participants.filter((p) => p.status === 'accepted')
  const pendingParticipants = participants.filter((p) => p.status === 'pending')

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Users className="w-4 h-4 text-amber-500" />
              {t('title', { current: match.current_players, required: match.required_players })}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('subtitle')}
            </p>
          </div>

          <Badge variant="outline" className="text-xs font-semibold">
            {t('count', { current: match.current_players, required: match.required_players })}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        {/* Host Entry */}
        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-amber-400 text-slate-900 font-bold flex items-center justify-center text-sm shadow-xs">
                {match.creator?.full_name ? match.creator.full_name.charAt(0).toUpperCase() : 'H'}
              </div>
              <div className="absolute -bottom-1 -right-1 bg-amber-400 text-amber-950 p-0.5 rounded-full" title={t('hostTitle')}>
                <Crown className="w-3 h-3" />
              </div>
            </div>
            <div>
              <div className="font-bold text-sm text-foreground flex items-center gap-1.5">
                {match.creator ? (
                  <Link href={`/players/${match.creator.id}`} className="hover:underline underline-offset-2">
                    {match.creator.full_name || t('hostFallback')}
                  </Link>
                ) : (
                  <span>{t('hostFallback')}</span>
                )}
                <Badge className="bg-amber-400 text-slate-900 text-xs py-0 px-1.5">
                  {t('hostBadge')}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">{t('organizer')}</div>
            </div>
          </div>

          <div className="text-right">
            <Badge variant="outline" className="text-xs text-amber-700 dark:text-amber-400 border-amber-500/30">
              {t('leader')}
            </Badge>
          </div>
        </div>

        {/* Accepted Participants */}
        {acceptedParticipants.length === 0 ? (
          <div className="text-center py-4 text-xs text-muted-foreground border border-dashed rounded-xl">
            {t('noMembers')}
          </div>
        ) : (
          <div className="space-y-2">
            {acceptedParticipants.map((p) => (
              <div
                key={p.id}
                className="p-3 rounded-xl bg-card border border-border/70 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold flex items-center justify-center text-xs border border-emerald-500/30">
                    {p.user?.full_name ? p.user.full_name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-foreground">
                      {p.user ? (
                        <Link href={`/players/${p.user.id}`} className="hover:underline underline-offset-2">
                          {p.user.full_name || t('memberFallback')}
                        </Link>
                      ) : (
                        t('memberFallback')
                      )}
                    </div>
                    {p.message && (
                      <div className="text-xs text-muted-foreground italic flex items-center gap-1">
                        <MessageSquare className="w-3 h-3 text-muted-foreground/60" />
                        &ldquo;{p.message}&rdquo;
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                    {t('approvedBadge')}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Host Only: Pending Applications */}
        {isHost && (
          <div className="pt-4 border-t border-border/60 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                <AlertCircle className="w-3.5 h-3.5" />
                {t('pendingTitle', { count: pendingParticipants.length })}
              </h4>
            </div>

            {pendingParticipants.length === 0 ? (
              <div className="text-center py-3 text-xs text-muted-foreground bg-muted/20 rounded-xl">
                {t('noPending')}
              </div>
            ) : (
              <div className="space-y-2">
                {pendingParticipants.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold flex items-center justify-center text-xs">
                        {p.user?.full_name ? p.user.full_name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-foreground">
                          {p.user ? (
                            <Link href={`/players/${p.user.id}`} className="hover:underline underline-offset-2">
                              {p.user.full_name || t('applicant')}
                            </Link>
                          ) : (
                            t('applicant')
                          )}
                        </div>
                        {p.message && (
                          <div className="text-xs text-muted-foreground">
                            {t('message', { message: p.message })}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        size="sm"
                        disabled={loading || isFull}
                        onClick={() => onRespond(p.id, 'accepted')}
                        className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        {t('accept')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading}
                        onClick={() => onRespond(p.id, 'rejected')}
                        className="h-7 text-xs text-red-600 dark:text-red-400 hover:bg-red-500/10 border-red-500/30 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" />
                        {t('reject')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
