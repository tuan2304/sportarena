import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n'
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from 'react-native'
import { colors } from '../theme/colors'
import { supabase } from '../lib/supabase'
import { Club, SportType } from '../types'
import { MapPin, Clock, Search, Trophy, ChevronRight } from 'lucide-react-native'

const SPORT_FILTERS: { key: string; label: MessageKey }[] = [
  { key: 'all', label: 'clubs.filterAll' },
  { key: 'pickleball', label: 'clubs.filterPickleball' },
  { key: 'badminton', label: 'clubs.filterBadminton' },
  { key: 'football', label: 'clubs.filterFootball' },
  { key: 'tennis', label: 'clubs.filterTennis' },
  { key: 'basketball', label: 'clubs.filterBasketball' },
]

export default function ClubsScreen({ navigation }: any) {
  const { t } = useI18n()
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedSport, setSelectedSport] = useState('all')

  async function fetchClubs() {
    try {
      let query = supabase
        .from('clubs')
        .select(`
          id,
          name,
          description,
          address,
          ward,
          district,
          city,
          open_time,
          close_time,
          amenities,
          images,
          is_active,
          courts:courts (
            id,
            name,
            sport_type,
            base_price_per_hour,
            deposit_percentage,
            is_active
          )
        `)
        .eq('is_active', true)
        // Cụm sân chưa liên kết ngân hàng thì khách không thanh toán cọc được nên chưa hiện trong danh sách
        .or('accepts_online_payment.eq.true,accepts_manual_transfer.eq.true')

      const { data, error } = await query
      if (error) throw error

      setClubs(data as any || [])
    } catch (err: any) {
      console.error('Lỗi tải danh sách sân:', err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchClubs()
  }, [])

  const filteredClubs = clubs.filter((club) => {
    const matchSearch =
      club.name.toLowerCase().includes(search.toLowerCase()) ||
      club.address.toLowerCase().includes(search.toLowerCase()) ||
      (club.district && club.district.toLowerCase().includes(search.toLowerCase()))

    if (!matchSearch) return false

    if (selectedSport === 'all') return true

    // Kiểm tra xem cụm sân có sân con nào thuộc môn này không
    const hasSport = club.courts?.some((c) => c.sport_type === selectedSport)
    return hasSport
  })

  function renderClubCard({ item }: { item: Club }) {
    const minPrice = item.courts && item.courts.length > 0
      ? Math.min(...item.courts.map((c) => Number(c.base_price_per_hour)))
      : 0

    const sportsInClub = Array.from(
      new Set(item.courts?.map((c) => c.sport_type) || [])
    )

    const coverImage =
      item.images && item.images.length > 0
        ? item.images[0]
        : 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=800&q=80'

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.88}
        onPress={() => navigation.navigate('ClubDetail', { clubId: item.id })}
      >
        <Image source={{ uri: coverImage }} style={styles.cardImage} />

        {/* Badge các môn thể thao */}
        <View style={styles.sportsBadgeRow}>
          {sportsInClub.map((s) => (
            <View key={s} style={styles.sportBadge}>
              <Text style={styles.sportBadgeText}>{s.toUpperCase()}</Text>
            </View>
          ))}
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.clubName} numberOfLines={1}>
            {item.name}
          </Text>

          <View style={styles.infoRow}>
            <MapPin size={14} color={colors.textSecondary} />
            <Text style={styles.infoText} numberOfLines={1}>
              {item.address}, {item.district || item.city}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Clock size={14} color={colors.textSecondary} />
            <Text style={styles.infoText}>
              {item.open_time.slice(0, 5)} - {item.close_time.slice(0, 5)}
            </Text>
          </View>

          <View style={styles.cardFooter}>
            <View>
              <Text style={styles.priceLabel}>{t('clubs.priceFrom')}</Text>
              <Text style={styles.priceValue}>
                {minPrice > 0 ? t('common.perHour', { price: minPrice.toLocaleString('vi-VN') }) : t('clubs.contact')}
              </Text>
            </View>

            <View style={styles.detailBtn}>
              <Text style={styles.detailBtnText}>{t('clubs.book')}</Text>
              <ChevronRight size={14} color={colors.white} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('clubs.search')}
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Sport Category Filter */}
      <View style={styles.filterScrollWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={SPORT_FILTERS}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => {
            const isActive = selectedSport === item.key
            return (
              <TouchableOpacity
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setSelectedSport(item.key)}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {t(item.label)}
                </Text>
              </TouchableOpacity>
            )
          }}
        />
      </View>

      {/* List of Clubs */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{t('clubs.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredClubs}
          keyExtractor={(item) => item.id}
          renderItem={renderClubCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                fetchClubs()
              }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Trophy size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>{t('clubs.emptyTitle')}</Text>
              <Text style={styles.emptyDesc}>{t('clubs.emptyText')}</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: colors.textPrimary,
    fontSize: 14,
  },
  filterScrollWrapper: {
    marginBottom: 8,
  },
  filterList: {
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 4,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.white,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
    gap: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  cardImage: {
    width: '100%',
    height: 160,
    backgroundColor: colors.surface,
  },
  sportsBadgeRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    gap: 6,
  },
  sportBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sportBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  cardBody: {
    padding: 14,
    gap: 6,
  },
  clubName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    marginTop: 8,
    paddingTop: 10,
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
  detailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  detailBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 10,
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
  },
})

