import { redirect } from 'next/navigation'
import { getSupabase, getCurrentUser } from '@/lib/supabase/session'
import { RegisterForm } from '@/components/auth/register-form'
import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { enabledAuthProviders } from '@/lib/auth-providers'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth')
  return { title: t('register.metaTitle'), description: t('register.metaDescription') }
}

export default async function RegisterPage() {
  const supabase = await getSupabase()
  const user = await getCurrentUser()

  // Nếu đã đăng nhập, điều hướng về trang chủ phù hợp
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'owner') {
      redirect('/owner/dashboard')
    } else {
      redirect('/')
    }
  }

  return <RegisterForm providers={enabledAuthProviders()} />
}
