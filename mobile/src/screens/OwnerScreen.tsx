import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Linking, RefreshControl, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { CalendarCheck, CheckCircle2, Clock, Phone, RotateCcw, XCircle } from 'lucide-react-native'
import { colors } from '../theme/colors'
import { supabase } from '../lib/supabase'
import { apiPost } from '../lib/api'
import { formatDate, formatTime, formatVnd } from '../lib/format'
import { useI18n } from '../i18n'
import OwnerVenuesPanel from './OwnerVenuesPanel'
import OwnerRecurringPanel from './OwnerRecurringPanel'
import OwnerStatsPanel from './OwnerStatsPanel'
import ReputationBadge from '../components/ReputationBadge'
import { fetchReputations, type Reputation } from '../lib/reputation'

interface OwnerBooking {
  id: string
  user_id: string
  no_show_at: string | null
  status: string
  start_time: string
  end_time: string
  total_price: number
  deposit_amount: number
  refund_status: string
  refund_amount: number
  court: { name: string; club: { name: string; owner_id: string } | null } | null
  profile: { full_name: string | null } | null
  payments: Array<{ status: string; metadata: { channel?: string; claimed_at?: string } | null }> | null
}

type Contacts = Record<string, { full_name: string; phone_number: string | null }>
type Section = { key: 'pending' | 'refunds' | 'upcoming'; data: OwnerBooking[] }

const SELECT = `
  id, user_id, no_show_at, status, start_time, end_time, total_price, deposit_amount, refund_status, refund_amount,
  court:courts!inner ( name, club:clubs!inner ( name, owner_id ) ),
  profile:profiles ( full_name ),
  payments ( status, metadata )
`

/**
 * Màn hình của chủ sân, gồm hai phần: đơn đặt (xác nhận cọc, hủy, hoàn cọc) và sân & giá (tạo cụm sân, sân con, khung giá).
 */
