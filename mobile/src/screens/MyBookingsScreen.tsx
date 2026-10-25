import { useI18n } from '../i18n'
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native'
import { colors } from '../theme/colors'
import { supabase } from '../lib/supabase'
import { Booking } from '../types'
import { Calendar, Clock, MapPin, CheckCircle, AlertCircle, XCircle } from 'lucide-react-native'
import { apiPost } from '../lib/api'
import { formatDate, formatTime as formatVnTime, formatVnd } from '../lib/format'
import { decideCancellation, describeOutcome } from '../shared/cancellation'

export default function MyBookingsScreen({ navigation }: any) {
  const { t, lang } = useI18n()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function loadBookings() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setBookings([])
        return
      }

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          court:courts (
            name,
            sport_type,
            club:clubs (
              name,
              address,
              district,
              city,
              free_cancel_hours
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setBookings(data as any || [])
    } catch (err: any) {
      console.error('Lỗi tải lịch đặt sân:', err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadBookings()
  }, [])

  // Giờ hiển thị theo giờ Việt Nam, không theo múi giờ của điện thoại
  function formatTime(iso: string) {
    return `${formatVnTime(iso)} • ${formatDate(iso)}`
  }

  function handleCancel(item: Booking) {
    const decision = decideCancellation({
      status: item.status,
      start: new Date(item.start_time),
      now: new Date(),
      paidAmount: item.status === 'confirmed' ? Number(item.deposit_amount) : 0,
      freeCancelHours: item.court?.club?.free_cancel_hours ?? 24,
      by: 'player',
    })
    Alert.alert(t('payment.cancelTitle'), describeOutcome(decision, formatVnd, lang), [
      { text: t('payment.keep'), style: 'cancel' },
      {
        text: t('payment.cancelConfirm'),
        style: 'destructive',
        onPress: async () => {
          const res = await apiPost(`/api/mobile/bookings/${item.id}/cancel`)
          if (!res.ok) {
            Alert.alert(t('payment.cancelFailed'), res.error)
            return
          }
          loadBookings()
        },
      },
    ])
  }

  function renderBookingItem({ item }: { item: Booking }) {
    const court = item.court
    const club = court?.club
    const isConfirmed = item.status === 'confirmed'
    const isPending = item.status === 'pending'
    const isCancelled = item.status === 'cancelled'
    const canCancel = (isConfirmed || isPending) && new Date(item.start_time).getTime() > Date.now()
    const refundLabel =
      item.refund_status === 'pending'
        ? t('payment.refundPending', { amount: formatVnd(item.refund_amount) })
        : item.refund_status === 'refunded'
          ? t('payment.refundDone', { amount: formatVnd(item.refund_amount) })
          : null

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.courtName}>{court?.name || t('myBookings.courtFallback')}</Text>
            <Text style={styles.clubName}>{club?.name || t('myBookings.clubFallback')}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              isConfirmed ? styles.statusConfirmed : styles.statusPending,
            ]}
          >
            {isConfirmed ? (
              <CheckCircle size={12} color={colors.success} />
            ) : isCancelled ? (
              <XCircle size={12} color={colors.danger} />
            ) : (
              <AlertCircle size={12} color={colors.warning} />
            )}
            <Text
              style={[
                styles.statusText,
                { color: isConfirmed ? colors.success : isCancelled ? colors.danger : colors.warning },
              ]}
            >
              {isConfirmed ? t('myBookings.paid') : isCancelled ? t('myBookings.cancelled') : t('myBookings.pending')}
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Clock size={14} color={colors.textSecondary} />
          <Text style={styles.infoText}>
            {t('myBookings.from', { time: formatTime(item.start_time) })}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Clock size={14} color={colors.textSecondary} />
          <Text style={styles.infoText}>
            {t('myBookings.to', { time: formatTime(item.end_time) })}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <MapPin size={14} color={colors.textSecondary} />
          <Text style={styles.infoText} numberOfLines={1}>
            {club?.address}, {club?.district || club?.city}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.label}>{t('myBookings.total')}</Text>
            <Text style={styles.price}>
              {Number(item.total_price).toLocaleString('vi-VN')} đ
            </Text>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.label}>{t('myBookings.deposit')}</Text>
            <Text style={[styles.price, { color: colors.primary }]}>
              {Number(item.deposit_amount).toLocaleString('vi-VN')} đ
            </Text>
          </View>
        </View>

        {refundLabel && <Text style={styles.refund}>{refundLabel}</Text>}

        {(isPending || canCancel) && (
          <View style={styles.actions}>
            {isPending && (
              <TouchableOpacity
                style={styles.payBtn}
                onPress={() => navigation.navigate('BookingPayment', { bookingId: item.id })}
              >
                <Text style={styles.payBtnText}>{t('myBookings.payDeposit')}</Text>
              </TouchableOpacity>
            )}
            {canCancel && (
              <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancel(item)}>
                <Text style={styles.cancelBtnText}>{t('myBookings.cancelBooking')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('myBookings.title')}</Text>
        <Text style={styles.subtitle}>{t('myBookings.subtitle')}</Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={renderBookingItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                loadBookings()
              }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Calendar size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>{t('myBookings.emptyTitle')}</Text>
              <Text style={styles.emptyDesc}>
                {t('myBookings.emptyText')}
              </Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  refund: {
    marginTop: 10,
    color: colors.accent,
    fontWeight: '700',
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  payBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  payBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  cancelBtn: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 13,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  title: {
    fontSize: 18,
    fontWeight: 'black',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  listContent: {
    padding: 16,
    gap: 14,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  courtName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  clubName: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  statusConfirmed: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  label: {
    fontSize: 11,
    color: colors.textMuted,
  },
  price: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 80,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  emptyDesc: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: '80%',
  },
})

