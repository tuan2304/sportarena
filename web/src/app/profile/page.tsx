import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSupabase, getCurrentUser } from '@/lib/supabase/session'
import { MainHeader } from '@/components/layout/main-header'
import { ProfileForm } from '@/components/profile/profile-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronRight, ExternalLink, LifeBuoy, LogOut } from 'lucide-react'
import { logout } from '@/app/actions/auth'

export async function generateMetadata() {
  const t = await getTranslations('profile')
  return { title: t('metaTitle'), robots: { index: false, follow: false } }
}

export default async function ProfilePage() {
  const t = await getTranslations('profile')
  const tm = await getTranslations('profile.mobile')
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/profile')

  const supabase = await getSupabase()
  // Số điện thoại bị khóa đọc trực tiếp; hàm này chỉ trả hồ sơ của chính người gọi
  const { data } = await supabase.rpc('get_my_profile')
  const profile = data?.[0]

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <MainHeader />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{t('heading')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
          </div>
          <Link href={`/players/${user.id}`}>
            <Button variant="outline" size="sm" className="cursor-pointer">
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" aria-hidden />
              {t('viewPublic')}
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('cardTitle')}</CardTitle>
            <CardDescription>{t('cardDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm
              userId={user.id}
              initial={{
                fullName: profile?.full_name ?? '',
                phone: profile?.phone_number ?? '',
                skillLevel: profile?.skill_level ?? 'intermediate',
                avatarUrl: profile?.avatar_url ?? null,
              }}
            />
          </CardContent>
        </Card>

        {/* Điện thoại không có menu đầu trang đầy đủ nên hỗ trợ và đăng xuất để ở đây */}
        <Card className="md:hidden">
          <CardContent className="p-0 divide-y divide-border/70">
            <Link href="/support" className="flex min-h-14 items-center gap-3 px-4 py-3 active:bg-muted/60">
              <LifeBuoy className="h-5 w-5 text-sky-600 dark:text-sky-400" aria-hidden />
              <span className="flex-1">
                <span className="block text-sm font-semibold">{tm('support')}</span>
                <span className="block text-xs text-muted-foreground">{tm('supportHint')}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
            </Link>
            <form action={logout}>
              <button type="submit" className="flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 py-3 text-left active:bg-muted/60">
                <LogOut className="h-5 w-5 text-red-600 dark:text-red-400" aria-hidden />
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-red-700 dark:text-red-400">{tm('logout')}</span>
                  <span className="block text-xs text-muted-foreground">{tm('logoutHint')}</span>
                </span>
              </button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
