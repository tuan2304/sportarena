import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getSupabase } from '@/lib/supabase/session'
import { hasRecoverySession } from '@/lib/password-reset-server'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth')
  return {
    title: t('reset.metaTitle'),
    description: t('reset.metaDescription'),
    // Trang chỉ dùng được qua liên kết trong thư, và địa chỉ có thể chứa token
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  }
}

export default async function ResetPasswordPage() {
  // Không chuyển người đã đăng nhập đi nơi khác: họ có thể vừa bấm liên kết trong thư ngay trên trình duyệt đang đăng nhập
  const recoveryActive = await hasRecoverySession(await getSupabase())
  return <ResetPasswordForm recoveryActive={recoveryActive} />
}
