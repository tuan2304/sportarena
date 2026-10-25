import { useI18n } from '../i18n'
import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { CheckCircle2, ChevronLeft, Clock, XCircle } from 'lucide-react-native'
import { colors } from '../theme/colors'
import { supabase } from '../lib/supabase'
import { apiPost } from '../lib/api'
import { formatCountdown, formatDate, formatTime, formatVnd } from '../lib/format'
import { decideCancellation, describeOutcome } from '../shared/cancellation'

const POLL_MS = 5000
// Chỉ hiển thị ảnh QR từ dịch vụ VietQR, tránh tải một địa chỉ ảnh lạ nằm trong dữ liệu
const QR_HOST = 'https://img.vietqr.io/'

interface PaymentRow {
  order_code: number
  amount: number
  status: string
  qr_code_url: string | null
  metadata: { bin?: string; account_number?: string; account_name?: string; description?: string; channel?: string; claimed_at?: string } | null
}

interface BookingRow {
  id: string
  status: string
  start_time: string
  end_time: string
  total_price: number
  deposit_amount: number
  expires_at: string
  refund_status: string
  refund_amount: number
  court: { name: string; club: { name: string; address: string; free_cancel_hours: number } | null } | null
  payments: PaymentRow[]
}

const SELECT = `
  id, status, start_time, end_time, total_price, deposit_amount, expires_at, refund_status, refund_amount,
  court:courts ( name, club:clubs ( name, address, free_cancel_hours ) ),
  payments ( order_code, amount, status, qr_code_url, metadata, created_at )
`

