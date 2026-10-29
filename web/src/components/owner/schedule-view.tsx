'use client'

import { useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { updateBookingStatus, reportBookingNoShow } from '@/app/actions/owner'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CalendarDays,
  LayoutGrid,
  Table as TableIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react'

import { formatVnd, formatTime, formatDate } from '@/lib/format'
import { addDaysToDateKey, vnDateKey } from '@/lib/datetime'
import { vnHourSpan } from '@/lib/booking-slots'
import { ReputationBadge } from '@/components/profile/reputation-badge'
import type { Reputation } from '@/lib/reputation'
interface ScheduleCourt {
  id: string
  name: string
  club_name: string
  sport_type: string
}

interface ScheduleBooking {
  id: string
  court_id: string
  start_time: string
  end_time: string
  total_price: number
  deposit_amount: number
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  user_id: string
  no_show: boolean
  recurring: boolean
  user_name: string
  user_phone: string
  court_name: string
}

interface ScheduleViewProps {
  courts: ScheduleCourt[]
  initialBookings: ScheduleBooking[]
  /** Điểm uy tín của khách theo user id */
  reputations?: Record<string, Reputation>
  /** Mốc "bây giờ" do server chốt (HTML server và trình duyệt khớp nhau) */
  serverNow: number
}

const TIME_SLOTS = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00', '21:00', '22:00',
]

