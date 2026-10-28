import { ThemeToggle } from '@/components/theme/theme-toggle'
import { LanguageSwitcher } from '@/components/layout/language-switcher'
import { AuthScene } from '@/components/auth/auth-scene'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-dvh w-full flex items-center justify-center p-4 bg-gradient-to-br from-emerald-950/20 via-background to-teal-950/20 relative overflow-hidden">
      {/* Nền: đốm sáng trôi nhẹ (hiện ngay), cảnh sân 3D phủ lên khi Three.js nạp xong, rồi lớp mờ viền để thẻ đăng nhập nổi bật */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[12%] -left-24 w-96 h-96 bg-emerald-500/25 rounded-full blur-[90px] animate-float" />
        <div className="absolute bottom-[8%] -right-24 w-96 h-96 bg-amber-400/20 rounded-full blur-[90px] animate-float-slow" />
        <AuthScene />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--background)_55%,transparent)_0%,transparent_55%,var(--background)_130%)]" />
      </div>

      <div className="absolute top-4 right-4 z-20 flex items-center gap-1">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full flex justify-center py-8">
        {children}
      </div>
    </div>
  )
}
