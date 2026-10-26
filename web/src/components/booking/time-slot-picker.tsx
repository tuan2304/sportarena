'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createBooking } from '@/app/actions/booking'
import { computePrice } from '@/lib/pricing'
import { vnDateKey, vnDateTime } from '@/lib/datetime'
import { hourRange, isHourBooked, isHourPast, isDurationAvailable, type BusySlot } from '@/lib/booking-slots'
import { CourtStep } from '@/components/booking/picker/court-step'
import { DateStep } from '@/components/booking/picker/date-step'
import { HourStep } from '@/components/booking/picker/hour-step'
import { BookingSummary } from '@/components/booking/picker/booking-summary'
import { INITIAL_MATCH_DRAFT, type CourtData, type MatchDraft } from '@/components/booking/picker/types'

interface TimeSlotPickerProps {
  courts: CourtData[]
  existingBookings: BusySlot[]
  clubOpenTime: string
  clubCloseTime: string
  /** Chính sách hủy của cụm sân (đã dịch), hiện trong chi tiết sân */
  cancelPolicy?: string
}

/** Luồng chọn sân → ngày → giờ → thời lượng, kèm tùy chọn mở ghép kèo. Mọi mốc giờ tính theo giờ Việt Nam. */
export function TimeSlotPicker({ courts, existingBookings, clubOpenTime, clubCloseTime, cancelPolicy }: TimeSlotPickerProps) {
  const router = useRouter()
  const t = useTranslations('booking.picker')

  // Mốc "bây giờ" cập nhật mỗi 30 giây để ô giờ vừa tới tự bị gạch khi trang đang mở
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])
  const todayKey = vnDateKey(nowMs)

  const [selectedCourtId, setSelectedCourtId] = useState<string>(courts[0]?.id || '')
  const [selectedDate, setSelectedDate] = useState<string>(todayKey)
  const [pickedHour, setStartHour] = useState<number | null>(null)
  // Giờ đã chọn mà trôi qua trong lúc đang xem thì coi như bỏ chọn
  const startHour = pickedHour !== null && isHourPast(selectedDate, pickedHour, nowMs) ? null : pickedHour
  const [duration, setDuration] = useState<number>(1)
  const [note, setNote] = useState('')
  const [matchDraft, setMatchDraft] = useState<MatchDraft>(INITIAL_MATCH_DRAFT)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedCourt = courts.find((c) => c.id === selectedCourtId)
  const hours = hourRange(clubOpenTime, clubCloseTime)
  const closeHour = parseInt(clubCloseTime.slice(0, 2), 10) || 23

  // Khung giờ đã chọn → giá (cùng hàm computePrice với server nên số tiền luôn khớp)
  const slot =
    startHour !== null
      ? (() => {
          const start = vnDateTime(selectedDate, startHour)
          return { start, end: new Date(start.getTime() + duration * 60 * 60 * 1000), durationHours: duration }
        })()
      : null

  const priced =
    selectedCourt && slot
      ? computePrice({
          start: slot.start,
          end: slot.end,
          basePricePerHour: selectedCourt.base_price_per_hour,
          depositPercentage: selectedCourt.deposit_percentage,
          rules: selectedCourt.court_pricing_rules,
        })
      : null

  const price = {
    pricePerHour: priced?.pricePerHour ?? Number(selectedCourt?.base_price_per_hour ?? 0),
    totalPrice: priced?.totalPrice ?? 0,
    depositAmount: priced?.depositAmount ?? 0,
    depositPercent: selectedCourt?.deposit_percentage ?? 30,
    isPeak: priced?.ruleApplied ?? false,
  }

  function changeSelection(patch: { courtId?: string; date?: string }) {
    if (patch.courtId !== undefined) setSelectedCourtId(patch.courtId)
    if (patch.date !== undefined) setSelectedDate(patch.date)
    // Đổi sân hoặc ngày thì giờ đã chọn có thể không còn hợp lệ
    setStartHour(null)
    setDuration(1)
    setError(null)
  }

  async function handleBook() {
    if (!slot || !selectedCourt) {
      setError(t('chooseSlot'))
      return
    }

    setLoading(true)
    setError(null)

    const result = await createBooking(
      selectedCourt.id,
      slot.start.toISOString(),
      slot.end.toISOString(),
      note,
      matchDraft.enabled
        ? {
            isOpenMatch: true,
            title: matchDraft.title.trim() || t('defaultMatchTitle', { court: selectedCourt.name, date: selectedDate }),
            skillLevel: matchDraft.skillLevel,
            requiredPlayers: matchDraft.requiredPlayers,
            costSharingType: matchDraft.costSharingType,
            // Để server tự tính khi chia đều (Tổng tiền ÷ số người)
            costPerPerson: undefined,
          }
        : undefined
    )

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else if (result.bookingId) {
      router.push(`/bookings/${result.bookingId}`)
    }
  }

  if (courts.length === 0) {
    return (
      <div className="p-8 text-center border border-dashed rounded-xl text-muted-foreground text-sm">
        {t('noCourts')}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <CourtStep
          courts={courts}
          selectedCourtId={selectedCourtId}
          onSelect={(courtId) => changeSelection({ courtId })}
          clubOpenTime={clubOpenTime}
          clubCloseTime={clubCloseTime}
          cancelPolicy={cancelPolicy}
        />

        <DateStep
          selectedDate={selectedDate}
          todayKey={todayKey}
          onChange={(date) => changeSelection({ date })}
        />

        <HourStep
          hours={hours}
          startHour={startHour}
          duration={duration}
          isBooked={(hour) => isHourBooked(existingBookings, selectedCourtId, selectedDate, hour)}
          isPast={(hour) => isHourPast(selectedDate, hour, nowMs)}
          isDurationAvailable={(dur) =>
            startHour !== null &&
            isDurationAvailable({
              busy: existingBookings,
              courtId: selectedCourtId,
              dateKey: selectedDate,
              startHour,
              duration: dur,
              closeHour,
            })
          }
          onSelectHour={(hour) => {
            setStartHour(hour)
            setError(null)
            // Thời lượng đang chọn có thể đè lên đơn kế tiếp → về mặc định 1 tiếng
            setDuration(1)
          }}
          onSelectDuration={setDuration}
        />
      </div>

      <div className="space-y-4">
        <BookingSummary
          courtName={selectedCourt?.name}
          selectedDate={selectedDate}
          slot={slot}
          price={price}
          note={note}
          onNoteChange={setNote}
          matchDraft={matchDraft}
          onMatchDraftChange={(patch) => setMatchDraft((prev) => ({ ...prev, ...patch }))}
          error={error}
          loading={loading}
          onSubmit={handleBook}
        />
      </div>
    </div>
  )
}
