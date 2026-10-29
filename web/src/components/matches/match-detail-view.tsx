'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { joinMatch, respondParticipant, leaveMatch, cancelMatch, reportParticipantNoShow } from '@/app/actions/matches'
import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import { MatchChatBox } from '@/components/matches/match-chat-box'
import { MatchBanner } from '@/components/matches/detail/match-banner'
import { MatchRoster } from '@/components/matches/detail/match-roster'
import { MatchActionPanel } from '@/components/matches/detail/match-action-panel'
import { JoinRequestDialog } from '@/components/matches/detail/join-request-dialog'
import type { MatchDetail, MatchParticipantItem, MatchMessage } from '@/components/matches/detail/types'

import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { matchPhase } from '@/lib/match-time'
import type { Reputation } from '@/lib/reputation'
export interface MatchDetailProps {
  match: MatchDetail
  participants: MatchParticipantItem[]
  initialMessages?: MatchMessage[]
  currentUserId: string | null
  /** Điểm uy tín theo user id của chủ kèo và các thành viên */
  reputations?: Record<string, Reputation>
  /** Mốc "bây giờ" do server chốt (HTML server và trình duyệt khớp nhau); sau khi mount theo đồng hồ trình duyệt */
  serverNow: number
}

export function MatchDetailView({
  match,
  participants,
  initialMessages = [],
  currentUserId,
  reputations = {},
  serverNow,
}: MatchDetailProps) {
  const router = useRouter()
  const t = useTranslations('matches.detail')
  const tRoster = useTranslations('matches.roster')
  const askConfirm = useConfirm()
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false)
  const [joinMessage, setJoinMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const isHost = currentUserId === match.creator_id
  const userParticipant = participants.find((p) => p.user_id === currentUserId)

  const isFull = match.status === 'full' || match.current_players >= match.required_players
  const slotsLeft = Math.max(0, match.required_players - match.current_players)

  // Cập nhật mỗi 30 giây để kèo tự chuyển "đang diễn ra" → "đã kết thúc" (hết nhận người) khi trang đang mở
  const [nowMs, setNowMs] = useState(serverNow)
  useEffect(() => {
    const tick = () => setNowMs(Date.now())
    const first = setTimeout(tick, 0)
    const timer = setInterval(tick, 30_000)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [])
  const phase = matchPhase(match.start_time, match.end_time, nowMs)
  const ended = phase === 'ended'

  // Real-time synchronization
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`match_${match.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_participants', filter: `match_id=eq.${match.id}` },
        () => {
          router.refresh()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${match.id}` },
        () => {
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [match.id, router])

  // Handlers
  async function handleJoinSubmit() {
    setLoading(true)
    setActionError(null)

    const res = await joinMatch(match.id, joinMessage)
    setLoading(false)

    if (res?.error) {
      setActionError(res.error)
      toast.error(res.error)
    } else {
      toast.success(t('joinSent'), { description: t('joinSentHint') })
      setIsJoinModalOpen(false)
      setJoinMessage('')
      router.refresh()
    }
  }

  async function handleRespond(participantId: string, status: 'accepted' | 'rejected') {
    setLoading(true)
    setActionError(null)

    const res = await respondParticipant(participantId, status)
    setLoading(false)

    if (res?.error) {
      setActionError(res.error)
      toast.error(res.error)
    } else {
      toast.success(status === 'accepted' ? t('approved') : t('declined'))
      router.refresh()
    }
  }

  async function handleNoShow(participantId: string, noShow: boolean) {
    if (noShow) {
      const ok = await askConfirm({
        title: tRoster('noShowConfirmTitle'),
        description: tRoster('noShowConfirmText'),
        confirmText: tRoster('noShowConfirm'),
        cancelText: tRoster('noShowKeep'),
        destructive: true,
      })
      if (!ok) return
    }

    setLoading(true)
    const res = await reportParticipantNoShow(participantId, noShow)
    setLoading(false)

    if (res?.error) {
      toast.error(res.error)
    } else {
      toast.success(noShow ? tRoster('noShowMarked') : tRoster('noShowCleared'))
      router.refresh()
    }
  }

  async function handleLeave() {
    const ok = await askConfirm({
      title: t('leave.title'),
      description: t('leave.text'),
      confirmText: t('leave.confirm'),
      cancelText: t('leave.stay'),
      destructive: true,
    })
    if (!ok) return

    setLoading(true)
    setActionError(null)

    const res = await leaveMatch(match.id)
    setLoading(false)

    if (res?.error) {
      setActionError(res.error)
      toast.error(res.error)
    } else {
      toast.success(t('left'))
      router.refresh()
    }
  }

  async function handleCancelMatch() {
    const ok = await askConfirm({
      title: t('cancel.title'),
      description: t('cancel.text'),
      confirmText: t('cancel.confirm'),
      cancelText: t('cancel.keep'),
      destructive: true,
    })
    if (!ok) return

    setLoading(true)
    setActionError(null)

    const res = await cancelMatch(match.id)
    setLoading(false)

    if (res?.error) {
      setActionError(res.error)
      toast.error(res.error)
    } else {
      toast.success(t('cancelled'))
      router.refresh()
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/matches"
          className="py-2.5 -my-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('back')}
        </Link>
      </div>

      {actionError && (
        <div
          role="alert"
          className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-xl text-xs flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <MatchBanner match={match} isFull={isFull} slotsLeft={slotsLeft} phase={phase} />

          <MatchRoster
            match={match}
            participants={participants}
            isHost={isHost}
            isFull={isFull || ended}
            loading={loading}
            onRespond={handleRespond}
            reputations={reputations}
            canReportNoShow={isHost && nowMs >= new Date(match.start_time).getTime()}
            onNoShow={handleNoShow}
          />

          {isHost || userParticipant?.status === 'accepted' ? (
            <MatchChatBox
              matchId={match.id}
              currentUserId={currentUserId || undefined}
              initialMessages={initialMessages}
            />
          ) : (
            <Card className="border-dashed border-border shadow-sm">
              <CardContent className="p-8 text-center space-y-2">
                <div className="text-sm font-bold text-foreground">{t('chatMembersOnly')}</div>
                <p className="text-xs text-muted-foreground">
                  {t('chatMembersHint')}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <MatchActionPanel
            match={match}
            currentUserId={currentUserId}
            isHost={isHost}
            isFull={isFull}
            ended={ended}
            userParticipant={userParticipant}
            loading={loading}
            onJoinClick={() => setIsJoinModalOpen(true)}
            onLeave={handleLeave}
            onCancelMatch={handleCancelMatch}
          />
        </div>
      </div>

      <JoinRequestDialog
        open={isJoinModalOpen}
        onOpenChange={setIsJoinModalOpen}
        message={joinMessage}
        onMessageChange={setJoinMessage}
        loading={loading}
        onSubmit={handleJoinSubmit}
      />
    </div>
  )
}
