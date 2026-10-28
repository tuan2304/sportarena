import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { colors } from '../../theme/colors'
import { apiPatch, apiPost } from '../../lib/api'
import { useI18n, type MessageKey } from '../../i18n'
import { Field } from './controls'
import { buildRequest, initialValues, SPORTS, type Form, type Sport } from './model'
import { styles } from './styles'

/** Hộp thoại nhập liệu dùng chung cho các biểu mẫu; mỗi loại tự dựng trường và gọi API tương ứng. */
export function FormSheet({ form, onClose, onSaved }: { form: Form | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n()
  const [values, setValues] = useState<Record<string, string>>({})
  const [sport, setSport] = useState<Sport>('football')
  const [saving, setSaving] = useState(false)

  // Mở biểu mẫu mới thì đặt lại dữ liệu: mặc định khi tạo, giá trị hiện có khi sửa
  useEffect(() => {
    if (!form) return
    setSport('football')
    setValues(initialValues(form))
  }, [form])

  const set = (key: string) => (text: string) => setValues((v) => ({ ...v, [key]: text }))
  const v = (key: string) => values[key] ?? ''

  async function submit() {
    if (!form) return
    const request = buildRequest(form, values, sport)
    if (!request) {
      Alert.alert(t('owner.failed'), t('owner.form.invalidNumber'))
      return
    }

    setSaving(true)
    const res = await (request.method === 'POST' ? apiPost(request.path, request.body) : apiPatch(request.path, request.body))
    setSaving(false)
    if (!res.ok) {
      Alert.alert(t('owner.failed'), res.error)
      return
    }
    onSaved()
  }

  const title = !form
    ? ''
    : form.kind === 'club'
      ? t('owner.form.clubTitle')
      : form.kind === 'editClub'
        ? t('owner.form.editClubTitle', { club: form.club.name })
        : form.kind === 'court'
          ? t('owner.form.courtTitle', { club: form.club.name })
          : form.kind === 'rule'
            ? t('owner.form.ruleTitle', { court: form.court.name })
            : form.kind === 'editCourt'
              ? t('owner.form.editCourtTitle', { court: form.court.name })
              : t('owner.form.editRuleTitle')

  const courtFields = form?.kind === 'court' || form?.kind === 'editCourt'
  const ruleFields = form?.kind === 'rule' || form?.kind === 'editRule'

  return (
    <Modal visible={form !== null} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6, paddingBottom: 8 }}>
            {(form?.kind === 'club' || form?.kind === 'editClub') && (
              <>
                <Field label={t('owner.form.clubName')} value={v('name')} onChange={set('name')} maxLength={100} />
                <Field label={t('owner.form.address')} value={v('address')} onChange={set('address')} maxLength={200} />
                <Field label={t('owner.form.district')} value={v('district')} onChange={set('district')} maxLength={60} />
                <Field label={t('owner.form.city')} value={v('city')} onChange={set('city')} maxLength={60} />
                <Field label={t('owner.form.openTime')} value={v('openTime')} onChange={set('openTime')} maxLength={5} />
                <Field label={t('owner.form.closeTime')} value={v('closeTime')} onChange={set('closeTime')} maxLength={5} />
                <Field label={t('owner.form.description')} value={v('description')} onChange={set('description')} maxLength={1000} multiline />
                <Field label={t('owner.form.amenities')} value={v('amenities')} onChange={set('amenities')} maxLength={300} />
              </>
            )}

            {courtFields && (
              <>
                <Field label={t('owner.form.courtName')} value={v('name')} onChange={set('name')} maxLength={80} />
                {form?.kind === 'court' && (
                  <>
                    <Text style={styles.label}>{t('owner.form.sport')}</Text>
                    <View style={styles.chips}>
                      {SPORTS.map((s) => (
                        <TouchableOpacity key={s} style={[styles.chip, sport === s && styles.chipOn]} onPress={() => setSport(s)} accessibilityRole="button">
                          <Text style={[styles.chipText, sport === s && styles.chipTextOn]}>{t(`owner.sport.${s}` as MessageKey)}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
                <Field label={t('owner.form.surface')} value={v('surface')} onChange={set('surface')} maxLength={40} />
                <Field label={t('owner.form.basePrice')} value={v('basePrice')} onChange={set('basePrice')} numeric />
                <Field label={t('owner.form.deposit')} value={v('deposit')} onChange={set('deposit')} numeric maxLength={3} />
              </>
            )}

            {ruleFields && (
              <>
                <Field label={t('owner.form.ruleName')} value={v('name')} onChange={set('name')} maxLength={80} />
                <Field label={t('owner.form.startTime')} value={v('startTime')} onChange={set('startTime')} maxLength={5} />
                <Field label={t('owner.form.endTime')} value={v('endTime')} onChange={set('endTime')} maxLength={5} />
                <Field label={t('owner.form.basePrice')} value={v('price')} onChange={set('price')} numeric />
              </>
            )}
          </ScrollView>

          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.danger} onPress={onClose} disabled={saving} accessibilityRole="button">
              <Text style={styles.dangerText}>{t('owner.form.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primary, styles.flex, saving && styles.disabled]} onPress={submit} disabled={saving} accessibilityRole="button">
              {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>{t('owner.form.save')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