export default function BookingPaymentScreen({ route, navigation }: any) {
  const { t, lang } = useI18n()
  const { bookingId } = route.params as { bookingId: string }
  const [booking, setBooking] = useState<BookingRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [busy, setBusy] = useState(false)
  const [claimed, setClaimed] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('bookings').select(SELECT).eq('id', bookingId).maybeSingle()
    if (error) console.error('Lỗi tải đơn:', error.message)
    const row = (data as unknown as BookingRow | null) ?? null
    setBooking(row)
    setLoading(false)
    if (row) {
      setSecondsLeft(Math.max(0, Math.floor((new Date(row.expires_at).getTime() - Date.now()) / 1000)))
      const latest = [...row.payments].pop()
      setClaimed(Boolean(latest?.metadata?.claimed_at))
    }
  }, [bookingId])

  useEffect(() => {
    load()
  }, [load])

  // Hỏi lại trạng thái trong lúc chờ cọc: chủ sân hoặc PayOS xác nhận thì màn hình tự đổi
  useEffect(() => {
    if (booking?.status !== 'pending') return
    const timer = setInterval(load, POLL_MS)
    return () => clearInterval(timer)
  }, [booking?.status, load])

  useEffect(() => {
    if (booking?.status !== 'pending') return
    const timer = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(timer)
  }, [booking?.status])

  const payment = booking?.payments?.length ? booking.payments[booking.payments.length - 1] : null
  const isManual = payment?.metadata?.channel === 'manual'

  async function handleClaim() {
    setBusy(true)
    const res = await apiPost(`/api/mobile/bookings/${bookingId}/claim`)
    setBusy(false)
    if (!res.ok) {
      Alert.alert(t('payment.claimFailed'), res.error)
      return
    }
    setClaimed(true)
    load()
  }

  function handleCancel() {
    if (!booking) return
    const decision = decideCancellation({
      status: booking.status,
      start: new Date(booking.start_time),
      now: new Date(),
      paidAmount: booking.status === 'confirmed' ? Number(booking.deposit_amount) : 0,
      freeCancelHours: booking.court?.club?.free_cancel_hours ?? 24,
      by: 'player',
    })
    Alert.alert(t('payment.cancelTitle'), describeOutcome(decision, formatVnd, lang), [
      { text: t('payment.keep'), style: 'cancel' },
      {
        text: t('payment.cancelConfirm'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true)
          const res = await apiPost(`/api/mobile/bookings/${bookingId}/cancel`)
          setBusy(false)
          if (!res.ok) {
            Alert.alert(t('payment.cancelFailed'), res.error)
            return
          }
          load()
        },
      },
    ])
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }
  if (!booking) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('payment.notFound')}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('MainTabs', { screen: 'BookingsTab' })}>
          <Text style={styles.link}>{t('payment.toBookings')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const expired = booking.status === 'pending' && secondsLeft <= 0
  const where = `${booking.court?.name ?? t('payment.courtFallback')} · ${booking.court?.club?.name ?? ''}`
  const when = `${formatTime(booking.start_time)} - ${formatTime(booking.end_time)} · ${formatDate(booking.start_time)}`

  const goBookings = () => navigation.navigate('MainTabs', { screen: 'BookingsTab' })

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={goBookings} accessibilityLabel={t('payment.toBookings')}>
          <ChevronLeft size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('payment.headerTitle')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{where}</Text>
          <Text style={styles.cardSub}>{when}</Text>
        </View>

        {booking.status === 'confirmed' && (
          <View style={[styles.result, { borderColor: colors.success }]}>
            <CheckCircle2 size={36} color={colors.success} />
            <Text style={styles.resultTitle}>{t('payment.successTitle')}</Text>
            <Text style={styles.resultText}>{t('payment.successText', { amount: formatVnd(booking.deposit_amount) })}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={goBookings}>
              <Text style={styles.primaryText}>{t('payment.viewMine')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={handleCancel} disabled={busy}>
              <Text style={styles.ghostText}>{t('payment.cancelConfirm')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {(booking.status === 'cancelled' || expired) && booking.status !== 'confirmed' && (
          <View style={[styles.result, { borderColor: colors.danger }]}>
            <XCircle size={36} color={colors.danger} />
            <Text style={styles.resultTitle}>{booking.status === 'cancelled' ? t('payment.cancelled') : t('payment.expired')}</Text>
            <Text style={styles.resultText}>
              {booking.status === 'cancelled'
                ? t('payment.releasedText')
                : t('payment.expiredText')}
            </Text>
            {booking.refund_status === 'pending' && (
              <Text style={styles.refund}>{t('payment.refundPending', { amount: formatVnd(booking.refund_amount) })}</Text>
            )}
            {booking.refund_status === 'refunded' && (
              <Text style={[styles.refund, { color: colors.success }]}>{t('payment.refundDone', { amount: formatVnd(booking.refund_amount) })}</Text>
            )}
            <TouchableOpacity style={styles.primaryBtn} onPress={goBookings}>
              <Text style={styles.primaryText}>{t('payment.toBookings')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {booking.status === 'pending' && !expired && (
          <>
            <View style={styles.countdown}>
              <Clock size={16} color={colors.accent} />
              <Text style={styles.countdownText}>{t('payment.holdLeft', { time: formatCountdown(secondsLeft) })}</Text>
            </View>

            <View style={styles.qrBox}>
              {payment?.qr_code_url?.startsWith(QR_HOST) ? (
                <Image source={{ uri: payment.qr_code_url }} style={styles.qr} resizeMode="contain" accessibilityLabel={t('payment.qrAlt')} />
              ) : (
                <Text style={styles.muted}>{t('payment.qrFailed')}</Text>
              )}
            </View>

            <Text style={styles.amountLabel}>{t('payment.amountLabel')}</Text>
            <Text style={styles.amount}>{formatVnd(booking.deposit_amount)}</Text>

            <View style={styles.info}>
              {payment?.metadata?.account_number && <InfoRow label={t('payment.accountNumber')} value={payment.metadata.account_number} />}
              {payment?.metadata?.account_name && <InfoRow label={t('payment.accountName')} value={payment.metadata.account_name} />}
              <InfoRow label={t('payment.transferNote')} value={payment?.metadata?.description ?? `SPORT ${payment?.order_code ?? ''}`} highlight />
            </View>

            {isManual ? (
              claimed ? (
                <Text style={styles.waiting}>{t('payment.claimed')}</Text>
              ) : (
                <TouchableOpacity style={[styles.primaryBtn, busy && styles.disabled]} onPress={handleClaim} disabled={busy}>
                  {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>{t('payment.claim')}</Text>}
                </TouchableOpacity>
              )
            ) : (
              <Text style={styles.waiting}>{t('payment.autoNote')}</Text>
            )}

            <TouchableOpacity style={styles.ghostBtn} onPress={handleCancel} disabled={busy}>
              <Text style={styles.ghostText}>{t('payment.cancelHold')}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  )
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={[styles.infoRow, highlight && styles.infoRowHighlight]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text selectable style={[styles.infoValue, highlight && { color: colors.primary }]}>
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, gap: 12 },
  headerBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', color: colors.textPrimary, fontWeight: '700', fontSize: 16 },
  body: { padding: 16, gap: 14, paddingBottom: 32 },
  card: { padding: 14, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, gap: 4 },
  cardTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
  cardSub: { color: colors.textSecondary, fontSize: 13 },
  countdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10, borderRadius: 10, backgroundColor: colors.accentLight },
  countdownText: { color: colors.accent, fontWeight: '700', fontSize: 14 },
  qrBox: { alignSelf: 'center', padding: 12, borderRadius: 16, backgroundColor: colors.white },
  qr: { width: 240, height: 240 },
  amountLabel: { textAlign: 'center', color: colors.textSecondary, fontSize: 13 },
  amount: { textAlign: 'center', color: colors.primary, fontWeight: '800', fontSize: 28 },
  info: { gap: 6 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, padding: 10, borderRadius: 8, backgroundColor: colors.card },
  infoRowHighlight: { backgroundColor: colors.primaryLight },
  infoLabel: { color: colors.textSecondary, fontSize: 12 },
  infoValue: { flexShrink: 1, textAlign: 'right', color: colors.textPrimary, fontWeight: '700', fontSize: 13 },
  waiting: { textAlign: 'center', color: colors.textSecondary, fontSize: 13, lineHeight: 19, padding: 10, borderRadius: 10, backgroundColor: colors.primaryLight },
  primaryBtn: { minHeight: 48, borderRadius: 12, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', alignSelf: 'stretch' },
  primaryText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  disabled: { opacity: 0.5 },
  ghostBtn: { minHeight: 44, justifyContent: 'center', alignItems: 'center', alignSelf: 'stretch' },
  ghostText: { color: colors.textSecondary, textDecorationLine: 'underline', fontSize: 13 },
  result: { alignItems: 'center', gap: 10, padding: 18, borderRadius: 14, borderWidth: 1, backgroundColor: colors.card },
  resultTitle: { color: colors.textPrimary, fontWeight: '800', fontSize: 18 },
  resultText: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  refund: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  muted: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  link: { color: colors.primary, fontWeight: '700' },
})
