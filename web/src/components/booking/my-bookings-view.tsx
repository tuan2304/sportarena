'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CreateMatchModal } from '@/components/matches/create-match-modal'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { cancelBooking } from '@/app/actions/cancellation'
import { decideCancellation, describeOutcome, refundStatusLabel } from '@/lib/cancellation'
import {
  Calendar,
  Clock,
  MapPin,
  ArrowRight,
  Trophy,
  Flame,
  PlusCircle,
  XCircle,
} from 'lucide-react'

import { formatVnd, formatTime, formatDate, formatShortDate } from '@/lib/format'
interface ClubRef {
  id?: string
  name: string
  address?: string | null
  /** Số giờ trước giờ chơi được hủy và hoàn cọc (chính sách của cụm sân) */
  free_cancel_hours?: number
}

interface CourtRef {
  id?: string
  name: string
  sport_type?: string
  club: ClubRef | null
}

interface BookingMatchRef {
  id: string
  title: string
  status: string
  current_players: number
  required_players: number
}

export interface MyBooking {
  id: string
  start_time: string
  end_time: string
  total_price: number
  deposit_amount: number
  status: string
  refund_status?: string
  refund_amount?: number
  court: CourtRef | null
  /** Quan hệ 1-1 (matches.booking_id là UNIQUE) nên API trả một object, không phải mảng */
  matches: BookingMatchRef | null
}

export interface MyParticipation {
  id: string
  status: string
  message: string | null
  match: {
    id: string
    title: string
    status: string
    sport_type: string
    cost_sharing_type: string
    cost_per_person: number | null
    current_players: number
    required_players: number
    booking: {
      id: string
      start_time: string
      end_time: string
      court: CourtRef | null
    } | null
  } | null
}

interface MyBookingsViewProps {
  bookings: MyBooking[]
  participations: MyParticipation[]
}

