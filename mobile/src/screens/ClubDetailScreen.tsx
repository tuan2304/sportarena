import { useI18n, type MessageKey } from '../i18n'
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
} from 'react-native'
import { colors } from '../theme/colors'
import { supabase } from '../lib/supabase'
import { Club, Court } from '../types'
import { openDirections } from '../lib/maps'
import { formatVnd, weekdayShort } from '../lib/format'
import { describePolicy } from '../shared/cancellation'
import {
  MapPin,
  Clock,
  Wifi,
  Car,
  ShowerHead,
  Coffee,
  Lightbulb,
  ShieldCheck,
  ChevronLeft,
  Calendar,
  Navigation,
  ChevronRight,
  X,
} from 'lucide-react-native'

export default function ClubDetailScreen({ route, navigation }: any) {
  const { t, lang } = useI18n()
  const { clubId } = route.params
  const [club, setClub] = useState<Club | null>(null)
  const [detail, setDetail] = useState<Court | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadClubDetail() {
      try {
        const { data, error } = await supabase
          .from('clubs')
          .select(`
            *,
            courts:courts (
              *,
              court_pricing_rules (*)
            )
          `)
          .eq('id', clubId)
          .single()

        if (error) throw error
        setClub(data as any)
      } catch (err: any) {
        console.error('Lỗi tải chi tiết sân:', err.message)
      } finally {
        setLoading(false)
      }
    }
    loadClubDetail()
  }, [clubId])

  function handleBookCourt(court: Court) {
    navigation.navigate('Booking', { clubId, courtId: court.id })
  }

  if (loading || !club) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  const coverImage =
    club.images && club.images.length > 0
      ? club.images[0]
      : 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=800&q=80'

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {club.name}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Image source={{ uri: coverImage }} style={styles.mainImage} />

        <View style={styles.body}>
          {/* Main Info */}
          <Text style={styles.clubTitle}>{club.name}</Text>

          <View style={styles.infoRow}>
            <MapPin size={16} color={colors.primary} />
            <Text style={styles.infoText}>
              {club.address}, {club.ward ? `${club.ward}, ` : ''}{club.district}, {club.city}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.directionsBtn}
            accessibilityRole="button"
            accessibilityLabel={t('clubs.directionsLabel')}
            onPress={async () => {
              const ok = await openDirections({
                latitude: club.latitude,
                longitude: club.longitude,
                name: club.name,
                address: `${club.address}, ${club.district ?? ''}, ${club.city ?? ''}`,
              }).catch(() => false)
              if (!ok) Alert.alert(t('clubs.mapFailed'), t('profile.tryLater'))
            }}
          >
            <Navigation size={16} color="#fff" />
            <Text style={styles.directionsText}>{t('clubs.directions')}</Text>
          </TouchableOpacity>

          <View style={styles.infoRow}>
            <Clock size={16} color={colors.accent} />
            <Text style={styles.infoText}>
              {t('clubs.hours', { open: club.open_time.slice(0, 5), close: club.close_time.slice(0, 5) })}
            </Text>
          </View>

          {club.description && (
            <View style={styles.descBox}>
              <Text style={styles.descText}>{club.description}</Text>
            </View>
          )}

          {/* Amenities */}
          <Text style={styles.sectionTitle}>{t('clubs.amenities')}</Text>
          <View style={styles.amenitiesGrid}>
            <View style={styles.amenityItem}>
              <Wifi size={16} color={colors.primary} />
              <Text style={styles.amenityText}>{t('clubs.wifi')}</Text>
            </View>
            <View style={styles.amenityItem}>
              <Car size={16} color={colors.primary} />
              <Text style={styles.amenityText}>{t('clubs.parking')}</Text>
            </View>
            <View style={styles.amenityItem}>
              <ShowerHead size={16} color={colors.primary} />
              <Text style={styles.amenityText}>{t('clubs.shower')}</Text>
            </View>
            <View style={styles.amenityItem}>
              <Coffee size={16} color={colors.primary} />
              <Text style={styles.amenityText}>{t('clubs.canteen')}</Text>
            </View>
            <View style={styles.amenityItem}>
              <Lightbulb size={16} color={colors.primary} />
              <Text style={styles.amenityText}>{t('clubs.led')}</Text>
            </View>
          </View>

          {/* Courts List */}
          <Text style={styles.sectionTitle}>
            {t('clubs.courts', { count: club.courts?.length || 0 })}
          </Text>

          <View style={styles.courtsList}>
            {club.courts?.map((court) => (
              <TouchableOpacity
                key={court.id}
                style={styles.courtCard}
                activeOpacity={0.85}
                onPress={() => setDetail(court)}
                accessibilityRole="button"
                accessibilityLabel={t('clubs.detailOf', { court: court.name })}
              >
                <View style={styles.courtCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.courtName}>{court.name}</Text>
                    <Text style={styles.courtSurface}>
                      {t('clubs.surface', { surface: court.surface_type || t('clubs.standard'), percent: court.deposit_percentage })}
                    </Text>
                  </View>
                  <View style={styles.sportBadge}>
                    <Text style={styles.sportBadgeText}>{court.sport_type.toUpperCase()}</Text>
                  </View>
                </View>

                <View style={styles.courtCardFooter}>
                  <View>
                    <Text style={styles.priceLabel}>{t('clubs.basePrice')}</Text>
                    <Text style={styles.priceValue}>
                      {t('common.perHour', { price: Number(court.base_price_per_hour).toLocaleString('vi-VN') })}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.bookBtn}
                    activeOpacity={0.8}
                    onPress={() => handleBookCourt(court)}
                  >
                    <Calendar size={14} color={colors.white} />
                    <Text style={styles.bookBtnText}>{t('clubs.pickTime')}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.detailHint}>
                  <Text style={styles.detailHintText}>{t('clubs.detailHint')}</Text>
                  <ChevronRight size={14} color={colors.textMuted} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <CourtDetailSheet
        court={detail}
        club={club}
        onClose={() => setDetail(null)}
        onBook={(court) => {
          setDetail(null)
          handleBookCourt(court)
        }}
        lang={lang}
      />
    </View>
  )
}