export default function OwnerScreen() {
  const { t } = useI18n()
  const [tab, setTab] = useState<'bookings' | 'recurring' | 'stats' | 'venues'>('bookings')

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('owner.title')}</Text>
        <Text style={styles.subtitle}>{t('owner.subtitle')}</Text>
        <View style={styles.segments}>
          {(['bookings', 'recurring', 'stats', 'venues'] as const).map((key) => (
            <TouchableOpacity
              key={key}
              style={[styles.segment, tab === key && styles.segmentOn]}
              onPress={() => setTab(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === key }}
            >
              <Text style={[styles.segmentText, tab === key && styles.segmentTextOn]} numberOfLines={1}>
                {t(key === 'bookings' ? 'owner.segBookings' : key === 'recurring' ? 'owner.segRecurring' : key === 'stats' ? 'owner.segStats' : 'owner.segVenues')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {tab === 'bookings' ? <BookingsPanel /> : tab === 'recurring' ? <OwnerRecurringPanel /> : tab === 'stats' ? <OwnerStatsPanel /> : <OwnerVenuesPanel />}
    </View>
  )
}

/**
 * Phần đơn đặt: đơn chờ xác nhận cọc, khoản cần hoàn cọc và lịch sắp tới. Đọc trực tiếp từ Supabase (RLS cho
 * chủ sân xem đơn của cụm sân mình); mọi thao tác ghi đi qua API của máy chủ web, nơi kiểm tra quyền và áp quy tắc hoàn cọc.
 */
function BookingsPanel() {
  const { t } = useI18n()
  const [rows, setRows] = useState<OwnerBooking[]>([])
  const [contacts, setContacts] = useState<Contacts>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reputations, setReputations] = useState<Record<string, Reputation>>({})

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setRows([])
        return
      }
      const { data, error } = await supabase
        .from('bookings')
        .select(SELECT)
        .eq('court.club.owner_id', user.id)
        .or('status.in.(pending,confirmed),refund_status.eq.pending')
        .order('start_time', { ascending: true })
        .limit(100)
      if (error) throw error
      const list = (data ?? []) as unknown as OwnerBooking[]
      setRows(list)
      setReputations(await fetchReputations(list.map((b) => b.user_id)))

      if (list.length > 0) {
        const { data: info } = await supabase.rpc('get_booking_contacts', { p_booking_ids: list.map((b) => b.id) })
        const map: Contacts = {}
        for (const c of (info ?? []) as Array<{ booking_id: string; full_name: string; phone_number: string | null }>) {
          map[c.booking_id] = { full_name: c.full_name, phone_number: c.phone_number }
        }
        setContacts(map)
      }
    } catch (err) {
      console.warn('Không tải được đơn của chủ sân:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])
  // Mở lại tab thì tải mới: đơn có thể vừa được xác nhận ở nơi khác
  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  async function run(id: string, path: string, body?: unknown) {
    setBusyId(id)
    const res = await apiPost<unknown>(path, body)
    setBusyId(null)
    if (!res.ok) {
      Alert.alert(t('owner.failed'), res.error)
      return
    }
    load()
  }

  const statusPath = (b: OwnerBooking) => `/api/mobile/owner/bookings/${b.id}/status`

  function cancel(b: OwnerBooking) {
    const paid = b.status === 'confirmed' ? Number(b.deposit_amount) : 0
    Alert.alert(t('owner.cancelTitle'), paid > 0 ? t('owner.cancelRefund', { amount: formatVnd(paid) }) : t('owner.cancelFree'), [
      { text: t('payment.keep'), style: 'cancel' },
      { text: t('payment.cancelConfirm'), style: 'destructive', onPress: () => run(b.id, statusPath(b), { status: 'cancelled' }) },
    ])
  }

  function noShow(b: OwnerBooking) {
    const send = () => run(b.id, `/api/mobile/owner/bookings/${b.id}/no-show`, { noShow: !b.no_show_at })
    if (b.no_show_at) return send()
    Alert.alert(t('owner.noShowConfirmTitle'), t('owner.noShowConfirmText'), [
      { text: t('owner.notYet'), style: 'cancel' },
      { text: t('owner.noShowConfirm'), style: 'destructive', onPress: send },
    ])
  }

  function refunded(b: OwnerBooking) {
    const name = contacts[b.id]?.full_name ?? b.profile?.full_name ?? ''
    Alert.alert(t('owner.refundTitle'), t('owner.refundText', { amount: formatVnd(b.refund_amount), name }), [
      { text: t('owner.notYet'), style: 'cancel' },
      { text: t('owner.refundConfirm'), onPress: () => run(b.id, `/api/mobile/owner/bookings/${b.id}/refunded`) },
    ])
  }

  const now = Date.now()
  const sections = (
    [
      { key: 'pending', data: rows.filter((b) => b.status === 'pending') },
      { key: 'refunds', data: rows.filter((b) => b.refund_status === 'pending') },
      { key: 'upcoming', data: rows.filter((b) => b.status === 'confirmed' && new Date(b.end_time).getTime() > now - 12 * 3_600_000) },
    ] as Section[]
  ).filter((s) => s.data.length > 0)

  function renderItem({ item: b, section }: { item: OwnerBooking; section: Section }) {
    const busy = busyId === b.id
    const latest = b.payments?.length ? b.payments[b.payments.length - 1] : null
    const manual = latest?.metadata?.channel === 'manual'
    const claimed = Boolean(latest?.metadata?.claimed_at)
    const contact = contacts[b.id]
    const started = new Date(b.start_time).getTime() <= now

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.court}>
              {b.court?.name} · {b.court?.club?.name}
            </Text>
            <View style={styles.whenRow}>
              <Clock size={12} color={colors.textMuted} />
              <Text style={styles.when}>
                {formatTime(b.start_time)} - {formatTime(b.end_time)} · {formatDate(b.start_time)}
              </Text>
            </View>
            <Text style={styles.customer}>{contact?.full_name ?? b.profile?.full_name ?? t('owner.customer')}</Text>
            <ReputationBadge reputation={reputations[b.user_id]} />
          </View>
          {contact?.phone_number ? (
            <TouchableOpacity
              style={styles.callBtn}
              onPress={() => Linking.openURL(`tel:${contact.phone_number}`)}
              accessibilityRole="button"
              accessibilityLabel={t('owner.call', { phone: contact.phone_number })}
            >
              <Phone size={16} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.moneyRow}>
          <Text style={styles.money}>
            {t('myBookings.deposit')}: {formatVnd(b.deposit_amount)}
          </Text>
          {section.key === 'pending' && manual && (
            <Text style={[styles.badge, claimed ? styles.badgeOk : styles.badgeWait]}>{claimed ? t('owner.claimed') : t('owner.notClaimed')}</Text>
          )}
          {section.key === 'refunds' && <Text style={[styles.badge, styles.badgeWait]}>{t('owner.refundDue', { amount: formatVnd(b.refund_amount) })}</Text>}
        </View>

        <View style={styles.actions}>
          {section.key === 'pending' && (
            <>
              <ActionButton busy={busy} kind="primary" label={t('owner.confirm')} icon={<CheckCircle2 size={16} color={colors.white} />} onPress={() => run(b.id, statusPath(b), { status: 'confirmed' })} />
              <ActionButton busy={busy} kind="danger" label={t('owner.reject')} icon={<XCircle size={16} color={colors.danger} />} onPress={() => cancel(b)} />
            </>
          )}
          {section.key === 'upcoming' && (
            <>
              {started && (
                <ActionButton busy={busy} kind="danger" label={b.no_show_at ? t('owner.undoNoShow') : t('owner.noShow')} icon={<XCircle size={16} color={colors.danger} />} onPress={() => noShow(b)} />
              )}
              {started && !b.no_show_at && (
                <ActionButton busy={busy} kind="primary" label={t('owner.complete')} icon={<CalendarCheck size={16} color={colors.white} />} onPress={() => run(b.id, statusPath(b), { status: 'completed' })} />
              )}
              <ActionButton busy={busy} kind="danger" label={t('owner.cancel')} icon={<XCircle size={16} color={colors.danger} />} onPress={() => cancel(b)} />
            </>
          )}
          {section.key === 'refunds' && (
            <ActionButton busy={busy} kind="primary" label={t('owner.markRefunded')} icon={<RotateCcw size={16} color={colors.white} />} onPress={() => refunded(b)} />
          )}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.flex}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(b) => b.id}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionTitle}>
              {t(`owner.section.${section.key}`)} ({section.data.length})
            </Text>
          )}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                load()
              }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <CalendarCheck size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>{t('owner.emptyTitle')}</Text>
              <Text style={styles.emptyText}>{t('owner.emptyText')}</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

