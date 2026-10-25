import type { MessageKey } from '../i18n'
import { useI18n } from '../i18n'
import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { colors } from '../theme/colors'
import { supabase } from '../lib/supabase'
import { SKILL_LEVELS, validateProfile } from '../shared/profile'

interface ProfileEditFormProps {
  userId: string
  initial: { fullName: string; phone: string; skillLevel: string }
  onSaved: () => void
  onCancel: () => void
}

/** Sửa tên, số điện thoại và trình độ của chính mình. Ảnh đại diện đổi bằng cách chạm vào ảnh ở thẻ hồ sơ. */
export default function ProfileEditForm({ userId, initial, onSaved, onCancel }: ProfileEditFormProps) {
  const { t } = useI18n()
  const [fullName, setFullName] = useState(initial.fullName)
  const [phone, setPhone] = useState(initial.phone)
  const [skillLevel, setSkillLevel] = useState(initial.skillLevel)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setError(null)
    const parsed = validateProfile({ fullName, phone, skillLevel })
    if (!parsed.ok) return setError(parsed.error)

    setBusy(true)
    // Quyền ghi theo cột do database quyết định: chỉ tên, số điện thoại, ảnh, trình độ; không đổi được vai trò hay điểm
    const { error: err } = await supabase
      .from('profiles')
      .update({
        full_name: parsed.value.fullName,
        phone_number: parsed.value.phone,
        skill_level: parsed.value.skillLevel,
      })
      .eq('id', userId)
    setBusy(false)

    if (err) {
      Alert.alert(t('profile.saveFailed'), t('profile.tryLater'))
      return
    }
    onSaved()
  }

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{t('profile.fullName')}</Text>
      <TextInput style={styles.input} value={fullName} onChangeText={setFullName} maxLength={60} autoComplete="name" />

      <Text style={styles.label}>{t('profile.phone')}</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="0912345678"
        placeholderTextColor={colors.textMuted}
        autoComplete="tel"
      />
      <Text style={styles.hint}>{t('profile.phoneHint')}</Text>

      <Text style={styles.label}>{t('profile.skill')}</Text>
      <View style={styles.row}>
        {SKILL_LEVELS.map((s) => (
          <TouchableOpacity
            key={s.id}
            onPress={() => setSkillLevel(s.id)}
            style={[styles.chip, skillLevel === s.id && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: skillLevel === s.id }}
          >
            <Text style={[styles.chipText, skillLevel === s.id && styles.chipTextActive]}>{t(`skills.${s.id}` as MessageKey)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error && (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      )}

      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, styles.btnPrimary, busy && styles.disabled]} onPress={save} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.btnText}>{t('profile.save')}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onCancel} disabled={busy}>
          <Text style={styles.ghostText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, gap: 8 },
  label: { color: colors.textPrimary, fontWeight: '700', fontSize: 13, marginTop: 6 },
  input: {
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: 14,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    fontSize: 14,
  },
  hint: { color: colors.textMuted, fontSize: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { minHeight: 38, paddingHorizontal: 12, borderRadius: 10, justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontWeight: '600', fontSize: 12 },
  chipTextActive: { color: colors.white },
  error: { color: colors.danger, fontSize: 13 },
  btn: { minHeight: 46, borderRadius: 12, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18 },
  btnPrimary: { flex: 1, backgroundColor: colors.primary },
  btnGhost: { borderWidth: 1, borderColor: colors.cardBorder },
  disabled: { opacity: 0.5 },
  btnText: { color: colors.white, fontWeight: '800', fontSize: 14 },
  ghostText: { color: colors.textSecondary, fontWeight: '700', fontSize: 14 },
})
