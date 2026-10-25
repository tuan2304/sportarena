import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSupabase, getCurrentUser } from '@/lib/supabase/session'
import { OwnerSidebar } from '@/components/owner/owner-sidebar'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { NotificationBell } from '@/components/notifications/notification-bell'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('owner.layout')
  return { title: t('metaTitle'), robots: { index: false, follow: false } }
}

export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = await getTranslations('owner.layout')
  const supabase = await getSupabase()
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  // Lấy thông tin profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'owner' && profile?.role !== 'admin') {
    redirect('/')
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <OwnerSidebar
        userEmail={user.email}
        userName={profile?.full_name || t('defaultName')}
      />
      <main className="flex-1 flex flex-col min-w-0 bg-muted/20">
        <header className="h-16 border-b border-border/80 px-8 flex items-center justify-between bg-card/40 backdrop-blur-sm sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              {t('badge')}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <ThemeToggle />
            <NotificationBell userId={user.id} />
            <span>{t('system')} <strong className="text-emerald-700 dark:text-emerald-400 font-semibold">{t('realtime')}</strong></span>
          </div>
        </header>

        <div className="p-8 flex-1">
          {children}
        </div>
      </main>
    </div>
  )
}
