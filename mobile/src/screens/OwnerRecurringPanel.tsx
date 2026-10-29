import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { CheckCircle2, Repeat, XCircle } from 'lucide-react-native'
import { colors } from '../theme/colors'
import { supabase } from '../lib/supabase'
import { apiPost } from '../lib/api'
import { fetchReputations, type Reputation } from '../lib/reputation'
import ReputationBadge from '../components/ReputationBadge'
import { useI18n, type MessageKey } from '../i18n'

interface Series {
  id: string
  user_id: string
  weekday: number
  start_time: string
  end_time: string
  ends_on: string | null
  note: string | null
  status: 'pending' | 'active'
  court: { name: string; club: { name: string; owner_id: string } | null } | null
}

const SELECT = 'id, user_id, weekday, start_time, end_time, ends_on, note, status, court:courts!inner ( name, club:clubs!inner ( name, owner_id ) )'

/** Chủ sân duyệt / từ chối / kết thúc lịch cố định hằng tuần của khách. Đọc qua RLS, ghi qua API của máy chủ. */
export default function OwnerRecurringPanel() {
  const { t } = useI18n()
  const [rows, setRows] = useState<Series[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [reputations, setReputations] = useState<Record<string, Reputation>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return setRows([])
      const { data, error } = await supabase
        .from('recurring_bookings')
        .select(SELECT)
        .eq('court.club.owner_id', user.id)
        .in('status', ['pending', 'active'])
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      const list = (data ?? []) as unknown as Series[]
      setRows(list)

      const ids = [...new Set(list.map((r) => r.user_id))]
      if (ids.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids)
        setNames(Object.fromEntries((profiles ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name])))
        setReputations(await fetchReputations(ids))
      }
    } catch (err) {
      console.warn('Không tải được lịch cố định:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])
  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  async function decide(id: string, decision: 'approve' | 'reject' | 'end') {
    setBusyId(id)
    const res = await apiPost<unknown>(`/api/mobile/owner/recurring/${id}`, { decision })
    setBusyId(null)
    if (!res.ok) return Alert.alert(t('owner.failed'), res.error)
    load()
  }

  function end(id: string) {
    Alert.alert(t('owner.recurring.endTitle'), t('owner.recurring.endText'), [
      { text: t('owner.notYet'), style: 'cancel' },
      { text: t('owner.recurring.end'), style: 'destructive', onPress: () => decide(id, 'end') },
    ])
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  const pending = rows.filter((r) => r.status === 'pending')
  const active = rows.filter((r) => r.status === 'active')

  const card = (s: Series) => (
    <View key={s.id} style={styles.card}>
      <Text style={styles.title}>
        {t('recurring.seriesLabel', { day: t(`recurring.day${s.weekday}` as MessageKey), start: s.start_time.slice(0, 5), end: s.end_time.slice(0, 5) })}
      </Text>
      <Text style={styles.sub}>
        {s.court?.club?.name} · {s.court?.name}
        {s.ends_on ? ` · ${t('recurring.until', { date: s.ends_on.split('-').reverse().join('/') })}` : ''}
      </Text>
      <Text style={styles.customer}>{names[s.user_id] ?? t('owner.customer')}</Text>
      <ReputationBadge reputation={reputations[s.user_id]} />
      {s.note ? <Text style={styles.note}>{`"${s.note}"`}</Text> : null}
      <View style={styles.actions}>
        {s.status === 'pending' ? (
          <>
            <TouchableOpacity style={[styles.primary, busyId === s.id && styles.disabled]} disabled={busyId === s.id} onPress={() => decide(s.id, 'approve')} accessibilityRole="button">
              <CheckCircle2 size={16} color={colors.white} />
              <Text style={styles.primaryText}>{t('owner.recurring.approve')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.danger, busyId === s.id && styles.disabled]} disabled={busyId === s.id} onPress={() => decide(s.id, 'reject')} accessibilityRole="button">
              <XCircle size={16} color={colors.danger} />
              <Text style={styles.dangerText}>{t('owner.recurring.reject')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={[styles.danger, busyId === s.id && styles.disabled]} disabled={busyId === s.id} onPress={() => end(s.id)} accessibilityRole="button">
            <Text style={styles.dangerText}>{t('owner.recurring.end')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )

  return (
    <ScrollView
      contentContainerStyle={styles.list}
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
    >
      {rows.length === 0 ? (
        <View style={styles.center}>
          <Repeat size={48} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>{t('owner.recurring.emptyTitle')}</Text>
          <Text style={styles.emptyText}>{t('owner.recurring.emptyText')}</Text>
        </View>
      ) : (
        <>
          {pending.length > 0 && <Text style={styles.section}>{`${t('owner.recurring.pending')} (${pending.length})`}</Text>}
          {pending.map(card)}
          {active.length > 0 && <Text style={styles.section}>{`${t('owner.recurring.active')} (${active.length})`}</Text>}
          {active.map(card)}
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  list: { padding: 16, paddingTop: 4, paddingBottom: 40 },
  section: { color: colors.textPrimary, fontWeight: '800', fontSize: 14, marginTop: 10, marginBottom: 6 },
  card: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, padding: 14, gap: 4, marginBottom: 10 },
  title: { color: colors.textPrimary, fontWeight: '800', fontSize: 14 },
  sub: { color: colors.textSecondary, fontSize: 12 },
  customer: { color: colors.textPrimary, fontSize: 13, marginTop: 4, fontWeight: '600' },
  note: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  primary: { flex: 1, minHeight: 44, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  primaryText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  danger: { flex: 1, minHeight: 44, borderRadius: 10, backgroundColor: colors.dangerLight, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  dangerText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  disabled: { opacity: 0.5 },
  emptyTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
  emptyText: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
})
