'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveDisplayName, sendPhoneOtp, verifyPhoneOtp } from '@/app/actions/phone-auth'
import { maskPhone, OTP_LENGTH } from '@/lib/phone'

const RESEND_SECONDS = 60

type Step = 'phone' | 'code' | 'name'

/** Đăng nhập bằng OTP điện thoại: nhập số → nhập mã 6 số → (người mới) nhập họ tên. */
export function PhoneLogin({ next, onCancel }: { next?: string; onCancel: () => void }) {
  const t = useTranslations('auth.phone')
  const [step, setStep] = useState<Step>('phone')
  const [phoneInput, setPhoneInput] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function send(e?: React.FormEvent) {
    e?.preventDefault()
    setError(null)
    setLoading(true)
    const res = await sendPhoneOtp(phoneInput || phone)
    setLoading(false)
    if (res.error || !res.phone) {
      setError(res.error ?? t('sendFailed'))
      return
    }
    setPhone(res.phone)
    setCode('')
    setCooldown(RESEND_SECONDS)
    setStep('code')
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    // Thành công thì server chuyển trang (redirect) nên không có kết quả để xử lý ở nhánh đó
    const res = await verifyPhoneOtp(phone, code, next)
    setLoading(false)
    if (res?.error) setError(res.error)
    else if (res?.needsName) setStep('name')
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const res = await saveDisplayName(name, next)
    setLoading(false)
    if (res?.error) setError(res.error)
  }

  const submitClass = 'w-full h-10 bg-emerald-700 hover:bg-emerald-800 text-white font-medium cursor-pointer'

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
      {error && (
        <div role="alert" className="flex items-center gap-2 p-2.5 text-xs text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {step === 'phone' && (
        <form onSubmit={send} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="phone-login">{t('phoneLabel')}</Label>
            <Input
              id="phone-login"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0901 234 567"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              required
              className="h-10"
            />
            <p className="text-xs text-muted-foreground">{t('phoneHint')}</p>
          </div>
          <Button type="submit" disabled={loading} className={submitClass}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />}
            {t('sendCode')}
          </Button>
          <button type="button" onClick={onCancel} className="w-full text-xs text-muted-foreground hover:underline cursor-pointer">
            {t('cancel')}
          </button>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={verify} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="otp-code">{t('codeLabel', { phone: maskPhone(phone) })}</Label>
            <Input
              id="otp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={OTP_LENGTH + 2}
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              autoFocus
              className="h-10 text-center tracking-[0.4em] text-lg"
            />
          </div>
          <Button type="submit" disabled={loading} className={submitClass}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />}
            {t('verify')}
          </Button>
          <div className="flex items-center justify-between text-xs">
            <button type="button" onClick={() => setStep('phone')} className="text-muted-foreground hover:underline cursor-pointer">
              {t('changePhone')}
            </button>
            <button
              type="button"
              disabled={cooldown > 0 || loading}
              onClick={() => send()}
              className="text-emerald-700 dark:text-emerald-400 hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer"
            >
              {cooldown > 0 ? t('resendIn', { seconds: cooldown }) : t('resend')}
            </button>
          </div>
        </form>
      )}

      {step === 'name' && (
        <form onSubmit={saveName} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="otp-name">{t('nameLabel')}</Label>
            <Input id="otp-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={100} autoFocus className="h-10" />
            <p className="text-xs text-muted-foreground">{t('nameHint')}</p>
          </div>
          <Button type="submit" disabled={loading} className={submitClass}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />}
            {t('finish')}
          </Button>
        </form>
      )}
    </div>
  )
}
