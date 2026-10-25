'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { simulateDepositPayment, cancelExpiredBooking } from '@/app/actions/booking'
import { cancelBooking, claimManualTransfer } from '@/app/actions/cancellation'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { refundStatusLabel } from '@/lib/cancellation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Clock,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Copy,
  Check,
  ArrowRight,
} from 'lucide-react'

import { bankNameFromBin } from '@/lib/banks'
import { DirectionsLinks } from '@/components/maps/directions-links'
import { fullAddress } from '@/lib/maps'
import { formatVnd, formatTime, formatDate } from '@/lib/format'
export interface BookingPaymentViewProps {
  booking: {
    id: string
    court_id: string
    start_time: string
    end_time: string
    total_price: number
    deposit_amount: number
    status: string
    expires_at: string
    refund_status?: string
    refund_amount?: number
  }
  payment: {
    id: string
    order_code: number
    amount: number
    status: string
    checkout_url?: string | null
    qr_code_url?: string | null
    metadata?: {
      bin?: string
      account_number?: string
      account_name?: string
      description?: string
      /** 'manual' = chuyển khoản thủ công, chủ sân tự xác nhận */
      channel?: string
      claimed_at?: string
    } | null
  } | null
  /** Chỉ true ở môi trường dev chưa cấu hình PayOS */
  simulationEnabled?: boolean
  /** Giờ server lúc render, để đếm ngược không phụ thuộc đồng hồ máy khách */
  serverNow?: number
  court: {
    name: string
    sport_type: string
  }
  club: {
    name: string
    address: string
    district?: string | null
    city?: string | null
    latitude?: number | null
    longitude?: number | null
  }
}

