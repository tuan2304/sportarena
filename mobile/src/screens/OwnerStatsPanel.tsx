import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colors } from '../theme/colors'
import { apiGet } from '../lib/api'
import { formatVnd } from '../lib/format'
import { useI18n, type MessageKey } from '../i18n'

interface Stats {
  revenue: number
  bookings: number
  cancelled: number
  noShows: number
  cancelRate: number
  bookedHours: number
  availableHours: number
  occupancy: number
  averageBooking: number
  byCourt: Array<{ courtId: string; name: string; clubName: string; revenue: number; bookings: number; occupancy: number }>
  peaks: Array<{ weekday: number; hour: number; hours: number }>
  peakHour: number | null
}

interface Response {
  stats: Stats
  truncated: boolean
}

const RANGES = [7, 30, 90] as const
const pct = (n: number) => `${Math.round(n * 100)}%`
const one = (n: number) => String(Math.round(n * 10) / 10)

/** Thống kê của chủ sân: doanh thu, lấp đầy, giờ cao điểm và hiệu quả từng sân (số liệu do máy chủ tính, cùng nguồn với web). */
export default function OwnerStatsPanel() {
  const { t } = useI18n()
  const [days, setDays] = useState<(typeof RANGES)[number]>(30)
  const [data, setData] = useState<Response | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const res = await apiGet<Response>(`/api/mobile/owner/analytics?days=${days}`)
    if (res.ok) {
      setData(res.data)
      setError(null)
    } else {
      setError(res.error)
    }
    setLoading(false)
    setRefreshing(false)
  }, [days])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  const s = data?.stats
  const kpis = s
    ? [
        { label: t('owner.stats.revenue'), value: formatVnd(s.revenue), hint: t('owner.stats.revenueHint') },
        { label: t('owner.stats.bookings'), value: String(s.bookings), hint: t('owner.stats.bookingsHint', { avg: formatVnd(s.averageBooking) }) },
        { label: t('owner.stats.occupancy'), value: pct(s.occupancy), hint: t('owner.stats.occupancyHint', { booked: one(s.bookedHours), available: one(s.availableHours) }) },
        { label: t('owner.stats.cancelRate'), value: pct(s.cancelRate), hint: t('owner.stats.cancelHint', { cancelled: s.cancelled, noShows: s.noShows }) },
      ]
    : []

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
      <View style={styles.chips}>
        {RANGES.map((d) => (
          <TouchableOpacity key={d} style={[styles.chip, days === d && styles.chipOn]} onPress={() => setDays(d)} accessibilityRole="button" accessibilityState={{ selected: days === d }}>
            <Text style={[styles.chipText, days === d && styles.chipTextOn]}>{t('owner.stats.range', { days: d })}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 32 }} />
      ) : error || !s ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <>
          {data?.truncated && <Text style={styles.warn}>{t('owner.stats.truncated')}</Text>}
          <View style={styles.grid}>
            {kpis.map((k) => (
              <View key={k.label} style={styles.kpi}>
                <Text style={styles.kpiLabel}>{k.label}</Text>
                <Text style={styles.kpiValue}>{k.value}</Text>
                <Text style={styles.kpiHint}>{k.hint}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.section}>{t('owner.stats.peakTitle')}</Text>
          {s.peaks.length === 0 ? (
            <Text style={styles.muted}>{t('owner.stats.noData')}</Text>
          ) : (
            <View style={styles.card}>
              {s.peaks.map((p, i) => (
                <View key={`${p.weekday}-${p.hour}`} style={styles.row}>
                  <Text style={styles.rowMain}>
                    {i + 1}. {t(`recurring.day${p.weekday}` as MessageKey)}, {String(p.hour).padStart(2, '0')}:00
                  </Text>
                  <Text style={styles.muted}>{t('owner.stats.peakHours', { hours: one(p.hours) })}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.section}>{t('owner.stats.byCourt')}</Text>
          {s.byCourt.length === 0 ? (
            <Text style={styles.muted}>{t('owner.stats.noData')}</Text>
          ) : (
            <View style={styles.card}>
              {s.byCourt.map((c) => (
                <View key={c.courtId} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowMain}>{c.name}</Text>
                    <Text style={styles.muted}>{c.clubName}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.rowMain}>{formatVnd(c.revenue)}</Text>
                    <Text style={styles.muted}>{t('owner.stats.courtLine', { bookings: c.bookings, occupancy: pct(c.occupancy) })}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
          <Text style={styles.footnote}>{t('owner.stats.definition')}</Text>
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingTop: 4, paddingBottom: 40 },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 14, minHeight: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontWeight: '700', fontSize: 12 },
  chipTextOn: { color: colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpi: { width: '48%', flexGrow: 1, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, padding: 12, gap: 2 },
  kpiLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  kpiValue: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
  kpiHint: { color: colors.textMuted, fontSize: 11 },
  section: { color: colors.textPrimary, fontWeight: '800', fontSize: 14, marginTop: 16, marginBottom: 6 },
  card: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, padding: 12, gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rowMain: { color: colors.textPrimary, fontWeight: '700', fontSize: 13 },
  muted: { color: colors.textMuted, fontSize: 12 },
  error: { color: colors.danger, textAlign: 'center', marginTop: 24 },
  warn: { color: colors.accent, fontSize: 12, marginBottom: 8 },
  footnote: { color: colors.textMuted, fontSize: 11, marginTop: 16, lineHeight: 16 },
})
