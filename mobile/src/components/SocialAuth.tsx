import React, { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import * as Crypto from 'expo-crypto'
import { colors } from '../theme/colors'
import { supabase } from '../lib/supabase'
import { apiPostPublic } from '../lib/api'
import { AUTH_REDIRECT, base64Url, hexFromBytes, parseAuthRedirect, parseProviders } from '../lib/auth-redirect'
import { useI18n } from '../i18n'

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '')
const PROVIDERS = parseProviders(process.env.EXPO_PUBLIC_AUTH_PROVIDERS)
const RESEND_SECONDS = 60

/** Số điện thoại Việt Nam nhập kiểu 0901234567 / 84901234567 / +84... → +84901234567 (khớp web/src/lib/phone.ts); số quốc tế cần dấu + */
function normalizePhone(input: string): string | null {
  const compact = input.trim().replace(/[\s().-]/g, '')
  if (!/^\+?\d+$/.test(compact)) return null
  const digits = compact.replace(/\D/g, '')
  if (compact.startsWith('+')) return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null
  if (/^84[35789]\d{8}$/.test(digits)) return `+${digits}`
  const vn = /^0([35789]\d{8})$/.exec(digits)
  return vn ? `+84${vn[1]}` : null
}

interface Props {
  onSignedIn: () => void
  onError: (message: string | null) => void
}

/**
 * Đăng nhập bằng Google, Apple, Zalo (qua trình duyệt trong app) và OTP điện thoại. Chỉ hiện nút của nhà cung cấp được
 * khai báo trong EXPO_PUBLIC_AUTH_PROVIDERS (sau khi đã bật phía Supabase / web). Tài khoản mới luôn là người chơi.
 */
