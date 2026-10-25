import { redirect } from 'next/navigation'
import { getSupabase, getCurrentUser } from '@/lib/supabase/session'
import { LoginForm } from '@/components/auth/login-form'
import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth')
  return { title: t('login.metaTitle'), description: t('login.metaDescription') }
}

export default async function LoginPage() {
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

  return <LoginForm />
}
