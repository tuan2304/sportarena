import React from 'react'
import { Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Send } from 'lucide-react-native'
import { colors } from '../../theme/colors'
import type { MatchPhase } from '../../shared/match-time'
import { useI18n } from '../../i18n'
import { styles } from './styles'

/** Ô nhập lời nhắn và nút gửi yêu cầu; qua giờ kết thúc thì kèo không còn nhận người nên chỉ hiện ghi chú. */
export function JoinSection({
  phase,
  message,
  onMessageChange,
  submitting,
  onSubmit,
}: {
  phase: MatchPhase
  message: string
  onMessageChange: (text: string) => void
  submitting: boolean
  onSubmit: () => void
}) {
  const { t } = useI18n()

  return (
    <>
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
            value={message}
            onChangeText={onMessageChange}
            multiline
          />

          <TouchableOpacity style={styles.submitBtn} activeOpacity={0.8} disabled={submitting} onPress={onSubmit}>
            <Send size={16} color={colors.white} />
            <Text style={styles.submitBtnText}>{submitting ? t('match.sending') : t('match.sendRequest')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  )
}
