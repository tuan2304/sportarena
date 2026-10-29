'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { login } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowRight, Loader2, AlertCircle } from 'lucide-react'

import { LogoMark } from '@/components/brand/logo'
import { SocialLogin } from '@/components/auth/social-login'
import { hasAnyProvider, type AuthProviders } from '@/lib/auth-providers'

interface LoginFormProps {
  providers?: AuthProviders
  /** Trang cần quay lại sau khi đăng nhập */
  next?: string
  /** Lỗi từ luồng đăng nhập ngoài (Google/Apple/Zalo) do trang đăng nhập đọc từ ?error= */
  initialError?: string | null
}

export function LoginForm({ providers, next, initialError = null }: LoginFormProps = {}) {
  const t = useTranslations('auth')
  const [error, setError] = useState<string | null>(initialError)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await login(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md shadow-xl border-emerald-500/20 bg-card/90 backdrop-blur-sm">
      <CardHeader className="space-y-2 text-center pb-6">
        <LogoMark size={56} className="mx-auto drop-shadow-sm" decorative={false} />
        <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
          {t('login.title')}
        </CardTitle>
        <CardDescription className="text-muted-foreground text-sm">
          {t('login.subtitle')}
        </CardDescription>
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
              placeholder={t('login.emailPlaceholder')}
              required
              className="h-10 focus-visible:ring-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t('passwordLabel')}</Label>
              <Link
                href="/forgot-password"
                className="inline-block py-2.5 -my-2.5 text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-500 hover:underline"
              >
                {t('login.forgot')}
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
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
                {t('login.processing')}
              </>
            ) : (
              <>
                {t('login.submit')}
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>

          {providers && hasAnyProvider(providers) && (
            <div className="w-full">
              <SocialLogin providers={providers} next={next} onError={(message) => setError(message || null)} />
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            {t('login.noAccount')}{' '}
            <Link
              href="/register"
              className="inline-block py-2.5 -my-2.5 font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-500 hover:underline"
            >
              {t('login.signUpNow')}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