function ActionButton({ busy, kind, label, icon, onPress }: { busy: boolean; kind: 'primary' | 'danger'; label: string; icon: React.ReactNode; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[kind === 'primary' ? styles.primary : styles.danger, busy && styles.disabled]}
      disabled={busy}
      onPress={onPress}
      accessibilityRole="button"
    >
      {busy ? (
        <ActivityIndicator color={kind === 'primary' ? colors.white : colors.danger} />
      ) : (
        <>
          {icon}
          <Text style={kind === 'primary' ? styles.primaryText : styles.dangerText}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  segments: { flexDirection: 'row', gap: 8, marginTop: 10 },
  segment: { flex: 1, minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  segmentText: { color: colors.textSecondary, fontWeight: '700', fontSize: 13 },
  segmentTextOn: { color: colors.primary },
  header: { padding: 16, paddingBottom: 8 },
  title: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
  subtitle: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  list: { padding: 16, paddingTop: 4, paddingBottom: 40 },
  sectionTitle: { color: colors.textPrimary, fontWeight: '800', fontSize: 14, marginTop: 10, marginBottom: 6 },
  card: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, padding: 14, gap: 10, marginBottom: 10 },
  cardTop: { flexDirection: 'row', gap: 10 },
  court: { color: colors.textPrimary, fontWeight: '700', fontSize: 14 },
  whenRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  when: { color: colors.textSecondary, fontSize: 12 },
  customer: { color: colors.textPrimary, fontSize: 13, marginTop: 4, fontWeight: '600' },
  callBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  moneyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  money: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  badgeOk: { color: colors.primary, backgroundColor: colors.primaryLight },
  badgeWait: { color: colors.accent, backgroundColor: colors.accentLight },
  actions: { flexDirection: 'row', gap: 8 },
  primary: { flex: 1, minHeight: 44, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  primaryText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  danger: { flex: 1, minHeight: 44, borderRadius: 10, backgroundColor: colors.dangerLight, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  dangerText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  disabled: { opacity: 0.5 },
  emptyTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
  emptyText: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
})
