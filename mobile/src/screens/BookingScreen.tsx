import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n'
import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
  TextInput,
} from 'react-native'
import { ChevronLeft, ShieldCheck } from 'lucide-react-native'
import { colors } from '../theme/colors'
import { supabase } from '../lib/supabase'
import { apiPost } from '../lib/api'
import { dayChipLabel, formatTime, formatVnd } from '../lib/format'
import { addDaysToDateKey, vnDateKey, vnDateTime } from '../shared/datetime'
import { computePrice } from '../shared/pricing'
import {
  DURATION_OPTIONS,
  hourRange,
  isDurationAvailable,
  isHourBooked,
  isHourPast,
  type BusySlot,
} from '../shared/booking-slots'
import { describePolicy } from '../shared/cancellation'
import type { Club, Court } from '../types'

const DAYS_AHEAD = 14

const MATCH_SKILLS = ['all', 'beginner', 'intermediate', 'advanced'] as const
const MIN_PLAYERS = 2
const MAX_PLAYERS = 20

export default function BookingScreen({ route, navigation }: any) {
  const { t, lang } = useI18n()
  const { clubId, courtId } = route.params as { clubId: string; courtId: string }

  const [club, setClub] = useState<Club | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeCourtId, setActiveCourtId] = useState<string>(courtId)
  const [dateKey, setDateKey] = useState(() => vnDateKey(Date.now()))
  const [duration, setDuration] = useState<number>(1)
  const [startHour, setStartHour] = useState<number | null>(null)
  const [busy, setBusy] = useState<BusySlot[]>([])
  const [submitting, setSubmitting] = useState(false)
  // Mở kèo ghép cùng lúc đặt sân: server tính chi phí mỗi người từ tổng tiền, app chỉ gửi lựa chọn
  const [openMatch, setOpenMatch] = useState(false)
  const [matchTitle, setMatchTitle] = useState('')
  const [requiredPlayers, setRequiredPlayers] = useState(4)
  const [matchSkill, setMatchSkill] = useState<(typeof MATCH_SKILLS)[number]>('all')
  const [hostCovers, setHostCovers] = useState(false)
  // Mốc "bây giờ" cập nhật mỗi 30 giây để ô giờ vừa tới tự bị gạch khi màn hình đang mở
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('clubs')
        .select('*, courts:courts ( *, court_pricing_rules (*) )')
        .eq('id', clubId)
        .single()
      if (cancelled) return
      if (error) console.error('Lỗi tải cụm sân:', error.message)
      setClub((data as unknown as Club) ?? null)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [clubId])

  // Lịch bận của sân đang chọn (hàm công khai, chỉ trả khung giờ, không lộ người đặt)
  useEffect(() => {
    let cancelled = false
    async function loadBusy() {
      const { data } = await supabase.rpc('get_busy_slots', { p_court_ids: [activeCourtId] })
      if (!cancelled) {
        setBusy(((data ?? []) as Array<Omit<BusySlot, 'court_id'> & { court_id: string }>).map((b) => ({ ...b })))
      }
    }
    loadBusy()
    return () => {
      cancelled = true
    }
  }, [activeCourtId])

  const courts = useMemo(() => (club?.courts ?? []).filter((c) => c.is_active), [club])
  const court: Court | undefined = courts.find((c) => c.id === activeCourtId)
  const today = vnDateKey(nowMs)
  const days = useMemo(() => Array.from({ length: DAYS_AHEAD }, (_, i) => addDaysToDateKey(today, i)), [today])

  const openHour = parseInt(club?.open_time?.slice(0, 2) ?? '6', 10) || 6
  const closeHour = parseInt(club?.close_time?.slice(0, 2) ?? '23', 10) || 23
  const hours = club ? hourRange(club.open_time, club.close_time) : []

  // Đổi sân, ngày hay thời lượng có thể làm giờ đã chọn không còn hợp lệ
  const selectedValid =
    startHour !== null &&
    court !== undefined &&
    !isHourPast(dateKey, startHour, nowMs) &&
    isDurationAvailable({ busy, courtId: court.id, dateKey, startHour, duration, closeHour })

  const quote = useMemo(() => {
    if (!court || startHour === null || !selectedValid) return null
    const start = vnDateTime(dateKey, startHour)
    const end = new Date(start.getTime() + duration * 3_600_000)
    const price = computePrice({
      start,
      end,
      basePricePerHour: court.base_price_per_hour,
      depositPercentage: court.deposit_percentage,
      rules: court.court_pricing_rules ?? [],
    })
    return { start, end, ...price }
  }, [court, startHour, selectedValid, dateKey, duration])

  const acceptsBookings = Boolean(club?.accepts_online_payment || club?.accepts_manual_transfer)

  async function handleBook() {
    if (!quote || !court) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      Alert.alert(t('booking.loginTitle'), t('booking.loginText'), [
        { text: t('booking.later'), style: 'cancel' },
        { text: t('booking.login'), onPress: () => navigation.navigate('MainTabs', { screen: 'ProfileTab' }) },
      ])
      return
    }

    setSubmitting(true)
    const res = await apiPost<{ bookingId: string }>('/api/mobile/bookings', {
      courtId: court.id,
      startTime: quote.start.toISOString(),
      endTime: quote.end.toISOString(),
      ...(openMatch
        ? {
            match: {
              title: matchTitle.trim() || undefined,
              requiredPlayers,
              skillLevel: matchSkill,
              costSharingType: hostCovers ? 'host_covers' : 'split',
            },
          }
        : {}),
    })
    setSubmitting(false)

    if (!res.ok) {
      Alert.alert(t('booking.failed'), res.error)
      return
    }
    navigation.replace('BookingPayment', { bookingId: res.data.bookingId })
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }
  if (!club || !court) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('booking.notFound')}</Text>
        <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.linkText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel={t('common.back')}>
          <ChevronLeft size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t('booking.headerTitle', { club: club.name })}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {!acceptsBookings && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              {t('booking.notAccepting')}
            </Text>
          </View>
        )}

        {courts.length > 1 && (
          <>
            <Text style={styles.section}>{t('booking.chooseCourt')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {courts.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  active={c.id === activeCourtId}
                  onPress={() => {
                    setActiveCourtId(c.id)
                    setStartHour(null)
                  }}
                />
              ))}
            </ScrollView>
          </>
        )}

        <Text style={styles.section}>{t('booking.chooseDay')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {days.map((d) => (
            <Chip
              key={d}
              label={dayChipLabel(d, lang)}
              active={d === dateKey}
              onPress={() => {
                setDateKey(d)
                setStartHour(null)
              }}
            />
          ))}
        </ScrollView>

        <Text style={styles.section}>{t('booking.duration')}</Text>
        <View style={styles.chipRowWrap}>
          {DURATION_OPTIONS.map((d) => (
            <Chip key={d} label={t('booking.hours', { count: d })} active={d === duration} onPress={() => setDuration(d)} />
          ))}
        </View>

        <Text style={styles.section}>{t('booking.startHour')}</Text>
        <View style={styles.chipRowWrap}>
          {hours.map((h) => {
            const booked = isHourBooked(busy, court.id, dateKey, h)
            const past = isHourPast(dateKey, h, nowMs)
            const fits = isDurationAvailable({ busy, courtId: court.id, dateKey, startHour: h, duration, closeHour })
            const disabled = booked || past || !fits
            return (
              <Chip
                key={h}
                label={`${String(h).padStart(2, '0')}:00`}
                active={startHour === h && !disabled}
                disabled={disabled}
                onPress={() => setStartHour(h)}
              />
            )
          })}
        </View>
        {hours.length === 0 && <Text style={styles.muted}>{t('booking.noHours', { open: openHour, close: closeHour })}</Text>}

        <View style={styles.matchBox}>
          <View style={styles.matchHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.matchTitle}>{t('booking.openMatch')}</Text>
              <Text style={styles.matchHint}>{t('booking.openMatchHint')}</Text>
            </View>
            <Switch
              value={openMatch}
              onValueChange={setOpenMatch}
              trackColor={{ true: colors.primary, false: colors.cardBorder }}
              accessibilityLabel={t('booking.openMatchA11y')}
            />
          </View>

          {openMatch && (
            <>
              <Text style={styles.fieldLabel}>{t('booking.matchTitle')}</Text>
              <TextInput
                style={styles.input}
                value={matchTitle}
                onChangeText={setMatchTitle}
                maxLength={100}
                placeholder={t('booking.matchTitlePlaceholder', { court: court.name })}
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.fieldLabel}>{t('booking.players')}</Text>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => setRequiredPlayers((n) => Math.max(MIN_PLAYERS, n - 1))}
                  accessibilityLabel={t('booking.fewer')}
                >
                  <Text style={styles.stepText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.stepValue}>{requiredPlayers}</Text>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => setRequiredPlayers((n) => Math.min(MAX_PLAYERS, n + 1))}
                  accessibilityLabel={t('booking.more')}
                >
                  <Text style={styles.stepText}>+</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>{t('booking.skill')}</Text>
              <View style={styles.chipRowWrap}>
                {MATCH_SKILLS.map((s) => (
                  <Chip key={s} label={t(`skills.${s}`)} active={matchSkill === s} onPress={() => setMatchSkill(s)} />
                ))}
              </View>

              <Text style={styles.fieldLabel}>{t('booking.cost')}</Text>
              <View style={styles.chipRowWrap}>
                <Chip label={t('booking.split')} active={!hostCovers} onPress={() => setHostCovers(false)} />
                <Chip label={t('booking.hostCovers')} active={hostCovers} onPress={() => setHostCovers(true)} />
              </View>
              {quote && !hostCovers && (
                <Text style={styles.matchHint}>{t('booking.perPerson', { price: formatVnd(Math.round(quote.totalPrice / requiredPlayers)) })}</Text>
              )}
            </>
          )}
        </View>

        <View style={styles.policy}>
          <ShieldCheck size={14} color={colors.primary} />
          <Text style={styles.policyText}>{describePolicy(club.free_cancel_hours ?? 24, lang)}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {quote ? (
          <View style={styles.summary}>
            <Text style={styles.summaryLine}>
              {court.name} · {formatTime(quote.start.toISOString())} - {formatTime(quote.end.toISOString())}
            </Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>{t('booking.total')}</Text>
              <Text style={styles.priceValue}>{formatVnd(quote.totalPrice)}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.depositLabel}>{t('booking.deposit')}</Text>
              <Text style={styles.depositValue}>{formatVnd(quote.depositAmount)}</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.hint}>{t('booking.pickHint')}</Text>
        )}

        <TouchableOpacity
          style={[styles.bookBtn, (!quote || submitting || !acceptsBookings) && styles.bookBtnDisabled]}
          disabled={!quote || submitting || !acceptsBookings}
          activeOpacity={0.85}
          onPress={handleBook}
          accessibilityRole="button"
        >
          {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.bookBtnText}>{t('booking.submit')}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

