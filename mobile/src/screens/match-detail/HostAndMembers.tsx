import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import Avatar from '../../components/Avatar'
import type { Match } from '../../types'
import { useI18n, type MessageKey } from '../../i18n'
import { knownSkill } from './helpers'
import { styles } from './styles'

/** Chủ kèo và danh sách người đã xin tham gia; chạm vào ai cũng mở hồ sơ người đó. */
export function HostAndMembers({ match, openProfile }: { match: Match; openProfile: (userId: string) => void }) {
  const { t } = useI18n()
  const creator = match.creator
  const skill = knownSkill(creator?.skill_level)
  const participants = match.participants ?? []

  return (
    <>
      <Text style={styles.sectionTitle}>{t('match.host')}</Text>
      <TouchableOpacity
        style={styles.creatorCard}
        disabled={!creator?.id}
        onPress={() => creator && openProfile(creator.id)}
        accessibilityRole="button"
        accessibilityLabel={t('match.viewProfile', { name: creator?.full_name ?? t('match.hostFallback') })}
      >
        <Avatar name={creator?.full_name} uri={creator?.avatar_url} size={44} />
        <View style={styles.flex}>
          <Text style={styles.creatorName}>{creator?.full_name || t('match.userFallback')}</Text>
          <Text style={styles.creatorSub}>{t('match.ratingLine', { rating: creator?.rating || '5.0', skill: skill ? t(`skills.${skill}` as MessageKey) : t('match.basic') })}</Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>{t('match.members', { count: participants.length })}</Text>

      {participants.length > 0 ? (
        <View style={styles.participantsList}>
          {participants.map((p) => (
            <TouchableOpacity key={p.id} style={styles.participantItem} disabled={!p.user_id} onPress={() => openProfile(p.user_id)} accessibilityRole="button">
              <Avatar name={p.profile?.full_name} uri={p.profile?.avatar_url} size={36} />
              <View style={styles.flex}>
                <Text style={styles.pName}>{p.profile?.full_name || t('match.applicant')}</Text>
                {p.message && <Text style={styles.pMsg}>{`"${p.message}"`}</Text>}
              </View>
              <View style={[styles.statusPill, p.status === 'accepted' ? styles.statusAccepted : styles.statusPending]}>
                <Text style={styles.statusPillText}>{p.status === 'accepted' ? t('match.approved') : t('match.awaiting')}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>{t('match.noMembers')}</Text>
      )}
    </>
  )
}
