import React from 'react'
import { Switch, Text, TouchableOpacity, View } from 'react-native'
import { ImageIcon, Landmark, MapPin, Pencil, Plus, Trash2 } from 'lucide-react-native'
import { colors } from '../../theme/colors'
import { formatVnd } from '../../lib/format'
import { bankNameFromBin } from '../../shared/banks'
import { useI18n, type MessageKey } from '../../i18n'
import { IconButton } from './controls'
import { hhmm, savedBank, type Club, type Court, type Form } from './model'
import { styles } from './styles'

export interface ClubCardActions {
  openForm: (form: Form) => void
  openBank: (club: Club) => void
  openPhotos: (club: Club) => void
  pinLocation: (club: Club) => void
  toggleCourt: (court: Court, active: boolean) => void
  confirmDelete: (title: string, text: string, id: string, path: string) => void
}

/** Một cụm sân với các sân con và khung giá của chúng; mọi thao tác đi qua `actions` của màn hình cha. */
export function ClubCard({ club, busyId, actions }: { club: Club; busyId: string | null; actions: ClubCardActions }) {
  const { t } = useI18n()
  const bank = savedBank(club)

  return (
    <View style={[styles.card, busyId === club.id && styles.disabled]}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.clubName}>{club.name}</Text>
          <Text style={styles.muted}>{club.address}</Text>
        </View>
        <IconButton label={t('owner.venues.edit')} onPress={() => actions.openForm({ kind: 'editClub', club })}>
          <Pencil size={16} color={colors.primary} />
        </IconButton>
        <IconButton
          label={t('owner.venues.deleteClub')}
          onPress={() => actions.confirmDelete(t('owner.venues.deleteClubTitle', { name: club.name }), t('owner.venues.deleteClubText'), club.id, `/api/mobile/owner/clubs/${club.id}`)}
        >
          <Trash2 size={16} color={colors.danger} />
        </IconButton>
      </View>

      {!club.accepts_online_payment && !club.accepts_manual_transfer && <Text style={styles.off}>{t('owner.venues.hiddenNoPayment')}</Text>}

      <View style={styles.chips}>
        <TouchableOpacity style={[styles.chip, bank && styles.chipOn]} onPress={() => actions.openBank(club)} accessibilityRole="button">
          <Landmark size={14} color={colors.primary} />
          <Text style={styles.chipText}>{bank ? t('owner.bank.linked', { bank: bankNameFromBin(bank.bank_bin) ?? '' }) : t('owner.bank.link')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.chip} onPress={() => actions.openPhotos(club)} accessibilityRole="button">
          <ImageIcon size={14} color={colors.primary} />
          <Text style={styles.chipText}>{t('owner.venues.photos', { count: (club.images ?? []).length })}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.chip} onPress={() => actions.pinLocation(club)} accessibilityRole="button">
          <MapPin size={14} color={colors.primary} />
          <Text style={styles.chipText}>{club.latitude !== null ? t('owner.venues.pinned') : t('owner.venues.pin')}</Text>
        </TouchableOpacity>
      </View>

      {(club.courts ?? []).length === 0 && <Text style={styles.muted}>{t('owner.venues.noCourts')}</Text>}

      {(club.courts ?? []).map((court) => (
        <View key={court.id} style={[styles.court, busyId === court.id && styles.disabled]}>
          <View style={styles.row}>
            <Text style={[styles.courtName, styles.flex]}>{court.name}</Text>
            <Switch
              value={court.is_active}
              disabled={busyId === court.id}
              onValueChange={(next) => actions.toggleCourt(court, next)}
              trackColor={{ true: colors.primary, false: colors.cardBorder }}
              accessibilityLabel={t('owner.venues.active')}
            />
          </View>
          <Text style={styles.muted}>
            {t(`owner.sport.${court.sport_type}` as MessageKey)} · {t('owner.venues.base')} {t('owner.venues.perHour', { price: formatVnd(court.base_price_per_hour) })} ·{' '}
            {t('owner.venues.deposit', { percent: court.deposit_percentage })}
          </Text>
          {!court.is_active && <Text style={styles.off}>{t('owner.venues.inactive')}</Text>}

          {(court.court_pricing_rules ?? []).length === 0 && <Text style={styles.hint}>{t('owner.venues.noRules')}</Text>}
          {(court.court_pricing_rules ?? [])
            .slice()
            .sort((a, b) => a.start_time.localeCompare(b.start_time))
            .map((rule) => (
              <View key={rule.id} style={styles.rule}>
                <View style={styles.flex}>
                  <Text style={styles.ruleName}>{rule.name}</Text>
                  <Text style={styles.muted}>
                    {hhmm(rule.start_time)} - {hhmm(rule.end_time)} · {t('owner.venues.perHour', { price: formatVnd(rule.price_per_hour) })}
                  </Text>
                </View>
                <IconButton label={t('owner.venues.edit')} onPress={() => actions.openForm({ kind: 'editRule', court, rule })}>
                  <Pencil size={16} color={colors.primary} />
                </IconButton>
                <IconButton
                  label={t('owner.venues.delete')}
                  onPress={() => actions.confirmDelete(t('owner.venues.deleteRuleTitle'), t('owner.venues.deleteRuleText', { name: rule.name }), rule.id, `/api/mobile/owner/pricing-rules/${rule.id}`)}
                >
                  <Trash2 size={16} color={colors.danger} />
                </IconButton>
              </View>
            ))}

          <View style={styles.row}>
            <TouchableOpacity style={styles.ghost} onPress={() => actions.openForm({ kind: 'rule', court })} accessibilityRole="button">
              <Plus size={14} color={colors.primary} />
              <Text style={styles.ghostText}>{t('owner.venues.addRule')}</Text>
            </TouchableOpacity>
            <View style={styles.flex} />
            <IconButton label={t('owner.venues.edit')} onPress={() => actions.openForm({ kind: 'editCourt', court })}>
              <Pencil size={16} color={colors.primary} />
            </IconButton>
            <IconButton
              label={t('owner.venues.delete')}
              onPress={() => actions.confirmDelete(t('owner.venues.deleteCourtTitle', { name: court.name }), t('owner.venues.deleteCourtText'), court.id, `/api/mobile/owner/courts/${court.id}`)}
            >
              <Trash2 size={16} color={colors.danger} />
            </IconButton>
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.ghost} onPress={() => actions.openForm({ kind: 'court', club })} accessibilityRole="button">
        <Plus size={14} color={colors.primary} />
        <Text style={styles.ghostText}>{t('owner.venues.addCourt')}</Text>
      </TouchableOpacity>
    </View>
  )
}
