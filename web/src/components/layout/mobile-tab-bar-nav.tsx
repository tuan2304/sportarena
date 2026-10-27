'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, Calendar, Compass, Flame, LogIn, ShieldCheck, User, type LucideIcon } from 'lucide-react'

export interface TabItem {
  key: 'explore' | 'matches' | 'bookings' | 'owner' | 'admin' | 'profile' | 'login'
  href: string
  label: string
  /** Đường dẫn bắt đầu bằng một trong các tiền tố này thì tab được coi là đang mở */
  match: string[]
}

const ICONS: Record<TabItem['key'], LucideIcon> = {
  explore: Compass,
  matches: Flame,
  bookings: Calendar,
  owner: Building2,
  admin: ShieldCheck,
  profile: User,
  login: LogIn,
}

/** Khu chủ sân/quản trị có thanh điều hướng riêng, các màn hình đăng nhập thì cần tập trung nên không hiện thanh dưới */
const HIDDEN_PREFIXES = ['/login', '/register', '/forgot-password', '/reset-password', '/owner', '/admin']

function isActive(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export function MobileTabBarNav({ items, label }: { items: TabItem[]; label: string }) {
  const pathname = usePathname()
  if (isActive(pathname, HIDDEN_PREFIXES)) return null

  return (
    <>
      <nav
        aria-label={label}
        data-testid="mobile-tab-bar"
        className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/92 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="grid grid-flow-col auto-cols-fr">
          {items.map((item) => {
            const Icon = ICONS[item.key]
            const active = isActive(pathname, item.match)
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors active:bg-muted/60 ${
                    active ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'
                  }`}
                >
                  {active && <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-full bg-emerald-600 dark:bg-emerald-400" />}
                  <Icon className={`h-5 w-5 ${active ? 'stroke-[2.4]' : ''}`} aria-hidden />
                  <span className="max-w-full truncate px-1">{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      {/* Chừa chỗ để nội dung cuối trang không bị thanh cố định che */}
      <div aria-hidden className="md:hidden h-[calc(3.5rem+env(safe-area-inset-bottom))] shrink-0" />
    </>
  )
}
