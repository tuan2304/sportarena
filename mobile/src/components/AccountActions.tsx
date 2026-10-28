import React, { useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Download, Trash2 } from 'lucide-react-native'
import { colors } from '../theme/colors'
import { useI18n } from '../i18n'
import { supabase } from '../lib/supabase'
import { apiGet, apiPost } from '../lib/api'
import { unregisterPush } from '../lib/push'

/**
 * Quyền của chủ dữ liệu ngay trong app: tải bản sao dữ liệu và xóa tài khoản
 * (Apple App Store 5.1.1(v), Google Play, Nghị định 13/2023/NĐ-CP). Mọi quy tắc nằm ở máy chủ.
 */
interface Props {
  /** Tài khoản đăng ký bằng email + mật khẩu phải nhập lại mật khẩu; đăng nhập OTP/Zalo/Google/Apple thì không có mật khẩu */
  needsPassword: boolean
  onDeleted: () => void
}

export default function AccountActions({ needsPassword, onDeleted }: Props) {
  const { t, lang } = useI18n()
  const phrase = lang === 'vi' ? 'XÓA' : 'DELETE'
  const [exporting, setExporting] = useState(false)
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function exportData() {
    setExporting(true)
    const res = await apiGet<{ filename: string; data: unknown }>('/api/mobile/account/export')
    setExporting(false)
    if (!res.ok) {
      Alert.alert(t('profile.account.exportFailed'), res.error)
      return
    }
    try {
      // Bảng chia sẻ của hệ điều hành: người dùng tự chọn lưu vào Tệp, gửi email hoặc ghi chú
      await Share.share({ title: res.data.filename, message: JSON.stringify(res.data.data, null, 2) })
    } catch {
      Alert.alert(t('profile.account.exportFailed'), t('profile.account.shareFailed'))
    }
  }

  function closeDialog() {
    if (deleting) return
    setOpen(false)
    setPassword('')
    setConfirmation('')
    setError(null)
  }

  async function deleteAccount() {
    setError(null)
    setDeleting(true)
    const res = await apiPost<{ success: boolean }>('/api/mobile/account/delete', {
      confirmation,
      ...(needsPassword ? { password } : {}),
    })
    if (!res.ok) {
      setDeleting(false)
      setError(res.error)
      return
    }
    // Máy chủ đã vô hiệu phiên; dọn dữ liệu cục bộ rồi về màn hình đăng nhập
    await unregisterPush().catch(() => {})
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    setDeleting(false)
    setOpen(false)
    setPassword('')
    setConfirmation('')
    onDeleted()
    Alert.alert(t('common.notice'), t('profile.account.deleted'))
  }

  const canSubmit = confirmation.trim().length > 0 && (!needsPassword || password.length > 0) && !deleting

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('profile.account.title')}</Text>

      <TouchableOpacity style={styles.row} onPress={exportData} disabled={exporting} accessibilityRole="button">
        {exporting ? <ActivityIndicator size="small" color={colors.primary} /> : <Download size={18} color={colors.primary} />}
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{t('profile.account.exportTitle')}</Text>
          <Text style={styles.rowHint}>{t('profile.account.exportHint')}</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.row} onPress={() => setOpen(true)} accessibilityRole="button">
        <Trash2 size={18} color={colors.danger} />
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: colors.danger }]}>{t('profile.account.deleteTitle')}</Text>
          <Text style={styles.rowHint}>{t('profile.account.deleteHint')}</Text>
        </View>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={closeDialog}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>{t('profile.account.dialogTitle')}</Text>
            <Text style={styles.dialogText}>{t('profile.account.willDelete')}</Text>
            <Text style={styles.dialogText}>{t('profile.account.willKeep')}</Text>
            <Text style={styles.dialogText}>{t('profile.account.ownerNote')}</Text>

            {needsPassword && (
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder={t('profile.account.passwordLabel')}
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="current-password"
                editable={!deleting}
                accessibilityLabel={t('profile.account.passwordLabel')}
              />
            )}
            <TextInput
              style={styles.input}
              value={confirmation}
              onChangeText={setConfirmation}
              placeholder={t('profile.account.confirmLabel', { phrase })}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!deleting}
              accessibilityLabel={t('profile.account.confirmLabel', { phrase })}
            />

            {error && (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            )}

            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeDialog} disabled={deleting} accessibilityRole="button">
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteBtn, !canSubmit && styles.deleteBtnDisabled]}
                onPress={deleteAccount}
                disabled={!canSubmit}
                accessibilityRole="button"
              >
                {deleting ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.deleteText}>{t('profile.account.confirm')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.cardBorder, gap: 4 },
  title: { fontSize: 15, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  rowHint: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 17 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  dialog: { backgroundColor: colors.card, borderRadius: 16, padding: 20, gap: 10, borderWidth: 1, borderColor: colors.cardBorder },
  dialogTitle: { fontSize: 17, fontWeight: 'bold', color: colors.textPrimary },
  dialogText: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  input: {
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  error: { color: colors.danger, fontSize: 12, lineHeight: 17 },
  actions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 4 },
  cancelBtn: { minHeight: 44, paddingHorizontal: 18, borderRadius: 10, justifyContent: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  cancelText: { color: colors.textSecondary, fontWeight: '600', fontSize: 14 },
  deleteBtn: { minHeight: 44, minWidth: 120, paddingHorizontal: 18, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.danger },
  deleteBtnDisabled: { opacity: 0.45 },
  deleteText: { color: colors.white, fontWeight: 'bold', fontSize: 14 },
})
