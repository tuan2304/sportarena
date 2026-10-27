import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n'
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { colors } from '../theme/colors'
import { supabase } from '../lib/supabase'
import { Match } from '../types'
import { isMatchEnded, matchPhase } from '../shared/match-time'
import { Flame, Users, Calendar, MapPin, ChevronRight, Award } from 'lucide-react-native'

export default function MatchesScreen({ navigation }: any) {
  const { t } = useI18n()
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  // Mốc "bây giờ" của lần tải gần nhất, dùng để đánh dấu kèo đang diễn ra
  const [nowMs, setNowMs] = useState(() => Date.now())

  async function fetchMatches() {
    try {
      const now = Date.now()
      setNowMs(now)
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          creator:profiles (
            id,
            full_name,
            avatar_url,
            rating,
            skill_level
          ),
          court:courts (
            name,
            club:clubs (
              name,
              address,
              district,
              city
            )
          )
        `)
        .eq('status', 'open')
        // Qua giờ kết thúc của khung giờ đã đặt thì kèo không còn hiện ở danh sách
        .gt('end_time', new Date(now).toISOString())
        .order('created_at', { ascending: false })

      if (error) throw error
      setMatches(((data as any) || []).filter((m: Match) => !isMatchEnded(m.end_time, now)))
    } catch (err: any) {
      console.error('Lỗi tải danh sách kèo:', err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchMatches()
  }, [])

  function formatMatchTime(startIso?: string, endIso?: string) {
    if (!startIso) return t('matches.notSet')
    const start = new Date(startIso)
    const end = endIso ? new Date(endIso) : null

    const timeStr = `${start.getHours().toString().padStart(2, '0')}:${start
      .getMinutes()
      .toString()
      .padStart(2, '0')}${
      end
        ? ` - ${end.getHours().toString().padStart(2, '0')}:${end
            .getMinutes()
            .toString()
            .padStart(2, '0')}`
        : ''
    }`

    const dateStr = `${start.getDate()}/${start.getMonth() + 1}/${start.getFullYear()}`
    return `${timeStr} • ${dateStr}`
  }

  function renderMatchCard({ item }: { item: Match }) {
    const court = item.court
    const club = court?.club
    const locationStr = club ? `${court?.name} - ${club.name} (${club.district || club.city})` : t('matches.venueUpdating')

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.88}
        onPress={() => navigation.navigate('MatchDetail', { matchId: item.id })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.sportBadge}>
            <Flame size={12} color={colors.accent} />
            <Text style={styles.sportBadgeText}>{item.sport_type.toUpperCase()}</Text>
          </View>

          <View style={styles.skillBadge}>
            <Award size={12} color={colors.primary} />
            <Text style={styles.skillBadgeText}>
              {t('matches.skillLine', { skill: t(`skills.${item.skill_level}` as MessageKey) })}
            </Text>
          </View>
        </View>

        <Text style={styles.matchTitle} numberOfLines={2}>
          {item.title}
        </Text>

        <View style={styles.infoRow}>
          <Calendar size={14} color={colors.textSecondary} />
          <Text style={styles.infoText}>
            {formatMatchTime(item.start_time, item.end_time)}
          </Text>
          {matchPhase(item.start_time, item.end_time, nowMs) === 'live' && (
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>{t('matches.live')}</Text>
            </View>
          )}
        </View>

        <View style={styles.infoRow}>
          <MapPin size={14} color={colors.textSecondary} />
          <Text style={styles.infoText} numberOfLines={1}>
            {locationStr}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.playerCountRow}>
            <Users size={16} color={colors.accent} />
            <Text style={styles.playerCountText}>
              <Text style={{ color: colors.accent, fontWeight: 'bold' }}>
                {item.current_players}
              </Text>
              {t('matches.players', { required: item.required_players })}
            </Text>
          </View>

          <View style={styles.costBox}>
            <Text style={styles.costLabel}>{t('matches.cost')}</Text>
            <Text style={styles.costValue}>
              {item.cost_sharing_type === 'host_covers' || !item.cost_per_person
                ? t('matches.hostCovers')
                : t('matches.perPerson', { price: Number(item.cost_per_person).toLocaleString('vi-VN') })}
            </Text>
          </View>

          <View style={styles.joinBtn}>
            <Text style={styles.joinBtnText}>{t('matches.details')}</Text>
            <ChevronRight size={14} color={colors.white} />
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>{t('matches.banner')}</Text>
        <Text style={styles.bannerSubtitle}>
          {t('matches.bannerText')}
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.id}
          renderItem={renderMatchCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                fetchMatches()
              }}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Flame size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>{t('matches.emptyTitle')}</Text>
              <Text style={styles.emptyDesc}>{t('matches.emptyText')}</Text>
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
  banner: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: 'black',
    color: colors.textPrimary,
  },
  bannerSubtitle: {
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
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  sportBadgeText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: 'bold',
  },
  skillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  skillBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  matchTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    lineHeight: 22,
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
  liveBadge: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  liveBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
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
  playerCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playerCountText: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  costBox: {
    alignItems: 'center',
  },
  costLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  costValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.success,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 2,
  },
  joinBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: 'bold',
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

