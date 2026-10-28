import React from 'react'
import { Text, View } from 'react-native'
import { Award, Calendar, CircleDollarSign, Flame, MapPin } from 'lucide-react-native'
import { colors } from '../../theme/colors'
import type { Match } from '../../types'
import type { MatchPhase } from '../../shared/match-time'
import { useI18n, type MessageKey } from '../../i18n'
import { formatMatchWindow, perPersonCost } from './helpers'
import { styles } from './styles'

/** Phần đầu trang chi tiết kèo: nhãn môn/trình độ/trạng thái, tiêu đề, mô tả và thẻ giờ - sân - chi phí. */
export function MatchSummary({ match, phase }: { match: Match; phase: MatchPhase }) {
  const { t } = useI18n()
  const court = match.court
  const club = court?.club
  const window = formatMatchWindow(match.start_time ? new Date(match.start_time) : null, match.end_time ? new Date(match.end_time) : null)
  const cost = perPersonCost(match.cost_sharing_type, match.cost_per_person)

  return (
    <>
      <View style={styles.badgeRow}>
        <View style={styles.sportBadge}>
          <Flame size={12} color={colors.accent} />
          <Text style={styles.sportBadgeText}>{match.sport_type.toUpperCase()}</Text>
        </View>
        <View style={styles.skillBadge}>
          <Award size={12} color={colors.primary} />
          <Text style={styles.skillBadgeText}>{t('match.skillLine', { skill: t(`skills.${match.skill_level}` as MessageKey) })}</Text>
        </View>
        {phase !== 'upcoming' && (
          <View style={phase === 'live' ? styles.liveBadge : styles.endedBadge}>
            <Text style={phase === 'live' ? styles.liveBadgeText : styles.endedBadgeText}>{phase === 'live' ? t('match.live') : t('match.ended')}</Text>
          </View>
        )}
      </View>

      <Text style={styles.matchTitle}>{match.title}</Text>

      {match.description && (
        <View style={styles.descBox}>
          <Text style={styles.descText}>{match.description}</Text>
        </View>
      )}

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Calendar size={18} color={colors.primary} />
          <View style={styles.flex}>
            <Text style={styles.infoLabel}>{t('match.time')}</Text>
            <Text style={styles.infoValue}>{window ?? t('match.notSet')}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <MapPin size={18} color={colors.accent} />
          <View style={styles.flex}>
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
          <View style={styles.flex}>
            <Text style={styles.infoLabel}>{t('match.cost')}</Text>
            <Text style={[styles.infoValue, styles.costValue]}>{cost.free ? t('match.free') : t('match.perPerson', { price: cost.price })}</Text>
          </View>
        </View>
      </View>
    </>
  )
}
