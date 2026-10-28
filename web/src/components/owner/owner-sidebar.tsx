'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/actions/auth'
import {
  LayoutDashboard,
  Building2,
  CalendarDays,
  Tags,
  Wallet,
  RotateCcw,
  Repeat,
  BarChart3,
  Crown,
  LifeBuoy,
  LogOut,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { LogoMark, Wordmark } from '@/components/brand/logo'
const NAV_ITEMS = [
  {
    key: 'overview',
    href: '/owner/dashboard',
    icon: LayoutDashboard,
  },
  {
    key: 'clubs',
    href: '/owner/clubs',
    icon: Building2,
  },
  {
    key: 'schedule',
    href: '/owner/schedule',
    icon: CalendarDays,
  },
  {
    key: 'recurring',
    href: '/owner/recurring',
    icon: Repeat,
  },
  {
    key: 'analytics',
    href: '/owner/analytics',
    icon: BarChart3,
  },
  {
    key: 'pricing',
    href: '/owner/pricing',
    icon: Tags,
  },
  {
    key: 'payments',
    href: '/owner/payments',
    icon: Wallet,
  },
  {
    key: 'refunds',
    href: '/owner/refunds',
    icon: RotateCcw,
  },
  {
    key: 'billing',
    href: '/owner/billing',
    icon: Crown,
  },
  {
    key: 'support',
    href: '/support',
    icon: LifeBuoy,
  },
] as const

interface OwnerSidebarProps {
  userEmail?: string
  userName?: string
}

export function OwnerSidebar({ userEmail, userName }: OwnerSidebarProps) {
  const t = useTranslations('owner')
  const pathname = usePathname()

  return (
    <aside className="w-64 border-r border-border bg-card/60 backdrop-blur-md flex flex-col justify-between shrink-0 min-h-screen sticky top-0">
      <div>
        {/* Brand Header */}
        <div className="h-16 px-6 border-b border-border flex items-center gap-3">
          <LogoMark size={36} />
          <div className="flex flex-col gap-1">
            <Wordmark size={22} />
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              {t('sidebar.for')}
            </div>
          </div>
        </div>

        {/* Profile Card */}
        <div className="p-4 border-b border-border/50 bg-emerald-500/5 m-3 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 font-bold flex items-center justify-center border border-emerald-500/30">
              {userName ? userName.charAt(0).toUpperCase() : 'C'}
            </div>
            <div className="overflow-hidden">
              <div className="font-semibold text-sm truncate text-foreground">
                {userName || t('layout.defaultName')}
              </div>
              <div className="text-xs text-muted-foreground truncate">{userEmail}</div>
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between">
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs font-semibold">
              <ShieldCheck className="w-3 h-3 mr-1" />
              {t('sidebar.verified')}
            </Badge>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="p-3 space-y-1.5">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-700 text-white shadow-sm shadow-emerald-600/30 font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  <span>{t(`nav.${item.key}`)}</span>
                </div>
                {isActive && <ChevronRight className="w-4 h-4 text-white/70" />}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Logout Footer */}
      <div className="p-4 border-t border-border">
        <form action={logout}>
          <Button
            type="submit"
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
          >
            <LogOut className="w-4 h-4 mr-2" />
            {t('sidebar.logout')}
          </Button>
        </form>
      </div>
    </aside>
  )
}