export default function SocialAuth({ onSignedIn, onError }: Props) {
  const { t } = useI18n()
  const [busy, setBusy] = useState<'google' | 'apple' | 'zalo' | 'phone' | null>(null)
  const [phoneOpen, setPhoneOpen] = useState(false)
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phoneInput, setPhoneInput] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  if (!PROVIDERS.google && !PROVIDERS.apple && !PROVIDERS.phone && !PROVIDERS.zalo) return null

  async function finish(url: string, verifier?: string): Promise<boolean> {
    const parsed = parseAuthRedirect(url)
    if (parsed.kind === 'session') {
      const { error } = await supabase.auth.setSession({ access_token: parsed.accessToken, refresh_token: parsed.refreshToken })
      return !error
    }
    if (parsed.kind === 'code') {
      const { error } = await supabase.auth.exchangeCodeForSession(parsed.code)
      return !error
    }
    if (parsed.kind === 'ticket' && verifier) {
      const res = await apiPostPublic<{ access_token: string; refresh_token: string }>('/api/auth/zalo/exchange', { ticket: parsed.ticket, verifier })
      if (!res.ok) return false
      const { error } = await supabase.auth.setSession({ access_token: res.data.access_token, refresh_token: res.data.refresh_token })
      return !error
    }
    return false
  }

  async function oauth(provider: 'google' | 'apple') {
    onError(null)
    setBusy(provider)
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: AUTH_REDIRECT, skipBrowserRedirect: true } })
      if (error || !data.url) return onError(t('auth.social.failed'))
      const result = await WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT)
      if (result.type !== 'success') return // người dùng đóng trình duyệt
      if (await finish(result.url)) onSignedIn()
      else onError(t('auth.social.failed'))
    } catch {
      onError(t('auth.social.failed'))
    } finally {
      setBusy(null)
    }
  }

  async function zalo() {
    onError(null)
    if (!API_URL) return onError(t('api.noServer'))
    setBusy('zalo')
    try {
      // PKCE cho app: verifier giữ kín trong máy, chỉ gửi challenge; web trả "vé" chỉ đổi được khi có đúng verifier
      const verifier = hexFromBytes(Crypto.getRandomBytes(32))
      const challenge = base64Url(await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 }))
      const result = await WebBrowser.openAuthSessionAsync(`${API_URL}/api/auth/zalo/start?app_challenge=${challenge}`, AUTH_REDIRECT)
      if (result.type !== 'success') return
      if (await finish(result.url, verifier)) onSignedIn()
      else onError(t('auth.social.zaloFailed'))
    } catch {
      onError(t('auth.social.zaloFailed'))
    } finally {
      setBusy(null)
    }
  }

  async function sendCode() {
    onError(null)
    const normalized = normalizePhone(phone || phoneInput)
    if (!normalized) return onError(t('auth.phone.invalid'))
    setBusy('phone')
    const { error } = await supabase.auth.signInWithOtp({ phone: normalized, options: { channel: 'sms', shouldCreateUser: true } })
    setBusy(null)
    if (error) return onError(t('auth.phone.sendFailed'))
    setPhone(normalized)
    setCode('')
    setCooldown(RESEND_SECONDS)
    setStep('code')
  }

  async function verifyCode() {
    onError(null)
    const token = code.replace(/\s+/g, '')
    if (!/^\d{6}$/.test(token)) return onError(t('auth.phone.badCode'))
    setBusy('phone')
    const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
    setBusy(null)
    if (error || !data.session) return onError(t('auth.phone.badCode'))
    onSignedIn()
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.sep}>
        <View style={styles.line} />
        <Text style={styles.sepText}>{t('auth.social.or')}</Text>
        <View style={styles.line} />
      </View>

      {PROVIDERS.google && <Button label={t('auth.social.google')} busy={busy === 'google'} disabled={busy !== null} onPress={() => oauth('google')} />}
      {PROVIDERS.apple && <Button label={t('auth.social.apple')} busy={busy === 'apple'} disabled={busy !== null} onPress={() => oauth('apple')} />}
      {PROVIDERS.zalo && <Button label={t('auth.social.zalo')} busy={busy === 'zalo'} disabled={busy !== null} onPress={zalo} />}
      {PROVIDERS.phone && !phoneOpen && <Button label={t('auth.social.phone')} busy={false} disabled={busy !== null} onPress={() => setPhoneOpen(true)} />}

      {PROVIDERS.phone && phoneOpen && (
        <View style={styles.phoneBox}>
          {step === 'phone' ? (
            <>
              <TextInput
                style={styles.input}
                value={phoneInput}
                onChangeText={setPhoneInput}
                placeholder="0901 234 567"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
              />
              <Text style={styles.hint}>{t('auth.phone.hint')}</Text>
              <Button label={t('auth.phone.sendCode')} busy={busy === 'phone'} disabled={busy !== null} onPress={sendCode} primary />
            </>
          ) : (
            <>
              <Text style={styles.hint}>{t('auth.phone.codeLabel', { phone })}</Text>
              <TextInput
                style={[styles.input, styles.code]}
                value={code}
                onChangeText={setCode}
                placeholder="••••••"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                autoComplete="sms-otp"
                textContentType="oneTimeCode"
                maxLength={8}
              />
              <Button label={t('auth.phone.verify')} busy={busy === 'phone'} disabled={busy !== null} onPress={verifyCode} primary />
              <View style={styles.links}>
                <TouchableOpacity onPress={() => setStep('phone')} style={styles.link}>
                  <Text style={styles.linkText}>{t('auth.phone.changePhone')}</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={cooldown > 0 || busy !== null} onPress={sendCode} style={styles.link}>
                  <Text style={[styles.linkText, cooldown > 0 && styles.linkOff]}>{cooldown > 0 ? t('auth.phone.resendIn', { seconds: cooldown }) : t('auth.phone.resend')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
          <TouchableOpacity onPress={() => setPhoneOpen(false)} style={styles.link}>
            <Text style={styles.linkText}>{t('auth.phone.cancel')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

function Button({ label, busy, disabled, onPress, primary = false }: { label: string; busy: boolean; disabled: boolean; onPress: () => void; primary?: boolean }) {
  return (
    <TouchableOpacity style={[styles.btn, primary && styles.btnPrimary, disabled && styles.btnDisabled]} disabled={disabled} onPress={onPress} accessibilityRole="button">
      {busy ? <ActivityIndicator color={primary ? colors.white : colors.primary} /> : <Text style={[styles.btnText, primary && styles.btnTextPrimary]}>{label}</Text>}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  sep: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { flex: 1, height: 1, backgroundColor: colors.cardBorder },
  sepText: { color: colors.textMuted, fontSize: 12 },
  btn: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: colors.textPrimary, fontWeight: '700', fontSize: 14 },
  btnTextPrimary: { color: colors.white, fontWeight: '800' },
  phoneBox: { gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder },
  input: { minHeight: 46, borderRadius: 10, paddingHorizontal: 14, color: colors.textPrimary, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder, fontSize: 14 },
  code: { textAlign: 'center', fontSize: 20, letterSpacing: 6 },
  hint: { color: colors.textSecondary, fontSize: 12, lineHeight: 17 },
  links: { flexDirection: 'row', justifyContent: 'space-between' },
  link: { minHeight: 36, justifyContent: 'center' },
  linkText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  linkOff: { opacity: 0.5 },
})
