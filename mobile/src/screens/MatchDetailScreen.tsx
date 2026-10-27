import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n'
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native'
import { colors } from '../theme/colors'
import { supabase } from '../lib/supabase'
import { Match } from '../types'
import { matchPhase } from '../shared/match-time'
import Avatar from '../components/Avatar'
import {
  ChevronLeft,
  Flame,
  Calendar,
  MapPin,
  Users,
  Award,
  CircleDollarSign,
  UserCheck,
  Send,
} from 'lucide-react-native'

export default function MatchDetailScreen({ route, navigation }: any) {
  const { t } = useI18n()
  const { matchId } = route.params
  const [match, setMatch] = useState<Match | null>(null)
  const [loading, setLoading] = useState(true)
  const [joinMessage, setJoinMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function loadMatchDetail() {
    try {
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
          ),
          participants:match_participants (
            id,
            user_id,
            status,
            message,
            joined_at,
            profile:profiles (
              id,
              full_name,
              avatar_url,
              rating,
              skill_level
            )
          )
        `)
        .eq('id', matchId)
        .single()

      if (error) throw error
      setMatch(data as any)
    } catch (err: any) {
      console.error('Lỗi tải chi tiết kèo:', err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMatchDetail()
  }, [matchId])

  async function handleJoinMatch() {
    // Quá giờ kết thúc (kể cả khi màn hình mở từ trước): chặn ngay, database cũng chặn lần nữa
    if (matchPhase(match?.start_time, match?.end_time, Date.now()) === 'ended') {
      Alert.alert(t('common.notice'), t('match.endedNote'))
      return
    }
    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        Alert.alert(t('match.loginTitle'), t('match.loginText'))
        return
      }

      const { error } = await supabase.from('match_participants').insert({
        match_id: matchId,
        user_id: user.id,
        status: 'pending',
        message: joinMessage.trim() || t('match.defaultMessage'),
      })

      if (error) {
        if (error.code === '23505') {
          Alert.alert(t('common.notice'), t('match.alreadySent'))
        } else {
          Alert.alert(t('common.error'), error.message)
        }
      } else {
        Alert.alert(t('match.sentTitle'), t('match.sentText'))
        setJoinMessage('')
        loadMatchDetail()
      }
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !match) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    )
  }

  const court = match.court
  const club = court?.club
  const startTime = match.start_time ? new Date(match.start_time) : null
  const endTime = match.end_time ? new Date(match.end_time) : null
  const phase = matchPhase(match.start_time, match.end_time, Date.now())

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t('match.headerTitle')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          {/* Badge Row */}
          <View style={styles.badgeRow}>
            <View style={styles.sportBadge}>
              <Flame size={12} color={colors.accent} />
              <Text style={styles.sportBadgeText}>{match.sport_type.toUpperCase()}</Text>
            </View>
            <View style={styles.skillBadge}>
              <Award size={12} color={colors.primary} />
              <Text style={styles.skillBadgeText}>
                {t('match.skillLine', { skill: t(`skills.${match.skill_level}` as MessageKey) })}
              </Text>
            </View>
            {phase !== 'upcoming' && (
              <View style={phase === 'live' ? styles.liveBadge : styles.endedBadge}>
                <Text style={phase === 'live' ? styles.liveBadgeText : styles.endedBadgeText}>
                  {phase === 'live' ? t('match.live') : t('match.ended')}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.matchTitle}>{match.title}</Text>

          {match.description && (
            <View style={styles.descBox}>
              <Text style={styles.descText}>{match.description}</Text>
            </View>
          )}

          {/* Quick Info Grid */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Calendar size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>{t('match.time')}</Text>
                <Text style={styles.infoValue}>
                  {startTime
                    ? `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')} - ${endTime?.getHours().toString().padStart(2, '0')}:${endTime?.getMinutes().toString().padStart(2, '0')} (${startTime.getDate()}/${startTime.getMonth() + 1}/${startTime.getFullYear()})`
                    : t('match.notSet')}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <MapPin size={18} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>{t('match.place')}</Text>
                <Text style={styles.infoValue}>
                  {court?.name} - {club?.name}
                </Text>
                <Text style={styles.infoSubText}>
                  {club?.address}, {club?.district || club?.city}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <CircleDollarSign size={18} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>{t('match.cost')}</Text>
                <Text style={[styles.infoValue, { color: colors.success }]}>
                  {match.cost_sharing_type === 'host_covers' || !match.cost_per_person
                    ? t('match.free')
                    : t('match.perPerson', { price: Number(match.cost_per_person).toLocaleString('vi-VN') })}
                </Text>
              </View>
            </View>
          </View>

          {/* Creator Info */}
          <Text style={styles.sectionTitle}>{t('match.host')}</Text>
          <TouchableOpacity
            style={styles.creatorCard}
            disabled={!match.creator?.id}
            onPress={() => navigation.navigate('PlayerProfile', { userId: match.creator!.id })}
            accessibilityRole="button"
            accessibilityLabel={t('match.viewProfile', { name: match.creator?.full_name ?? t('match.hostFallback') })}
          >
            <Avatar name={match.creator?.full_name} uri={match.creator?.avatar_url} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={styles.creatorName}>{match.creator?.full_name || t('match.userFallback')}</Text>
              <Text style={styles.creatorSub}>
                {t('match.ratingLine', { rating: match.creator?.rating || '5.0', skill: match.creator?.skill_level && ['beginner', 'intermediate', 'advanced', 'pro'].includes(match.creator.skill_level) ? t(`skills.${match.creator.skill_level}` as MessageKey) : t('match.basic') })}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Participants List */}
          <Text style={styles.sectionTitle}>
            {t('match.members', { count: match.participants?.length || 0 })}
          </Text>

          {match.participants && match.participants.length > 0 ? (
            <View style={styles.participantsList}>
              {match.participants.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.participantItem}
                  disabled={!p.user_id}
                  onPress={() => navigation.navigate('PlayerProfile', { userId: p.user_id })}
                  accessibilityRole="button"
                >
                  <Avatar name={p.profile?.full_name} uri={p.profile?.avatar_url} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pName}>{p.profile?.full_name || t('match.applicant')}</Text>
                    {p.message && <Text style={styles.pMsg}>"{p.message}"</Text>}
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      p.status === 'accepted' ? styles.statusAccepted : styles.statusPending,
                    ]}
                  >
                    <Text style={styles.statusPillText}>
                      {p.status === 'accepted' ? t('match.approved') : t('match.awaiting')}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>{t('match.noMembers')}</Text>
          )}

          {/* Join Section: qua giờ kết thúc thì kèo không còn nhận người */}
          <Text style={styles.sectionTitle}>{t('match.join')}</Text>
          {phase === 'ended' ? (
            <View style={styles.joinBox}>
              <Text style={styles.emptyText}>{t('match.endedNote')}</Text>
            </View>
          ) : (
          <View style={styles.joinBox}>
            <TextInput
              style={styles.messageInput}
              placeholder={t('match.joinPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={joinMessage}
              onChangeText={setJoinMessage}
              multiline
            />

            <TouchableOpacity
              style={styles.submitBtn}
              activeOpacity={0.8}
              disabled={submitting}
              onPress={handleJoinMatch}
            >
              <Send size={16} color={colors.white} />
              <Text style={styles.submitBtnText}>
                {submitting ? t('match.sending') : t('match.sendRequest')}
              </Text>
            </TouchableOpacity>
          </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
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
  body: {
    padding: 16,
    gap: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
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
  liveBadge: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  liveBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  endedBadge: {
    backgroundColor: colors.cardBorder,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  endedBadgeText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  matchTitle: {
    fontSize: 20,
    fontWeight: 'black',
    color: colors.textPrimary,
    lineHeight: 28,
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
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 2,
  },
  infoSubText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.cardBorder,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 6,
  },
  creatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  avatarText: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  creatorName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  creatorSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  participantsList: {
    gap: 8,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 10,
    borderRadius: 12,
    gap: 10,
  },
  pAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pAvatarText: {
    color: colors.textSecondary,
    fontWeight: 'bold',
  },
  pName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  pMsg: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusAccepted: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  emptyText: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  joinBox: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 10,
    marginBottom: 40,
  },
  messageInput: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    color: colors.textPrimary,
    fontSize: 13,
    minHeight: 60,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  submitBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  submitBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
})