function Chip({ label, active, disabled, onPress }: { label: string; active: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: Boolean(disabled) }}
      style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive, disabled && styles.chipTextDisabled]}>{label}</Text>
    </TouchableOpacity>
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
  body: { padding: 16, paddingBottom: 24 },
  section: { color: colors.textPrimary, fontWeight: '700', fontSize: 14, marginTop: 16, marginBottom: 8 },
  chipRow: { gap: 8, paddingRight: 16 },
  chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 10,
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipDisabled: { opacity: 0.35 },
  chipText: { color: colors.textSecondary, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: colors.white },
  chipTextDisabled: { textDecorationLine: 'line-through' },
  notice: { padding: 12, borderRadius: 10, backgroundColor: colors.accentLight, borderWidth: 1, borderColor: colors.accent },
  noticeText: { color: colors.accent, fontSize: 13, lineHeight: 19 },
  muted: { color: colors.textMuted, fontSize: 13, marginTop: 8 },
  linkBtn: { padding: 10 },
  linkText: { color: colors.primary, fontWeight: '700' },
  matchBox: { marginTop: 20, padding: 14, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, gap: 8 },
  matchHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  matchTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 14 },
  matchHint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  fieldLabel: { color: colors.textPrimary, fontWeight: '600', fontSize: 13, marginTop: 6 },
  input: { minHeight: 44, borderRadius: 10, paddingHorizontal: 14, color: colors.textPrimary, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder, fontSize: 14 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBtn: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder },
  stepText: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  stepValue: { color: colors.textPrimary, fontSize: 18, fontWeight: '800', minWidth: 28, textAlign: 'center' },
  policy: { flexDirection: 'row', gap: 8, marginTop: 20, padding: 12, borderRadius: 10, backgroundColor: colors.primaryLight },
  policyText: { flex: 1, color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.cardBorder, backgroundColor: colors.surface, gap: 12 },
  summary: { gap: 4 },
  summaryLine: { color: colors.textPrimary, fontWeight: '700', fontSize: 14 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  priceLabel: { color: colors.textSecondary, fontSize: 13 },
  priceValue: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  depositLabel: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  depositValue: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  hint: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  bookBtn: { minHeight: 48, borderRadius: 12, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  bookBtnDisabled: { opacity: 0.45 },
  bookBtnText: { color: colors.white, fontWeight: '800', fontSize: 15 },
})