/** Hộp thoại trượt từ dưới lên: chi tiết một sân con (thông tin, tiền cọc, bảng giá theo khung giờ, chính sách hủy). */
function CourtDetailSheet({ court, club, onClose, onBook, lang }: { court: Court | null; club: Club; onClose: () => void; onBook: (court: Court) => void; lang: 'vi' | 'en' }) {
  const { t } = useI18n()
  const rules = [...(court?.court_pricing_rules ?? [])].sort((a, b) => a.start_time.localeCompare(b.start_time))
  const depositSample = court ? Math.round((Number(court.base_price_per_hour) * court.deposit_percentage) / 100) : 0

  return (
    <Modal visible={court !== null} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('clubs.detailClose')} />
      {court && (
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>{court.name}</Text>
              <Text style={styles.courtSurface}>
                {t(`owner.sport.${court.sport_type}` as MessageKey)} • {court.surface_type || t('clubs.standard')}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.sheetClose} accessibilityRole="button" accessibilityLabel={t('clubs.detailClose')}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
            <View style={styles.factRow}>
              <View style={styles.fact}>
                <Text style={styles.factLabel}>{t('clubs.detailHours')}</Text>
                <Text style={styles.factValue}>
                  {club.open_time.slice(0, 5)} - {club.close_time.slice(0, 5)}
                </Text>
              </View>
              <View style={styles.fact}>
                <Text style={styles.factLabel}>{t('clubs.detailDeposit')}</Text>
                <Text style={styles.factValue}>{court.deposit_percentage}%</Text>
              </View>
            </View>
            <Text style={styles.hintText}>{t('clubs.detailDepositValue', { percent: court.deposit_percentage, amount: formatVnd(depositSample) })}</Text>

            <Text style={styles.sectionTitle}>{t('clubs.detailPricing')}</Text>
            <View style={styles.rulesBox}>
              <View style={styles.ruleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ruleName}>{t('clubs.basePrice')}</Text>
                  <Text style={styles.hintText}>{rules.length > 0 ? t('clubs.detailBaseHint') : t('clubs.detailNoRules')}</Text>
                </View>
                <Text style={styles.priceValue}>{t('common.perHour', { price: Number(court.base_price_per_hour).toLocaleString('vi-VN') })}</Text>
              </View>
              {rules.map((rule, index) => {
                const days = [...new Set(rule.days_of_week ?? [])].sort()
                return (
                  <View key={rule.id ?? index} style={[styles.ruleRow, styles.ruleDivider]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ruleName}>{rule.name || t('clubs.detailSlot')}</Text>
                      <Text style={styles.hintText}>
                        {rule.start_time.slice(0, 5)} - {rule.end_time.slice(0, 5)} •{' '}
                        {days.length === 0 || days.length >= 7 ? t('clubs.detailEveryDay') : days.map((d) => weekdayShort(d, lang)).join(', ')}
                      </Text>
                    </View>
                    <Text style={styles.priceValue}>{t('common.perHour', { price: Number(rule.price_per_hour).toLocaleString('vi-VN') })}</Text>
                  </View>
                )
              })}
            </View>

            <View style={styles.policyRow}>
              <ShieldCheck size={16} color={colors.primary} />
              <Text style={styles.hintText}>
                <Text style={styles.ruleName}>{t('clubs.detailPolicy')} </Text>
                {describePolicy(club.free_cancel_hours ?? 24, lang)}
              </Text>
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.sheetBook} activeOpacity={0.85} onPress={() => onBook(court)} accessibilityRole="button">
            <Calendar size={16} color={colors.white} />
            <Text style={styles.bookBtnText}>{t('clubs.pickTime')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </Modal>
  )
}

const styles = StyleSheet.create({
  detailHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  detailHintText: { color: colors.textMuted, fontSize: 11 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, maxHeight: '85%', gap: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  sheetTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
  sheetClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: -8, marginRight: -8 },
  factRow: { flexDirection: 'row', gap: 10 },
  fact: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, padding: 12, gap: 2 },
  factLabel: { color: colors.textMuted, fontSize: 11 },
  factValue: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  hintText: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, flexShrink: 1 },
  rulesBox: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  ruleDivider: { borderTopWidth: 1, borderTopColor: colors.cardBorder },
  ruleName: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  policyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  sheetBook: { minHeight: 48, borderRadius: 12, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    marginVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  directionsText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  mainImage: {
    width: '100%',
    height: 220,
    backgroundColor: colors.surface,
  },
  body: {
    padding: 16,
    gap: 14,
  },
  clubTitle: {
    fontSize: 22,
    fontWeight: 'black',
    color: colors.textPrimary,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  descBox: {
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  descText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 8,
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amenityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  amenityText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  courtsList: {
    gap: 12,
    marginBottom: 30,
  },
  courtCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 12,
  },
  courtCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  courtName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  courtSurface: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  sportBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  sportBadgeText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: 'bold',
  },
  courtCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  priceLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  priceValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.primary,
  },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  bookBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
})