export function ScheduleView({ courts, initialBookings, reputations = {}, serverNow }: ScheduleViewProps) {
  const t = useTranslations('ownerSchedule')
  const router = useRouter()
  const askConfirm = useConfirm()
  const [viewMode, setViewMode] = useState<'timeline' | 'table'>('timeline')
  // Ngày theo giờ Việt Nam (toISOString() trả ngày UTC nên sai trước 7h sáng)
  const [selectedDate, setSelectedDate] = useState<string>(() => vnDateKey(Date.now()))
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [isLive, setIsLive] = useState(false)

  // Đăng ký Supabase Realtime để đồng bộ tức thì
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
        },
        () => {
          router.refresh()
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsLive(true)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router])

  // Thay đổi ngày
  function changeDate(days: number) {
    setSelectedDate(addDaysToDateKey(selectedDate, days))
  }

  // Lọc bookings theo ngày được chọn
  const dayBookings = initialBookings.filter((b) => {
    return vnDateKey(new Date(b.start_time)) === selectedDate
  })

  // Lọc theo trạng thái cho chế độ xem bảng
  const filteredTableBookings = dayBookings.filter((b) => {
    if (statusFilter === 'all') return true
    return b.status === statusFilter
  })

  async function handleNoShow(bookingId: string, noShow: boolean) {
    if (noShow) {
      const ok = await askConfirm({
        title: t('noShowConfirmTitle'),
        description: t('noShowConfirmText'),
        confirmText: t('noShowConfirm'),
        cancelText: t('noShowKeep'),
        destructive: true,
      })
      if (!ok) return
    }

    setUpdatingId(bookingId)
    const result = await reportBookingNoShow(bookingId, noShow)
    setUpdatingId(null)

    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(noShow ? t('noShowMarked') : t('noShowCleared'))
    router.refresh()
  }

  async function handleStatusChange(bookingId: string, status: 'confirmed' | 'cancelled' | 'completed') {
    if (status === 'cancelled') {
      const ok = await askConfirm({
        title: t('cancelTitle'),
        description: t('cancelText'),
        confirmText: t('cancelConfirm'),
        cancelText: t('cancelKeep'),
        destructive: true,
      })
      if (!ok) return
    }

    setUpdatingId(bookingId)
    const result = await updateBookingStatus(bookingId, status)
    setUpdatingId(null)

    if (result.error) {
      toast.error(result.error)
      return
    }
    if (status === 'cancelled' && result.refundAmount) {
      toast.success(t('cancelledRefund', { amount: formatVnd(result.refundAmount) }))
    } else if (status === 'cancelled') {
      toast.success(t('cancelled'))
    }
  }

  return (
    <div className="space-y-6">
      {/* Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
        {/* Date Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => changeDate(-1)}
            aria-label={t('prevDay')}
            className="h-10 w-10 shrink-0 cursor-pointer md:h-9 md:w-9"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="flex min-w-[9.5rem] flex-1 items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/30 md:flex-none">
            <CalendarDays className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold focus:outline-none cursor-pointer"
            />
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => changeDate(1)}
            aria-label={t('nextDay')}
            className="h-10 w-10 shrink-0 cursor-pointer md:h-9 md:w-9"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedDate(vnDateKey(Date.now()))}
            className="h-10 shrink-0 px-3 text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-400 cursor-pointer md:h-8"
          >
            {t('today')}
          </Button>
        </div>

        {/* View Switcher Toggle & Realtime Badge */}
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{isLive ? t('live') : t('connecting')}</span>
          </div>

          <div className="flex w-full items-center gap-1.5 p-1 bg-muted rounded-lg border border-border/60 md:w-auto">
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer md:flex-none md:py-1.5 ${
                viewMode === 'timeline'
                  ? 'bg-background text-emerald-700 dark:text-emerald-400 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              {t('timelineTab')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer md:flex-none md:py-1.5 ${
                viewMode === 'table'
                  ? 'bg-background text-emerald-700 dark:text-emerald-400 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              {t('tableTab')}
            </button>
          </div>
        </div>
      </div>

      {courts.length === 0 ? (
        <Card className="border-dashed border-2 p-12 text-center text-muted-foreground">
          {t('noCourts')}
        </Card>
      ) : viewMode === 'timeline' ? (
        /* ========================================================
         * 1. TIMELINE GRID VIEW (Mỗi sân con 1 cột, slot giờ theo hàng)
         * ======================================================== */
        <Card className="border-border shadow-sm overflow-hidden">
          <CardHeader className="py-4 border-b border-border/60">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">{t('gridTitle')}</CardTitle>
                <CardDescription className="text-xs">
                  {t('gridHint', { date: formatDate(selectedDate) })}
                </CardDescription>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  {t('legendPaid')}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  {t('legendPending')}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-border" />
                  {t('legendFree')}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Header row: Danh sách sân */}
              <div className="grid grid-cols-[80px_repeat(auto-fit,minmax(180px,1fr))] border-b border-border bg-muted/40 sticky top-0 z-10">
                <div className="p-3 text-xs font-bold text-muted-foreground text-center border-r border-border">
                  {t('hourColumn')}
                </div>
                {courts.map((court) => (
                  <div
                    key={court.id}
                    className="p-3 text-xs font-bold text-foreground border-r border-border last:border-r-0 text-center"
                  >
                    <div className="truncate">{court.name}</div>
                    <div className="text-xs text-muted-foreground font-normal truncate">
                      {court.club_name}
                    </div>
                  </div>
                ))}
              </div>

              {/* Time rows */}
              {TIME_SLOTS.map((slot) => {
                const slotHour = parseInt(slot.split(':')[0], 10)

                return (
                  <div
                    key={slot}
                    className="grid grid-cols-[80px_repeat(auto-fit,minmax(180px,1fr))] border-b border-border/40 hover:bg-muted/10 transition-colors"
                  >
                    {/* Giờ */}
                    <div className="p-2.5 text-xs text-muted-foreground font-medium text-center border-r border-border flex items-center justify-center bg-muted/20">
                      {slot}
                    </div>

                    {/* Từng sân con */}
                    {courts.map((court) => {
                      // Tìm booking trùng với giờ này
                      const booking = dayBookings.find((b) => {
                        if (b.court_id !== court.id) return false
                        const { startHour, endHour } = vnHourSpan(b.start_time, b.end_time)
                        return slotHour >= startHour && slotHour < endHour
                      })

                      const isFirstHour =
                        booking && vnHourSpan(booking.start_time, booking.end_time).startHour === slotHour

                      return (
                        <div
                          key={court.id}
                          className="p-1 border-r border-border/40 last:border-r-0 min-h-[48px] flex items-center justify-center relative"
                        >
                          {booking ? (
                            isFirstHour ? (
                              <div
                                className={`w-full h-full rounded-lg p-2 text-xs flex flex-col justify-between shadow-xs border ${
                                  booking.status === 'confirmed'
                                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                                    : booking.status === 'pending'
                                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300'
                                    : 'bg-muted border-border text-muted-foreground'
                                }`}
                              >
                                <div className="font-bold truncate">
                                  {booking.user_name || t('bookedBy')}
                                </div>
                                <div className="text-xs flex items-center justify-between opacity-80 mt-0.5">
                                  <span>{booking.user_phone}</span>
                                  <span className="font-semibold">
                                    {booking.status === 'confirmed' ? t('legendPaid') : t('legendPending')}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div
                                className={`w-full h-full rounded-md opacity-40 ${
                                  booking.status === 'confirmed'
                                    ? 'bg-emerald-500/20'
                                    : 'bg-amber-500/20'
                                }`}
                              />
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground/30 font-mono">
                              {t('free')}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        /* ========================================================
         * 2. DATA TABLE VIEW (Bộ lọc & Danh sách chi tiết)
         * ======================================================== */
        <Card className="border-border shadow-sm">
          <CardHeader className="py-4 border-b border-border/60">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold">{t('listTitle')}</CardTitle>
                <CardDescription className="text-xs">
                  {t('listHint', { date: formatDate(selectedDate) })}
                </CardDescription>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5">
                {['all', 'confirmed', 'pending', 'completed'].map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer capitalize ${
                      statusFilter === status
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {status === 'all'
                      ? t('filterAll')
                      : status === 'confirmed'
                      ? t('filterPaid')
                      : status === 'pending'
                      ? t('filterPending')
                      : t('filterDone')}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {filteredTableBookings.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                {t('noMatch')}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/40 text-muted-foreground uppercase text-xs border-b border-border">
                    <tr>
                      <th className="py-3 px-4">{t('col.court')}</th>
                      <th className="py-3 px-4">{t('col.customer')}</th>
                      <th className="py-3 px-4">{t('col.time')}</th>
                      <th className="py-3 px-4">{t('col.total')}</th>
                      <th className="py-3 px-4">{t('col.deposit')}</th>
                      <th className="py-3 px-4">{t('col.status')}</th>
                      <th className="py-3 px-4 text-right">{t('col.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredTableBookings.map((b) => {
                      const startTime = formatTime(b.start_time)
                      const endTime = formatTime(b.end_time)

                      const isUpdating = updatingId === b.id

                      return (
                        <tr key={b.id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4 font-bold text-foreground">
                            {b.court_name}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-foreground">{b.user_name}</div>
                            <div className="text-xs text-muted-foreground">{b.user_phone}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              <ReputationBadge reputation={reputations[b.user_id]} />
                              {b.recurring && (
                                <Badge variant="outline" className="border-blue-500/30 text-blue-600 dark:text-blue-400">
                                  {t('recurringBadge')}
                                </Badge>
                              )}
                              {b.no_show && (
                                <Badge variant="outline" className="border-red-500/30 text-red-600 dark:text-red-400">
                                  {t('noShow')}
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-medium text-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                              {startTime} - {endTime}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-foreground">
                            {formatVnd(b.total_price)}
                          </td>
                          <td className="py-3 px-4 font-bold text-emerald-700 dark:text-emerald-400">
                            {formatVnd(b.deposit_amount)}
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant="outline"
                              className={
                                b.status === 'confirmed'
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                                  : b.status === 'pending'
                                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                                  : 'bg-muted text-muted-foreground'
                              }
                            >
                              {b.status === 'confirmed'
                                ? t('legendPaid')
                                : b.status === 'pending'
                                ? t('legendPending')
                                : b.status === 'completed'
                                ? t('filterDone')
                                : t('badgeCancelled')}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {isUpdating ? (
                              <Loader2 className="w-4 h-4 animate-spin ml-auto text-emerald-700 dark:text-emerald-400" />
                            ) : (
                              <div className="flex items-center justify-end gap-1.5">
                                {b.status === 'pending' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleStatusChange(b.id, 'confirmed')}
                                    className="h-9 text-xs md:h-7 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    {t('approveDeposit')}
                                  </Button>
                                )}
                                {b.status === 'confirmed' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleStatusChange(b.id, 'completed')}
                                    className="h-9 text-xs md:h-7 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 cursor-pointer"
                                  >
                                    {t('markDone')}
                                  </Button>
                                )}
                                {(b.status === 'confirmed' || b.status === 'completed') &&
                                  new Date(b.start_time).getTime() <= serverNow && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleNoShow(b.id, !b.no_show)}
                                      className="h-9 text-xs md:h-7 cursor-pointer"
                                    >
                                      {b.no_show ? t('undoNoShow') : t('reportNoShow')}
                                    </Button>
                                  )}
                                {b.status !== 'cancelled' && b.status !== 'completed' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleStatusChange(b.id, 'cancelled')}
                                    className="h-9 text-xs md:h-7 text-red-600 dark:text-red-400 hover:bg-red-500/10 cursor-pointer"
                                  >
                                    <XCircle className="w-3 h-3 mr-1" />
                                    {t('cancel')}
                                  </Button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
