import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { ChevronLeft, Hourglass, Repeat } from 'lucide-react-native'
import { colors } from '../theme/colors'
import { supabase } from '../lib/supabase'
import { apiDelete, apiPost } from '../lib/api'
import { formatDate, formatTime } from '../lib/format'
import { useI18n, type MessageKey } from '../i18n'

interface CourtOption {
  id: string
  name: string
  club: { name: string } | null
}

interface SeriesRow {
  id: string
  weekday: number
  start_time: string
  end_time: string
  ends_on: string | null
  status: 'pending' | 'active'
  court: { name: string; club: { name: string } | null } | null
}

interface WaitRow {
  id: string
  start_time: string
  end_time: string
  status: 'waiting' | 'notified'
  court: { name: string; club: { name: string } | null } | null
}

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0]
const START_HOURS = Array.from({ length: 17 }, (_, i) => 6 + i) // 06:00 - 22:00
const DURATIONS = [1, 1.5, 2, 2.5, 3]

const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

/** Lịch cố định hằng tuần ("thứ 3 hằng tuần 19h") và các khung giờ đang chờ. Đọc qua RLS, ghi qua API của máy chủ. */
export default function RecurringScreen({ route, navigation }: any) {
  const { t } = useI18n()
  const [courts, setCourts] = useState<CourtOption[]>([])
  const [series, setSeries] = useState<SeriesRow[]>([])
  const [waits, setWaits] = useState<WaitRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [courtId, setCourtId] = useState<string>(route?.params?.courtId ?? '')
  const [weekday, setWeekday] = useState(2)
  const [startHour, setStartHour] = useState(19)
  const [duration, setDuration] = useState(1)
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [c, s, w] = await Promise.all([
        supabase.from('courts').select('id, name, club:clubs!inner ( name, is_active )').eq('is_active', true).eq('club.is_active', true).order('name').limit(300),
        supabase
          .from('recurring_bookings')
          .select('id, weekday, start_time, end_time, ends_on, status, court:courts ( name, club:clubs ( name ) )')
          .eq('user_id', user.id)
          .in('status', ['pending', 'active'])
          .order('created_at', { ascending: false }),
        supabase
          .from('slot_waitlist')
          .select('id, start_time, end_time, status, court:courts ( name, club:clubs ( name ) )')
          .eq('user_id', user.id)
          .in('status', ['waiting', 'notified'])
          .order('start_time'),
      ])
      setCourts((c.data ?? []) as unknown as CourtOption[])
      setSeries((s.data ?? []) as unknown as SeriesRow[])
      setWaits((w.data ?? []) as unknown as WaitRow[])
    } finally {
      setLoading(false)
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? courts.filter((c) => `${c.club?.name ?? ''} ${c.name}`.toLowerCase().includes(q)) : courts
    // Luôn giữ sân đang chọn trong danh sách
    const picked = courts.find((c) => c.id === courtId)
    const top = list.slice(0, 20)
    return picked && !top.some((c) => c.id === picked.id) ? [picked, ...top.slice(0, 19)] : top
  }, [courts, query, courtId])

  async function submit() {
    if (!courtId) return Alert.alert(t('common.notice'), t('recurring.chooseCourt'))
    const startMin = startHour * 60
    const endMin = startMin + duration * 60
    if (endMin > 24 * 60) return Alert.alert(t('common.notice'), t('recurring.tooLate'))
    setBusy('form')
    const res = await apiPost<unknown>('/api/mobile/recurring', { courtId, weekday, startTime: hhmm(startMin), endTime: hhmm(endMin), note: note.trim() || undefined })
    setBusy(null)
    if (!res.ok) return Alert.alert(t('common.error'), res.error)
    Alert.alert(t('recurring.requestedTitle'), t('recurring.requestedText'))
    setNote('')
    load()
  }

  function endSeries(id: string) {
    Alert.alert(t('recurring.endTitle'), t('recurring.endText'), [
      { text: t('recurring.endKeep'), style: 'cancel' },
      {
        text: t('recurring.endConfirm'),
        style: 'destructive',
        onPress: async () => {
          setBusy(id)
          const res = await apiDelete<unknown>(`/api/mobile/recurring/${id}`)
          setBusy(null)
          if (!res.ok) return Alert.alert(t('common.error'), res.error)
          load()
        },
      },
    ])
  }

  async function leaveWait(id: string) {
    setBusy(id)
    const res = await apiDelete<unknown>(`/api/mobile/waitlist/${id}`)
    setBusy(null)
    if (!res.ok) return Alert.alert(t('common.error'), res.error)
    load()
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityRole="button">
          <ChevronLeft size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t('recurring.title')}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Repeat size={16} color={colors.primary} />
            <Text style={styles.cardTitle}>{t('recurring.formTitle')}</Text>
          </View>
          <Text style={styles.hint}>{t('recurring.formHint')}</Text>

          <Text style={styles.label}>{t('recurring.court')}</Text>
          <TextInput style={styles.input} value={query} onChangeText={setQuery} placeholder={t('recurring.search')} placeholderTextColor={colors.textMuted} />
          {filtered.map((c) => (
            <TouchableOpacity key={c.id} style={[styles.option, courtId === c.id && styles.optionOn]} onPress={() => setCourtId(c.id)} accessibilityRole="radio" accessibilityState={{ selected: courtId === c.id }}>
              <Text style={[styles.optionText, courtId === c.id && styles.optionTextOn]} numberOfLines={1}>
                {c.club?.name} — {c.name}
              </Text>
            </TouchableOpacity>
          ))}

          <Text style={styles.label}>{t('recurring.weekday')}</Text>
          <View style={styles.chips}>
            {WEEKDAYS.map((d) => (
              <TouchableOpacity key={d} style={[styles.chip, weekday === d && styles.chipOn]} onPress={() => setWeekday(d)} accessibilityRole="button" accessibilityState={{ selected: weekday === d }}>
                <Text style={[styles.chipText, weekday === d && styles.chipTextOn]}>{t(`recurring.short${d}` as MessageKey)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>{t('recurring.from')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {START_HOURS.map((h) => (
              <TouchableOpacity key={h} style={[styles.chip, startHour === h && styles.chipOn]} onPress={() => setStartHour(h)} accessibilityRole="button" accessibilityState={{ selected: startHour === h }}>
                <Text style={[styles.chipText, startHour === h && styles.chipTextOn]}>{hhmm(h * 60)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>{t('recurring.duration')}</Text>
          <View style={styles.chips}>
            {DURATIONS.map((d) => (
              <TouchableOpacity key={d} style={[styles.chip, duration === d && styles.chipOn]} onPress={() => setDuration(d)} accessibilityRole="button" accessibilityState={{ selected: duration === d }}>
                <Text style={[styles.chipText, duration === d && styles.chipTextOn]}>{t('recurring.hours', { count: d })}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder={t('recurring.note')} placeholderTextColor={colors.textMuted} maxLength={500} />
          <Text style={styles.hint}>{t('recurring.approvalHint')}</Text>
          <TouchableOpacity style={[styles.submit, (busy === 'form' || !courtId) && styles.disabled]} disabled={busy === 'form' || !courtId} onPress={submit} accessibilityRole="button">
            {busy === 'form' ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>{t('recurring.submit')}</Text>}
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
        ) : (
          <>
            <Text style={styles.section}>{t('recurring.mySeries')}</Text>
            {series.length === 0 ? (
              <Text style={styles.muted}>{t('recurring.noSeries')}</Text>
            ) : (
              series.map((s) => (
                <View key={s.id} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowMain}>
                      {t('recurring.seriesLabel', { day: t(`recurring.day${s.weekday}` as MessageKey), start: s.start_time.slice(0, 5), end: s.end_time.slice(0, 5) })}
                    </Text>
                    <Text style={styles.muted}>
                      {s.court?.club?.name} · {s.court?.name}
                      {s.ends_on ? ` · ${t('recurring.until', { date: s.ends_on.split('-').reverse().join('/') })}` : ''}
                    </Text>
                    <Text style={[styles.status, s.status === 'active' ? styles.statusOk : styles.statusWait]}>{s.status === 'active' ? t('recurring.statusActive') : t('recurring.statusPending')}</Text>
                  </View>
                  <TouchableOpacity disabled={busy === s.id} onPress={() => endSeries(s.id)} style={styles.linkBtn} accessibilityRole="button">
                    <Text style={styles.dangerText}>{s.status === 'active' ? t('recurring.end') : t('recurring.withdraw')}</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}

            <View style={styles.cardHead}>
              <Hourglass size={16} color={colors.accent} />
              <Text style={styles.section}>{t('recurring.waitlist')}</Text>
            </View>
            {waits.length === 0 ? (
              <Text style={styles.muted}>{t('recurring.noWaits')}</Text>
            ) : (
              waits.map((w) => (
                <View key={w.id} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowMain}>
                      {formatTime(w.start_time)} - {formatTime(w.end_time)} · {formatDate(w.start_time)}
                    </Text>
                    <Text style={styles.muted}>
                      {w.court?.club?.name} · {w.court?.name}
                    </Text>
                    <Text style={[styles.status, w.status === 'notified' ? styles.statusOk : styles.statusWait]}>{w.status === 'notified' ? t('recurring.waitNotified') : t('recurring.waitWaiting')}</Text>
                  </View>
                  <TouchableOpacity disabled={busy === w.id} onPress={() => leaveWait(w.id)} style={styles.linkBtn} accessibilityRole="button">
                    <Text style={styles.dangerText}>{t('recurring.waitLeave')}</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerBar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.cardBorder, backgroundColor: colors.surface },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, color: colors.textPrimary, fontWeight: '800', fontSize: 16, textAlign: 'center' },
  body: { padding: 16, paddingBottom: 48, gap: 6 },
  card: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, padding: 14, gap: 8 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  cardTitle: { color: colors.textPrimary, fontWeight: '800', fontSize: 15 },
  hint: { color: colors.textSecondary, fontSize: 12, lineHeight: 17 },
  label: { color: colors.textPrimary, fontWeight: '700', fontSize: 13, marginTop: 6 },
  input: { minHeight: 44, borderRadius: 10, paddingHorizontal: 12, color: colors.textPrimary, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder, fontSize: 14 },
  option: { minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: colors.cardBorder, paddingHorizontal: 12, justifyContent: 'center' },
  optionOn: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  optionText: { color: colors.textSecondary, fontSize: 13 },
  optionTextOn: { color: colors.primary, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minWidth: 44, minHeight: 38, paddingHorizontal: 12, borderRadius: 19, borderWidth: 1, borderColor: colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontWeight: '700', fontSize: 12 },
  chipTextOn: { color: colors.primary },
  submit: { minHeight: 48, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  submitText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  disabled: { opacity: 0.5 },
  section: { color: colors.textPrimary, fontWeight: '800', fontSize: 15, marginTop: 14, marginBottom: 4 },
  muted: { color: colors.textMuted, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, padding: 12, marginBottom: 8 },
  rowMain: { color: colors.textPrimary, fontWeight: '700', fontSize: 13 },
  status: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  statusOk: { color: colors.primary },
  statusWait: { color: colors.accent },
  linkBtn: { minHeight: 40, paddingHorizontal: 8, justifyContent: 'center' },
  dangerText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
})
