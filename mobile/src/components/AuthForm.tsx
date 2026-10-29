import { useI18n } from '../i18n'
import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { colors } from '../theme/colors'
import { supabase } from '../lib/supabase'
import { apiPostPublic } from '../lib/api'
import SocialAuth from './SocialAuth'

const MIN_PASSWORD = 8 // khớp với web (actions/auth.ts)
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface AuthFormProps {
  onSignedIn: () => void
}

/**
 * Đăng nhập / đăng ký bằng email và mật khẩu, và quên mật khẩu (gửi thư qua API của máy chủ; liên kết trong thư mở trang
 * đặt lại của web ngay trên trình duyệt điện thoại). Tài khoản đăng ký ở app luôn là người chơi; chủ sân đăng ký trên web.
 */
export default function AuthForm({ onSignedIn }: AuthFormProps) {
  const { t } = useI18n()
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isRegister = mode === 'register'
  const isForgot = mode === 'forgot'

  async function sendResetLink(mail: string) {
    setBusy(true)
    try {
      const res = await apiPostPublic<{ success: boolean }>('/api/mobile/auth/forgot-password', { email: mail })
      if (!res.ok) return setError(res.error)
      Alert.alert(t('auth.forgotSentTitle'), t('auth.forgotSentText', { email: mail }))
      setMode('login')
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    setError(null)
    const mail = email.trim().toLowerCase()
    if (!EMAIL.test(mail)) return setError(t('auth.invalidEmail'))
    if (isForgot) return sendResetLink(mail)
    if (!password) return setError(t('auth.needPassword'))
    if (isRegister) {
      if (fullName.trim().length < 2) return setError(t('auth.nameShort'))
      if (password.length < MIN_PASSWORD) return setError(t('auth.passwordShort', { min: MIN_PASSWORD }))
    }

    setBusy(true)
    try {
      if (isRegister) {
        const { data, error: err } = await supabase.auth.signUp({
          email: mail,
          password,
          options: { data: { full_name: fullName.trim(), role: 'player' } },
        })
        if (err) return setError(err.message || t('auth.createFailed'))
        if (!data.session) {
          // Dự án bật xác nhận email: chưa có phiên cho tới khi bấm link trong thư
          Alert.alert(t('auth.checkEmailTitle'), t('auth.checkEmailText'))
          setMode('login')
          return
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email: mail, password })
        if (err) return setError(t('auth.wrong'))
      }
      setPassword('')
      onSignedIn()
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{isForgot ? t('auth.forgotTitle') : isRegister ? t('auth.createTitle') : t('auth.loginTitle')}</Text>
      <Text style={styles.sub}>{isForgot ? t('auth.forgotSub') : t('auth.subtitle')}</Text>

      {isRegister && (
        <TextInput
          style={styles.input}
          placeholder={t('auth.fullName')}
          placeholderTextColor={colors.textMuted}
          value={fullName}
          onChangeText={setFullName}
          autoComplete="name"
          textContentType="name"
          maxLength={60}
        />
      )}
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.textMuted}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
      />
      {!isForgot && (
        <TextInput
          style={styles.input}
          placeholder={isRegister ? t('auth.passwordPlaceholderNew', { min: MIN_PASSWORD }) : t('auth.passwordPlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          textContentType={isRegister ? 'newPassword' : 'password'}
          onSubmitEditing={submit}
        />
      )}

      {mode === 'login' && (
        <TouchableOpacity
          onPress={() => {
            setMode('forgot')
            setError(null)
          }}
          style={styles.forgot}
          accessibilityRole="button"
        >
          <Text style={styles.switchText}>{t('auth.forgot')}</Text>
        </TouchableOpacity>
      )}

      {error && (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      )}

      <TouchableOpacity style={[styles.btn, busy && styles.btnDisabled]} onPress={submit} disabled={busy} accessibilityRole="button">
        {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.btnText}>{isForgot ? t('auth.sendLink') : isRegister ? t('auth.register') : t('auth.loginTitle')}</Text>}
      </TouchableOpacity>

      {!isForgot && <SocialAuth onSignedIn={onSignedIn} onError={setError} />}

      <TouchableOpacity
        onPress={() => {
          setMode(isRegister || isForgot ? 'login' : 'register')
          setError(null)
        }}
        style={styles.switch}
      >
        <Text style={styles.switchText}>{isForgot ? t('auth.backToLogin') : isRegister ? t('auth.switchToLogin') : t('auth.switchToRegister')}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { padding: 18, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, gap: 12 },
  title: { color: colors.textPrimary, fontWeight: '800', fontSize: 20 },
  sub: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  input: {
    minHeight: 46,
    borderRadius: 10,
    paddingHorizontal: 14,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    fontSize: 14,
  },
  error: { color: colors.danger, fontSize: 13 },
  btn: { minHeight: 48, borderRadius: 12, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  switch: { minHeight: 40, justifyContent: 'center', alignItems: 'center' },
  forgot: { minHeight: 36, justifyContent: 'center', alignSelf: 'flex-end' },
  switchText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
})
