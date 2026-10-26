import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth')
  return { title: t('forgot.metaTitle'), description: t('forgot.metaDescription') }
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />
}
