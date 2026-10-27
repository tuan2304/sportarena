import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { ChevronLeft, Calendar, Flame, Star, Trophy, Users } from 'lucide-react-native'
import { colors } from '../theme/colors'
import { supabase } from '../lib/supabase'
import Avatar from '../components/Avatar'

interface PublicProfile {
  id: string
  full_name: string | null
  avatar_url: string | null
  skill_level: string | null
  rating: number | null
}

interface OpenMatch {
  id: string
  title: string
  current_players: number
  required_players: number
  start_time: string
  end_time: string
}

const EMPTY_STATS = { matches_created: 0, matches_joined: 0, bookings_played: 0 }

/** Hồ sơ công khai của một người chơi: chỉ các cột công khai và số liệu tổng hợp, không có số điện thoại hay vai trò. */
export default function PlayerProfileScreen({ route, navigation }: any) {
  const { t } = useI18n()
  const { userId } = route.params
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [stats, setStats] = useState(EMPTY_STATS)
  const [matches, setMatches] = useState<OpenMatch[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    async function load() {
      const [p, s, m] = await Promise.all([
        supabase.from('profiles').select('id, full_name, avatar_url, skill_level, rating').eq('id', userId).maybeSingle(),
        supabase.rpc('player_public_stats', { p_user: userId }),
        supabase
          .from('matches')
          .select('id, title, current_players, required_players, start_time, end_time')
          .eq('creator_id', userId)
          .eq('status', 'open')
          // Kèo đã qua giờ kết thúc không còn là "kèo đang mở"
          .gt('end_time', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(6),
      ])
      if (!alive) return
      setProfile((p.data as PublicProfile | null) ?? null)
      setStats(s.data?.[0] ?? EMPTY_STATS)
      setMatches((m.data as unknown as OpenMatch[]) ?? [])
      setLoading(false)
    }
    load()
    return () => {
      alive = false
    }
  }, [userId])

  const tiles = [
    { Icon: Calendar, label: t('player.played'), value: stats.bookings_played },
    { Icon: Flame, label: t('player.created'), value: stats.matches_created },
    { Icon: Users, label: t('player.joined'), value: stats.matches_joined },
  ]

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel={t('common.back')}>
          <ChevronLeft size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('player.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !profile ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t('player.notFound')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Avatar name={profile.full_name} uri={profile.avatar_url} size={88} />
            <Text style={styles.name}>{profile.full_name || t('player.fallback')}</Text>
            <View style={styles.badges}>
              <View style={styles.badge}>
                <Trophy size={13} color={colors.primary} />
                <Text style={styles.badgeText}>{t(`skills.${profile.skill_level && ['beginner', 'intermediate', 'advanced', 'pro'].includes(profile.skill_level) ? profile.skill_level : 'unknown'}` as MessageKey)}</Text>
              </View>
              {profile.rating !== null && (
                <View style={[styles.badge, styles.badgeAmber]}>
                  <Star size={13} color={colors.accent} />
                  <Text style={[styles.badgeText, { color: colors.accent }]}>{Number(profile.rating).toFixed(1)}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.tiles}>
            {tiles.map(({ Icon, label, value }) => (
              <View key={label} style={styles.tile}>
                <Icon size={18} color={colors.primary} />
                <Text style={styles.tileValue}>{value}</Text>
                <Text style={styles.tileLabel}>{label}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.section}>{t('player.openMatches')}</Text>
          {matches.length === 0 ? (
            <Text style={styles.muted}>{t('player.noOpen')}</Text>
          ) : (
            matches.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={styles.matchRow}
                onPress={() => navigation.push('MatchDetail', { matchId: m.id })}
                accessibilityRole="button"
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.matchTitle} numberOfLines={1}>{m.title}</Text>
                  <Text style={styles.matchSub}>
                    {new Date(m.start_time).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}
                  </Text>
                </View>
                <Text style={styles.matchCount}>{m.current_players}/{m.required_players}</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 48, paddingBottom: 12, paddingHorizontal: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: colors.textPrimary, fontWeight: 'bold', fontSize: 17 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 20, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.cardBorder },
  name: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
  badges: { flexDirection: 'row', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.primaryLight },
  badgeAmber: { backgroundColor: colors.accentLight },
  badgeText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, alignItems: 'center', gap: 4, padding: 14, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
  tileValue: { color: colors.textPrimary, fontSize: 22, fontWeight: '800' },
  tileLabel: { color: colors.textSecondary, fontSize: 11, textAlign: 'center' },
  section: { color: colors.textPrimary, fontSize: 16, fontWeight: '800', marginTop: 6 },
  muted: { color: colors.textMuted, fontSize: 13 },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, padding: 14, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
  matchTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 14 },
  matchSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  matchCount: { color: colors.primary, fontWeight: '800', fontSize: 13 },
})
