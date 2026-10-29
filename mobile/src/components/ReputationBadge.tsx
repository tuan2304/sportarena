import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react-native'
import { colors } from '../theme/colors'
import { useI18n } from '../i18n'
import type { Reputation, ReputationTier } from '../shared/reputation-score'

const TONE: Record<ReputationTier, { fg: string; bg: string }> = {
  new: { fg: colors.textMuted, bg: colors.surface },
  excellent: { fg: colors.primary, bg: colors.primaryLight },
  good: { fg: colors.primary, bg: colors.primaryLight },
  fair: { fg: colors.accent, bg: colors.accentLight },
  risky: { fg: colors.danger, bg: colors.dangerLight },
}

/** Huy hiệu uy tín người chơi (cùng hạng và công thức với web). */
export default function ReputationBadge({ reputation }: { reputation?: Reputation }) {
  const { t } = useI18n()
  if (!reputation) return null

  const tone = TONE[reputation.tier]
  const Icon = reputation.tier === 'new' ? ShieldQuestion : reputation.tier === 'fair' || reputation.tier === 'risky' ? ShieldAlert : ShieldCheck
  const label = reputation.score === null ? t('reputation.new') : `${t(`reputation.${reputation.tier}`)} · ${t('reputation.score', { score: reputation.score })}`
  const detail = t('reputation.detail', { played: reputation.played, noShows: reputation.noShows, lateCancels: reputation.lateCancels })

  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]} accessible accessibilityLabel={`${t('reputation.title')}: ${label}. ${detail}`}>
      <Icon size={12} color={tone.fg} />
      <Text style={[styles.text, { color: tone.fg }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 4 },
  text: { fontSize: 11, fontWeight: '700' },
})