export function MyBookingsView({ bookings, participations }: MyBookingsViewProps) {
  const [activeTab, setActiveTab] = useState<'bookings' | 'matches'>('bookings')
  const [selectedBookingForMatch, setSelectedBookingForMatch] = useState<MyBooking | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  // Mốc "bây giờ" cố định cho lần render, để nút Hủy không nhấp nháy giữa các lần vẽ lại
  const [now] = useState(() => Date.now())
  const router = useRouter()
  const confirm = useConfirm()
  const t = useTranslations('myBookings')
  const locale = useLocale()
  const lang = locale === 'en' ? 'en' : 'vi'

  async function handleCancel(item: MyBooking) {
    const club = item.court?.club
    const decision = decideCancellation({
      status: item.status,
      start: new Date(item.start_time),
      now: new Date(),
      paidAmount: item.status === 'confirmed' ? Number(item.deposit_amount) : 0,
      freeCancelHours: club?.free_cancel_hours ?? 24,
      by: 'player',
    })
    const ok = await confirm({
      title: t('cancelDialog.title'),
      description: describeOutcome(decision, formatVnd, lang),
      confirmText: t('cancelDialog.confirm'),
      cancelText: t('cancelDialog.keep'),
      destructive: true,
    })
    if (!ok) return

    setCancellingId(item.id)
    const result = await cancelBooking(item.id)
    setCancellingId(null)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(
      result.refundAmount ? t('cancelledRefund', { amount: formatVnd(result.refundAmount) }) : t('cancelled')
    )
    router.refresh()
  }

  function handleOpenCreateMatch(booking: MyBooking) {
    setSelectedBookingForMatch(booking)
    setIsModalOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-border/70 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('bookings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'bookings'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'text-muted-foreground hover:bg-muted/60'
          }`}
        >
          <Calendar className="w-4 h-4" />
          {t('tabBookings', { count: bookings.length })}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('matches')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'matches'
              ? 'bg-amber-400 text-slate-900 shadow-sm'
              : 'text-muted-foreground hover:bg-muted/60'
          }`}
        >
          <Flame className="w-4 h-4" />
          {t('tabMatches', { count: participations.length })}
        </button>
      </div>

      {/* Tab 1: Bookings */}
      {activeTab === 'bookings' && (
        <div className="space-y-4">
          {bookings.length === 0 ? (
            <Card className="border-dashed border-2 p-12 text-center space-y-3">
              <Trophy className="w-12 h-12 text-muted-foreground/30 mx-auto" />
              <h3 className="text-base font-bold text-foreground">{t('emptyBookingsTitle')}</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {t('emptyBookingsText')}
              </p>
              <Link href="/clubs">
                <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer mt-2">
                  {t('exploreNow')}
                </Button>
              </Link>
            </Card>
          ) : (
            <div className="space-y-4">
              {bookings.map((item) => {
                const court: CourtRef = item.court ?? { name: t('defaultCourt'), club: null }
                const club = court.club || { name: t('defaultClub') }
                const isPending = item.status === 'pending'
                const isConfirmed = item.status === 'confirmed'
                const match = item.matches
                const isCancelled = item.status === 'cancelled'
                const canCancel = (isPending || isConfirmed) && new Date(item.start_time).getTime() > now
                const refundNote = refundStatusLabel(item.refund_status ?? 'none', Number(item.refund_amount ?? 0), formatVnd, lang)

                const startTime = formatTime(item.start_time)
                const endTime = formatTime(item.end_time)
                const dateStr = formatDate(item.start_time)

                return (
                  <Card
                    key={item.id}
                    className="border-border shadow-xs hover:border-emerald-500/30 transition-all overflow-hidden"
                  >
                    <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-base text-foreground">{club.name}</span>
                          <Badge
                            variant="outline"
                            className={
                              isConfirmed
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs'
                                : isPending
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs'
                                : 'bg-muted text-muted-foreground text-xs'
                            }
                          >
                            {isConfirmed ? t('status.confirmed') : isPending ? t('status.pending') : isCancelled ? t('status.cancelled') : item.status}
                          </Badge>

                          {match && (
                            <Badge
                              variant="outline"
                              className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs font-semibold"
                            >
                              <Flame className="w-3.5 h-3.5 inline -mt-0.5 mr-1" aria-hidden />{t('matchOpen', { current: match.current_players, required: match.required_players })}
                            </Badge>
                          )}
                        </div>

                        <div className="text-xs text-muted-foreground flex items-center gap-3">
                          <span className="font-semibold text-foreground">{court.name}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                            {startTime} - {endTime} ({dateStr})
                          </span>
                        </div>

                        {club.address && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>{club.address}</span>
                          </div>
                        )}

                        {refundNote && (
                          <div
                            className={`text-xs font-semibold ${
                              item.refund_status === 'refunded'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-amber-700 dark:text-amber-400'
                            }`}
                          >
                            {refundNote}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-border/50 flex-wrap">
                        <div className="text-right mr-2 hidden sm:block">
                          <div className="text-xs text-muted-foreground">{t('deposit')}</div>
                          <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                            {formatVnd(item.deposit_amount)}
                          </div>
                        </div>

                        {/* Matchmaking Action */}
                        {match ? (
                          <Link href={`/matches/${match.id}`}>
                            <Button
                              size="sm"
                              className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold cursor-pointer text-xs"
                            >
                              <Flame className="w-3.5 h-3.5 mr-1" />
                              {t('manageMatch')}
                            </Button>
                          </Link>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenCreateMatch(item)}
                            className="border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer text-xs font-semibold"
                          >
                            <PlusCircle className="w-3.5 h-3.5 mr-1" />
                            {t('openMatch')}
                          </Button>
                        )}

                        {canCancel && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={cancellingId === item.id}
                            onClick={() => handleCancel(item)}
                            className="border-red-500/40 text-red-700 dark:text-red-400 hover:bg-red-500/10 cursor-pointer text-xs font-semibold"
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            {cancellingId === item.id ? t('cancelling') : t('cancelBooking')}
                          </Button>
                        )}

                        <Link href={`/bookings/${item.id}`}>
                          <Button
                            size="sm"
                            variant={isPending ? 'default' : 'outline'}
                            className={
                              isPending
                                ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer text-xs'
                                : 'cursor-pointer text-xs'
                            }
                          >
                            {isPending ? t('scanDeposit') : t('viewDetails')}
                            <ArrowRight className="w-3.5 h-3.5 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Participations */}
      {activeTab === 'matches' && (
        <div className="space-y-4">
          {participations.length === 0 ? (
            <Card className="border-dashed border-2 p-12 text-center space-y-3">
              <Flame className="w-12 h-12 text-muted-foreground/30 mx-auto" />
              <h3 className="text-base font-bold text-foreground">{t('emptyMatchesTitle')}</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {t('emptyMatchesText')}
              </p>
              <Link href="/matches">
                <Button size="sm" className="bg-amber-400 hover:bg-amber-300 text-slate-900 cursor-pointer mt-2">
                  {t('exploreMatches')}
                </Button>
              </Link>
            </Card>
          ) : (
            <div className="space-y-4">
              {participations.map((part) => {
                const match = part.match
                if (!match) return null

                const booking = match.booking
                const court = booking?.court
                const club = court?.club
                const isAccepted = part.status === 'accepted'
                const isPending = part.status === 'pending'

                const startTime = booking?.start_time ? new Date(booking.start_time) : null
                const endTime = booking?.end_time ? new Date(booking.end_time) : null

                const timeStr = startTime && endTime
                  ? `${formatTime(startTime)} - ${formatTime(endTime)}`
                  : ''
                const dateStr = startTime
                  ? formatShortDate(startTime, lang)
                  : ''

                return (
                  <Card key={part.id} className="border-border shadow-xs hover:border-amber-500/30 transition-all">
                    <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-base text-foreground">{match.title}</span>
                          <Badge
                            variant="outline"
                            className={
                              isAccepted
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs font-semibold'
                                : isPending
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs font-semibold'
                                : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 text-xs'
                            }
                          >
                            {isAccepted ? t('part.accepted') : isPending ? t('part.pending') : t('part.rejected')}
                          </Badge>
                        </div>

                        {club && (
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span className="font-semibold text-foreground">{club.name}</span>
                            <span>•</span>
                            <span>{court?.name}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-amber-500" />
                              {timeStr} ({dateStr})
                            </span>
                          </div>
                        )}

                        {part.message && (
                          <div className="text-xs text-muted-foreground italic">
                            {t('message', { message: part.message })}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                        <div className="text-right mr-2">
                          <div className="text-xs text-muted-foreground">{t('cost')}</div>
                          <div className="text-xs font-bold text-foreground">
                            {match.cost_sharing_type === 'host_covers'
                              ? t('free')
                              : `${formatVnd(match.cost_per_person || 0)}`}
                          </div>
                        </div>

                        <Link href={`/matches/${match.id}`}>
                          <Button size="sm" className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold cursor-pointer text-xs">
                            {t('matchDetails')}
                            <ArrowRight className="w-3.5 h-3.5 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal for creating match from an existing booking */}
      {selectedBookingForMatch && (
        <CreateMatchModal
          bookingId={selectedBookingForMatch.id}
          courtName={selectedBookingForMatch.court?.name || t('courtFallback')}
          clubName={selectedBookingForMatch.court?.club?.name || t('defaultClub')}
          totalPrice={Number(selectedBookingForMatch.total_price || 0)}
          sportType={selectedBookingForMatch.court?.sport_type || 'football'}
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
        />
      )}
    </div>
  )
}
