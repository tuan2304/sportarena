'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, ChevronRight, Home, LifeBuoy, LogOut, Megaphone, ShieldCheck, Wallet } from 'lucide-react'
import { logout } from '@/app/actions/auth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LogoMark, Wordmark } from '@/components/brand/logo'

const NAV_ITEMS = [
  { key: 'stats', href: '/admin', icon: BarChart3, exact: true },
  { key: 'tickets', href: '/admin/tickets', icon: LifeBuoy, exact: false },
  { key: 'announcements', href: '/admin/announcements', icon: Megaphone, exact: false },
  { key: 'plans', href: '/admin/finance', icon: Wallet, exact: false },
] as const

interface AdminSidebarProps {
  userName?: string
  userEmail?: string
  openTickets: number
}

export function AdminSidebar({ userName, userEmail, openTickets }: AdminSidebarProps) {
  const t = useTranslations('admin.sidebar')
  const pathname = usePathname()

  return (
    <aside className="w-64 border-r border-border bg-card/60 backdrop-blur-md flex flex-col justify-between shrink-0 min-h-screen sticky top-0">
      <div>
        <div className="h-16 px-6 border-b border-border flex items-center gap-3">
          <LogoMark size={36} />
          <div className="flex flex-col gap-1">
            <Wordmark size={22} />
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('platform')}</div>
          </div>
        </div>

        <div className="p-4 bg-amber-500/5 m-3 rounded-xl border border-amber-500/20">
          <div className="font-semibold text-sm truncate">{userName || t('defaultName')}</div>
          <div className="text-xs text-muted-foreground truncate">{userEmail}</div>
          <Badge variant="outline" className="mt-2 bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30 text-xs font-semibold">
            <ShieldCheck className="w-3 h-3 mr-1" aria-hidden />
            {t('role')}
          </Badge>
        </div>

        <nav className="p-3 space-y-1.5" aria-label={t('nav')}>
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
            const Icon = item.icon
            const showBadge = item.href === '/admin/tickets' && openTickets > 0
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-700 text-white shadow-sm shadow-emerald-600/30 font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="w-4 h-4" aria-hidden />
                  {t(item.key)}
                </span>
                {showBadge ? (
                  <span
                    className="min-w-5 h-5 px-1.5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center"
                    aria-label={t('openTickets', { count: openTickets })}
                  >
                    {openTickets > 99 ? '99+' : openTickets}
                  </span>
                ) : (
                  isActive && <ChevronRight className="w-4 h-4 text-white/70" aria-hidden />
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-border space-y-1">
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/80"
        >
          <Home className="w-4 h-4" aria-hidden /> {t('home')}
        </Link>
        <form action={logout}>
          <Button type="submit" variant="ghost" className="w-full justify-start text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 cursor-pointer">
            <LogOut className="w-4 h-4 mr-2" aria-hidden />
            {t('logout')}
          </Button>
        </form>
      </div>
    </aside>
  )
}
