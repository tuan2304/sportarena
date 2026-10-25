import { useI18n } from '../i18n'
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
} from 'react-native'
import { colors } from '../theme/colors'
import { supabase } from '../lib/supabase'
import { Club, Court } from '../types'
import { openDirections } from '../lib/maps'
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
} from 'lucide-react-native'

export default function ClubDetailScreen({ route, navigation }: any) {
  const { t } = useI18n()
  const { clubId } = route.params
  const [club, setClub] = useState<Club | null>(null)
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
              <View key={court.id} style={styles.courtCard}>
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
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
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

