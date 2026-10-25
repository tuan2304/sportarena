import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser, getCurrentProfile } from '@/lib/supabase/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminSidebar } from '@/components/admin/admin-sidebar'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { NotificationBell } from '@/components/notifications/notification-bell'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.layout')
  return { title: t('metaTitle'), robots: { index: false, follow: false } }
}

/** Khu vực chỉ dành cho quản trị nền tảng: mọi trang con đều đi qua kiểm tra này. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('admin.layout')
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/admin')
  const profile = await getCurrentProfile()
  if (profile?.role !== 'admin') redirect('/')

  const { count } = await createAdminClient()
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open')

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <AdminSidebar userName={profile.full_name || undefined} userEmail={user.email} openTickets={count ?? 0} />
      <main className="flex-1 flex flex-col min-w-0 bg-muted/20">
        <header className="h-16 border-b border-border/80 px-8 flex items-center justify-between bg-card/40 backdrop-blur-sm sticky top-0 z-20">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30">
            {t('badge')}
          </span>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <NotificationBell userId={user.id} />
          </div>
        </header>
        <div className="p-8 flex-1">{children}</div>
      </main>
    </div>
  )
}
