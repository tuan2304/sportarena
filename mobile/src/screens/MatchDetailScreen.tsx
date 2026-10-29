import { useI18n } from '../i18n'
import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { ChevronLeft } from 'lucide-react-native'
import { colors } from '../theme/colors'
import { supabase } from '../lib/supabase'
import { Match } from '../types'
import { apiPost } from '../lib/api'
import { fetchReputations, type Reputation } from '../lib/reputation'
import { matchPhase } from '../shared/match-time'
import { HostAndMembers } from './match-detail/HostAndMembers'
import { JoinSection } from './match-detail/JoinSection'
import { MatchSummary } from './match-detail/MatchSummary'
import { styles } from './match-detail/styles'

const MATCH_SELECT = `
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
    no_show_at,
    profile:profiles (
      id,
      full_name,
      avatar_url,
      rating,
      skill_level
    )
  )
`

/** Chi tiết một kèo ghép và gửi yêu cầu tham gia. Phần hiển thị nằm trong ./match-detail. */
export default function MatchDetailScreen({ route, navigation }: any) {
  const { t } = useI18n()
  const { matchId } = route.params
  const [match, setMatch] = useState<Match | null>(null)
  const [loading, setLoading] = useState(true)
  const [joinMessage, setJoinMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reputations, setReputations] = useState<Record<string, Reputation>>({})
  const [userId, setUserId] = useState<string | null>(null)
  const [noShowBusy, setNoShowBusy] = useState(false)

  const loadMatchDetail = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('matches').select(MATCH_SELECT).eq('id', matchId).single()

      if (error) throw error
      setMatch(data as any)
      const loaded = data as any as Match
      const { data: auth } = await supabase.auth.getUser()
      setUserId(auth.user?.id ?? null)
      setReputations(await fetchReputations([loaded.creator_id, ...(loaded.participants ?? []).map((p) => p.user_id)]))
    } catch (err: any) {
      console.error('Lỗi tải chi tiết kèo:', err.message)
    } finally {
      setLoading(false)
    }
  }, [matchId])

  useEffect(() => {
    loadMatchDetail()
  }, [loadMatchDetail])

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

  function reportNoShow(participantId: string, noShow: boolean) {
    const send = async () => {
      setNoShowBusy(true)
      const res = await apiPost<unknown>(`/api/mobile/matches/participants/${participantId}/no-show`, { noShow })
      setNoShowBusy(false)
      if (!res.ok) return Alert.alert(t('common.error'), res.error)
      loadMatchDetail()
    }
    if (!noShow) return send()
    Alert.alert(t('match.noShowConfirmTitle'), t('match.noShowConfirmText'), [
      { text: t('match.noShowKeep'), style: 'cancel' },
      { text: t('match.noShowConfirm'), style: 'destructive', onPress: send },
    ])
  }

  if (loading || !match) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    )
  }

  const phase = matchPhase(match.start_time, match.end_time, Date.now())

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t('match.headerTitle')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          <MatchSummary match={match} phase={phase} />
          <HostAndMembers
            match={match}
            openProfile={(profileId) => navigation.navigate('PlayerProfile', { userId: profileId })}
            reputations={reputations}
            canReportNoShow={userId === match.creator_id && Date.now() >= new Date(match.start_time).getTime()}
            noShowBusy={noShowBusy}
            onNoShow={reportNoShow}
          />
          <JoinSection phase={phase} message={joinMessage} onMessageChange={setJoinMessage} submitting={submitting} onSubmit={handleJoinMatch} />
        </View>
      </ScrollView>
    </View>
  )
}
