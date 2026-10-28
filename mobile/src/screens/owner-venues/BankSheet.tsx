import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { colors } from '../../theme/colors'
import { apiDelete, apiPut } from '../../lib/api'
import { BANKS } from '../../shared/banks'
import { useI18n } from '../../i18n'
import { Field } from './controls'
import { savedBank, type Club } from './model'
import { styles } from './styles'

/**
 * Liên kết tài khoản ngân hàng nhận cọc (chuyển khoản VietQR) của một cụm sân. Có tài khoản thì cụm sân mới hiện cho khách.
 * Ghi qua API của máy chủ web: bảng và cờ nhận chuyển khoản chỉ máy chủ ghi được.
 */
export function BankSheet({ club, onClose, onSaved }: { club: Club | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n()
  const [bin, setBin] = useState<string>(BANKS[0].bin)
  const [number, setNumber] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const saved = club ? savedBank(club) : null

  useEffect(() => {
    if (!club) return
    const current = savedBank(club)
    setBin(current?.bank_bin ?? BANKS[0].bin)
    setNumber(current?.account_number ?? '')
    setName(current?.account_name ?? '')
  }, [club])

  async function call(request: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setBusy(true)
    const res = await request()
    setBusy(false)
    if (!res.ok) {
      Alert.alert(t('owner.failed'), res.error)
      return
    }
    onSaved()
  }

  function save() {
    if (!club) return
    call(() => apiPut<unknown>(`/api/mobile/owner/clubs/${club.id}/bank-account`, { bin, accountNumber: number, accountName: name }))
  }

  function remove() {
    if (!club) return
    Alert.alert(t('owner.bank.removeTitle', { club: club.name }), t('owner.bank.removeText'), [
      { text: t('owner.form.cancel'), style: 'cancel' },
      { text: t('owner.bank.remove'), style: 'destructive', onPress: () => call(() => apiDelete<unknown>(`/api/mobile/owner/clubs/${club.id}/bank-account`)) },
    ])
  }

  return (
    <Modal visible={club !== null} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{t('owner.bank.title', { club: club?.name ?? '' })}</Text>
          <Text style={styles.hint}>{t('owner.bank.hint')}</Text>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6, paddingBottom: 8 }}>
            <Text style={styles.label}>{t('owner.bank.bank')}</Text>
            <View style={styles.chips}>
              {BANKS.map((b) => (
                <TouchableOpacity key={b.bin} style={[styles.chip, bin === b.bin && styles.chipOn]} onPress={() => setBin(b.bin)} accessibilityRole="button">
                  <Text style={[styles.chipText, bin === b.bin && styles.chipTextOn]}>{b.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Field label={t('owner.bank.number')} value={number} onChange={setNumber} maxLength={24} numeric />
            <Field label={t('owner.bank.name')} value={name} onChange={setName} maxLength={60} />
          </ScrollView>

          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.danger} onPress={onClose} disabled={busy} accessibilityRole="button">
              <Text style={styles.dangerText}>{t('owner.images.close')}</Text>
            </TouchableOpacity>
            {saved && (
              <TouchableOpacity style={[styles.danger, busy && styles.disabled]} onPress={remove} disabled={busy} accessibilityRole="button">
                <Text style={styles.dangerText}>{t('owner.bank.remove')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.primary, styles.flex, busy && styles.disabled]} onPress={save} disabled={busy} accessibilityRole="button">
              {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>{saved ? t('owner.bank.update') : t('owner.bank.saveEnable')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
