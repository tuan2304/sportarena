'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { PhoneLogin } from '@/components/auth/phone-login'
import type { AuthProviders } from '@/lib/auth-providers'

interface SocialLoginProps {
  providers: AuthProviders
  /** Trang cần quay lại sau khi đăng nhập (đường dẫn nội bộ) */
  next?: string
  onError: (message: string) => void
}

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden>
    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
    <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
    <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z" />
    <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.8 3.6-4.9 6.7-4.9z" />
  </svg>
)

const AppleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden>
    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
  </svg>
)

const ZaloIcon = () => (
  <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-[#0068ff] text-white text-[9px] font-black leading-none" aria-hidden>
    Z
  </span>
)

/** Các cách đăng nhập ngoài email + mật khẩu: Google, Apple, Zalo và OTP điện thoại. Chỉ hiện nút của nhà cung cấp đã bật. */
export function SocialLogin({ providers, next, onError }: SocialLoginProps) {
  const t = useTranslations('auth.social')
  const [busy, setBusy] = useState<'google' | 'apple' | null>(null)
  const [phoneOpen, setPhoneOpen] = useState(false)

  async function oauth(provider: 'google' | 'apple') {
    setBusy(provider)
    onError('')
    const callback = new URL('/auth/callback', window.location.origin)
    if (next) callback.searchParams.set('next', next)
    const { error } = await createClient().auth.signInWithOAuth({ provider, options: { redirectTo: callback.toString() } })
    if (error) {
      onError(t('failed'))
      setBusy(null)
    }
    // Thành công: trình duyệt đang chuyển sang trang của nhà cung cấp
  }

  const zaloHref = `/api/auth/zalo/start${next ? `?next=${encodeURIComponent(next)}` : ''}`
  const buttonClass = 'w-full h-10 gap-2 cursor-pointer'

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs text-muted-foreground" role="separator">
        <span className="h-px flex-1 bg-border" />
        {t('or')}
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="grid gap-2">
        {providers.google && (
          <Button type="button" variant="outline" className={buttonClass} disabled={busy !== null} onClick={() => oauth('google')}>
            {busy === 'google' ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
            {t('google')}
          </Button>
        )}
        {providers.apple && (
          <Button type="button" variant="outline" className={buttonClass} disabled={busy !== null} onClick={() => oauth('apple')}>
            {busy === 'apple' ? <Loader2 className="w-4 h-4 animate-spin" /> : <AppleIcon />}
            {t('apple')}
          </Button>
        )}
        {providers.zalo && (
          <a href={zaloHref} className="block">
            <Button type="button" variant="outline" className={buttonClass} disabled={busy !== null} tabIndex={-1}>
              <ZaloIcon />
              {t('zalo')}
            </Button>
          </a>
        )}
        {providers.phone && !phoneOpen && (
          <Button type="button" variant="outline" className={buttonClass} onClick={() => setPhoneOpen(true)}>
            <Smartphone className="w-4 h-4" aria-hidden />
            {t('phone')}
          </Button>
        )}
      </div>

      {providers.phone && phoneOpen && <PhoneLogin next={next} onCancel={() => setPhoneOpen(false)} />}
    </div>
  )
}