export function BookingPaymentView({
  booking,
  payment,
  court,
  club,
  simulationEnabled = false,
  serverNow,
}: BookingPaymentViewProps) {
  const [currentStatus, setCurrentStatus] = useState<string>(booking.status)
  const [copied, setCopied] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<boolean>(false)
  const [claimed, setClaimed] = useState<boolean>(Boolean(payment?.metadata?.claimed_at))
  const [claiming, setClaiming] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const confirm = useConfirm()
  const t = useTranslations('payment')
  const lang = useLocale() === 'en' ? 'en' : 'vi'
  const isManual = payment?.metadata?.channel === 'manual'

  // 1. Tính toán thời gian đếm ngược 15 phút
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    const expireTime = new Date(booking.expires_at).getTime()
    // Dùng giờ server nếu có, tránh sai khi đồng hồ máy người dùng bị lệch
    const now = serverNow ?? Date.now()
    return Math.max(0, Math.floor((expireTime - now) / 1000))
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (currentStatus === 'confirmed' || currentStatus === 'cancelled' || timeLeft <= 0) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          // Server quyết định đơn có thật sự hết hạn không; kiểm tra lại trạng thái thực để
          // không báo "hết hạn" oan nếu tiền vừa về ở giây cuối
          cancelExpiredBooking(booking.id).then(async () => {
            const { data } = await createClient()
              .from('bookings')
              .select('status')
              .eq('id', booking.id)
              .maybeSingle()
            setCurrentStatus(data?.status ?? 'cancelled')
          })
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [currentStatus, timeLeft, booking.id])

  // 2. Lắng nghe Supabase Realtime khi chủ sân hoặc PayOS Webhook xác nhận cọc
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`booking-${booking.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${booking.id}`,
        },
        (payload) => {
          if (payload.new && payload.new.status) {
            setCurrentStatus(payload.new.status)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [booking.id])

  // 2b. Dự phòng khi kênh Realtime bị rớt: hỏi lại trạng thái đơn mỗi 8 giây trong lúc chờ cọc
  useEffect(() => {
    if (currentStatus !== 'pending') return
    const supabase = createClient()
    const poll = setInterval(async () => {
      const { data } = await supabase.from('bookings').select('status').eq('id', booking.id).maybeSingle()
      if (data?.status && data.status !== 'pending') setCurrentStatus(data.status)
    }, 8000)
    return () => clearInterval(poll)
  }, [currentStatus, booking.id])

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`

  const depositAmount = Number(booking.deposit_amount)
  const bank = payment?.metadata
  const transferContent = bank?.description || (payment ? `SPORT ${payment.order_code}` : '')
  const qrUrl = payment?.qr_code_url || null
  const bankName = bankNameFromBin(bank?.bin)
  const refundNote =
    booking.refund_status && booking.refund_amount
      ? refundStatusLabel(booking.refund_status, booking.refund_amount, formatVnd, lang)
      : null

  function copyText(text: string, type: string) {
    navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  // Chỉ có ở dev khi chưa cấu hình PayOS: giả lập khách đã chuyển khoản
  async function handleSimulateConfirm() {
    setConfirming(true)
    setError(null)
    try {
      const result = await simulateDepositPayment(booking.id)
      if (result.error) {
        setError(result.error)
      } else {
        setCurrentStatus('confirmed')
      }
    } catch {
      setError(t('simulateError'))
    } finally {
      setConfirming(false)
    }
  }

  // Khách đã chuyển khoản: báo chủ sân đối chiếu; server kéo dài thời gian giữ chỗ nên đọc lại hạn mới
  async function handleClaimTransfer() {
    setClaiming(true)
    setError(null)
    try {
      const result = await claimManualTransfer(booking.id)
      if (result.error) {
        setError(result.error)
        return
      }
      setClaimed(true)
      const { data } = await createClient().from('bookings').select('expires_at').eq('id', booking.id).maybeSingle()
      if (data?.expires_at) setTimeLeft(Math.max(0, Math.floor((new Date(data.expires_at).getTime() - Date.now()) / 1000)))
    } catch {
      setError(t('claimError'))
    } finally {
      setClaiming(false)
    }
  }

  async function handleCancel() {
    const ok = await confirm({
      title: t('cancelDialog.title'),
      description: t('cancelDialog.text'),
      confirmText: t('cancelDialog.confirm'),
      cancelText: t('cancelDialog.keep'),
      destructive: true,
    })
    if (!ok) return
    setCancelling(true)
    setError(null)
    const result = await cancelBooking(booking.id)
    setCancelling(false)
    if (result.error) setError(result.error)
    else setCurrentStatus('cancelled')
  }

  // Giao diện khi đã cọc thành công
  if (currentStatus === 'confirmed') {
    return (
      <Card className="max-w-xl mx-auto border-emerald-500/30 shadow-xl overflow-hidden bg-card">
        <div className="bg-emerald-700 p-8 text-center text-white space-y-3">
          <div className="w-16 h-16 rounded-full bg-white/20 text-white flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black tracking-tight">{t('success.title')}</h2>
          <p className="text-xs text-white/80 max-w-sm mx-auto">
            {t('success.text')}
          </p>
        </div>

        <CardContent className="p-6 space-y-4 text-xs">
          <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('venue')}</span>
              <span className="font-bold text-foreground">{club.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('court')}</span>
              <span className="font-semibold text-foreground">{court.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('time')}</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                {formatTime(booking.start_time)} -{' '}
                {formatTime(booking.end_time)} (
                {formatDate(booking.start_time)})
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="text-muted-foreground">{t('depositPaid')}</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                {formatVnd(depositAmount)}
              </span>
            </div>
          </div>

          <DirectionsLinks
            place={{ lat: club.latitude, lng: club.longitude, name: club.name, address: fullAddress(club) }}
          />

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link href="/my-bookings" className="flex-1">
              <Button variant="outline" className="w-full cursor-pointer">
                {t('viewMyBookings')}
              </Button>
            </Link>
            <Link href="/clubs" className="flex-1">
              <Button className="w-full bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer">
                {t('bookAgain')} <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Giao diện khi hết hạn 15 phút hoặc đã hủy
  if (currentStatus === 'cancelled' || timeLeft <= 0) {
    return (
      <Card className="max-w-md mx-auto border-red-500/30 p-8 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold text-foreground">
          {currentStatus === 'cancelled' && timeLeft > 0 ? t('cancelled.title') : t('cancelled.expired')}
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t('cancelled.text')}
        </p>
        {refundNote && <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">{refundNote}</p>}
        <Link href="/clubs">
          <Button className="bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer font-bold">
            {t('cancelled.rebook')}
          </Button>
        </Link>
      </Card>
    )
  }

  // Giao diện thanh toán cọc VietQR chuẩn 15 phút
  return (
    <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-6">
      {/* 3 Cols: Mã VietQR & Đồng Hồ Đếm Ngược */}
      <Card className="md:col-span-3 border-border shadow-md overflow-hidden bg-card">
        <CardHeader className="bg-muted/30 pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">{t('qr.title')}</CardTitle>
                <CardDescription className="text-xs">
                  {t('qr.subtitle')}
                </CardDescription>
              </div>
            </div>

            {/* Countdown Badge */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 font-mono font-bold text-xs">
              <Clock className="w-3.5 h-3.5 animate-pulse text-amber-700 dark:text-amber-400" />
              <span>{formattedTime}</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 flex flex-col items-center justify-center space-y-4">
          {/* QR Code Container */}
          <div className="p-3 bg-white rounded-2xl border-2 border-emerald-500/30 shadow-md">
            {qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- ảnh QR động từ img.vietqr.io, cần giữ nguyên độ nét
              <img
                src={qrUrl}
                alt={t('qr.alt')}
                className="w-56 h-56 object-contain"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-xs text-muted-foreground text-center p-4">
                {t('qr.failed')}
              </div>
            )}
          </div>

          <div className="text-center space-y-1">
            <div className="text-xs text-muted-foreground">{t('amountDue')}</div>
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
              {formatVnd(depositAmount)}
            </div>
          </div>

          {/* Transfer Info Breakdown */}
          <div className="w-full space-y-2 text-xs pt-2 border-t border-border/60">
            {bankName && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                <span className="text-muted-foreground">{t('bank')}</span>
                <span className="font-bold text-foreground">{bankName}</span>
              </div>
            )}

            {bank?.account_number && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                <span className="text-muted-foreground">{t('accountNumber')}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-foreground">{bank.account_number}</span>
                  <button
                    type="button"
                    onClick={() => copyText(bank.account_number!, 'account')}
                    className="text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                    title={t('copyAccount')}
                  >
                    {copied === 'account' ? <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}

            {bank?.account_name && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                <span className="text-muted-foreground">{t('accountName')}</span>
                <span className="font-semibold text-foreground">{bank.account_name}</span>
              </div>
            )}

            <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-emerald-800 dark:text-emerald-300 font-semibold">{t('transferContent')}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{transferContent}</span>
                <button
                  type="button"
                  onClick={() => copyText(transferContent, 'content')}
                  className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 cursor-pointer"
                  title={t('copyContent')}
                >
                  {copied === 'content' ? <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="bg-muted/20 border-t border-border/60 p-4 flex flex-col gap-2">
          {simulationEnabled && (
            <>
              <Button
                type="button"
                disabled={confirming}
                onClick={handleSimulateConfirm}
                className="w-full bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold cursor-pointer"
              >
                {confirming ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('simulating')}
                  </>
                ) : (
                  t('simulate')
                )}
              </Button>
              {error && <p role="alert" className="text-xs text-red-700 dark:text-red-400 text-center">{error}</p>}
            </>
          )}

          {isManual && (
            claimed ? (
              <p role="status" className="text-xs text-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 p-3 leading-relaxed">
                {t('claimed')}
              </p>
            ) : (
              <Button
                type="button"
                disabled={claiming}
                onClick={handleClaimTransfer}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold cursor-pointer"
              >
                {claiming ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('claimSending')}
                  </>
                ) : (
                  t('claim')
                )}
              </Button>
            )
          )}

          {error && !simulationEnabled && <p role="alert" className="text-xs text-red-700 dark:text-red-400 text-center">{error}</p>}

          <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {isManual
              ? t('liveManual')
              : t('liveAuto')}
          </p>

          <button
            type="button"
            disabled={cancelling}
            onClick={handleCancel}
            className="text-xs text-center text-muted-foreground underline underline-offset-2 hover:text-red-700 dark:hover:text-red-400 cursor-pointer disabled:opacity-50"
          >
            {cancelling ? t('cancelling') : t('cancelHold')}
          </button>
        </CardFooter>
      </Card>

      {/* 2 Cols: Thông tin lịch đặt */}
      <div className="md:col-span-2 space-y-4">
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-sm font-bold">{t('details.title')}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3 text-xs">
            <div className="space-y-1">
              <div className="font-bold text-foreground text-sm">{club.name}</div>
              <div className="text-muted-foreground">{club.address}</div>
            </div>

            <div className="pt-2 border-t border-border/60 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('court')}</span>
                <span className="font-bold text-foreground">{court.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('details.sport')}</span>
                <span className="font-semibold text-foreground capitalize">{court.sport_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('details.date')}</span>
                <span className="font-semibold text-foreground">
                  {formatDate(booking.start_time)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('details.slot')}</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                  {formatTime(booking.start_time)} -{' '}
                  {formatTime(booking.end_time)}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-border/60 space-y-1.5">
              <div className="flex justify-between text-muted-foreground">
                <span>{t('details.total')}</span>
                <span>{formatVnd(booking.total_price)}</span>
              </div>
              <div className="flex justify-between font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                <span>{t('details.deposit')}</span>
                <span>{formatVnd(depositAmount)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground text-xs">
                <span>{t('details.remaining')}</span>
                <span>{formatVnd(Number(booking.total_price) - depositAmount)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-muted-foreground space-y-2">
          <div className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" /> {t('policy.title')}
          </div>
          <p className="leading-relaxed">
            {isManual
              ? t('policy.manual')
              : t('policy.auto')}
          </p>
        </div>
      </div>
    </div>
  )
}
