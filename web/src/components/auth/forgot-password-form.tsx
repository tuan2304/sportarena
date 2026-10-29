'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { requestPasswordReset } from '@/app/actions/password'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, ArrowLeft, Loader2, MailCheck } from 'lucide-react'
import { LogoMark } from '@/components/brand/logo'

/** Nhập email để nhận liên kết đặt lại mật khẩu. Kết quả luôn như nhau dù email có tài khoản hay không. */
export function ForgotPasswordForm() {
  const t = useTranslations('auth')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await requestPasswordReset(formData)
    setLoading(false)

    if (result.error) setError(result.error)
    else setSentTo(String(formData.get('email') ?? '').trim())
  }

  if (sentTo) {
    return (
      <Card className="w-full max-w-md shadow-xl border-emerald-500/20 bg-card/90 backdrop-blur-sm">
        <CardHeader className="space-y-2 text-center pb-4">
          <MailCheck className="mx-auto w-12 h-12 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">{t('forgot.sentTitle')}</CardTitle>
          <CardDescription className="text-muted-foreground text-sm">{t('forgot.sentText', { email: sentTo })}</CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            className="w-full h-10 cursor-pointer"
            onClick={() => {
              setSentTo(null)
              setError(null)
            }}
          >
            {t('forgot.sendAgain')}
          </Button>
          <Link href="/login" className="inline-block py-2.5 -my-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">
            {t('forgot.backToLogin')}
          </Link>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md shadow-xl border-emerald-500/20 bg-card/90 backdrop-blur-sm">
      <CardHeader className="space-y-2 text-center pb-6">
        <LogoMark size={56} className="mx-auto drop-shadow-sm" decorative={false} />
        <CardTitle className="text-2xl font-bold tracking-tight text-foreground">{t('forgot.title')}</CardTitle>
        <CardDescription className="text-muted-foreground text-sm">{t('forgot.subtitle')}</CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div role="alert" className="flex items-center gap-2 p-3 text-sm text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder={t('login.emailPlaceholder')}
              required
              className="h-10 focus-visible:ring-emerald-500"
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4 pt-2">
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-emerald-700 hover:bg-emerald-800 text-white font-medium shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('forgot.sending')}
              </>
            ) : (
              t('forgot.submit')
            )}
          </Button>

          <Link href="/login" className="inline-flex items-center gap-1 py-2.5 -my-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">
            <ArrowLeft className="w-3 h-3" aria-hidden />
            {t('forgot.backToLogin')}
          </Link>
        </CardFooter>
      </form>
    </Card>
  )
}
