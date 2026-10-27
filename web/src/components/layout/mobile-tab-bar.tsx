import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import { getCurrentUser, getCurrentProfile } from '@/lib/supabase/session'
import { MobileTabBarNav, type TabItem } from '@/components/layout/mobile-tab-bar-nav'

/**
 * Thanh điều hướng dưới cùng cho điện thoại (ẩn từ màn hình md trở lên, nơi đã có menu ở đầu trang).
 * Khách xem web trên điện thoại không có app nên đây là cách chính để đi giữa các mục.
 */
export function MobileTabBar() {
  return (
    <Suspense fallback={null}>
      <TabBarContent />
    </Suspense>
  )
}

async function TabBarContent() {
  const t = await getTranslations('tabbar')
  const user = await getCurrentUser()
  const profile = user ? await getCurrentProfile() : null

  const items: TabItem[] = [
    { key: 'explore', href: '/clubs', label: t('explore'), match: ['/clubs'] },
    { key: 'matches', href: '/matches', label: t('matches'), match: ['/matches'] },
  ]
  // Lịch đặt cần đăng nhập nên khách chưa đăng nhập chỉ thấy thêm tab Đăng nhập
  if (user) items.push({ key: 'bookings', href: '/my-bookings', label: t('bookings'), match: ['/my-bookings', '/bookings'] })
  if (profile?.role === 'owner') items.push({ key: 'owner', href: '/owner/dashboard', label: t('owner'), match: ['/owner'] })
  if (profile?.role === 'admin') items.push({ key: 'admin', href: '/admin', label: t('admin'), match: ['/admin'] })
  items.push(
    user
      ? { key: 'profile', href: '/profile', label: t('profile'), match: ['/profile', '/players', '/support'] }
      : { key: 'login', href: '/login', label: t('login'), match: ['/login', '/register'] }
  )

  return <MobileTabBarNav items={items} label={t('label')} />
}
