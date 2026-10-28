import { redirect } from 'next/navigation'
import { getSupabase, getCurrentUser } from '@/lib/supabase/session'
import { LoginForm } from '@/components/auth/login-form'
import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { enabledAuthProviders, parseLoginError } from '@/lib/auth-providers'
import { safeNextPath } from '@/lib/zalo'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth')
  return { title: t('login.metaTitle'), description: t('login.metaDescription') }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams
  const t = await getTranslations('auth')
  const supabase = await getSupabase()
  const user = await getCurrentUser()

  // Nếu đã đăng nhập, điều hướng về trang chủ
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'admin') {
      redirect('/admin')
    } else if (profile?.role === 'owner') {
      redirect('/owner/dashboard')
    } else {
      redirect('/')
    }
  }

  const errorCode = parseLoginError(params.error)
  const next = safeNextPath(params.next, '')

  return (
    <LoginForm
      providers={enabledAuthProviders()}
      next={next || undefined}
      initialError={errorCode ? t(`errors.${errorCode}`) : null}
    />
  )
}
