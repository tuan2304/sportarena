'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { applyTheme, readStoredTheme, type ThemeChoice } from '@/lib/theme'

/** Theo dõi class "dark" trên <html> (do script khởi tạo, nút đổi hoặc thay đổi của hệ thống đặt). */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

/** Giao diện đang hiển thị. Phía server không biết nên coi là sáng, rồi đồng bộ ngay sau khi tải. */
export function useResolvedTheme(): ThemeChoice {
  return useSyncExternalStore<ThemeChoice>(
    subscribe,
    () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'),
    () => 'light'
  )
}

/** Chưa tự chọn thì đi theo cài đặt sáng/tối của hệ điều hành, kể cả khi đổi lúc đang mở trang. */
function useFollowSystemTheme() {
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => {
      if (readStoredTheme() === null) applyTheme(e.matches ? 'dark' : 'light', false)
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
}

export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations('theme')
  const theme = useResolvedTheme()
  useFollowSystemTheme()
  const next: ThemeChoice = theme === 'dark' ? 'light' : 'dark'
  const label = next === 'dark' ? t('toDark') : t('toLight')

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      onClick={() => applyTheme(next)}
      title={label}
      aria-label={label}
      className={`h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer ${className ?? ''}`}
    >
      {/* Biểu tượng đổi bằng CSS để không lệch giữa HTML server và client */}
      <Moon className="w-4 h-4 dark:hidden" aria-hidden />
      <Sun className="w-4 h-4 hidden dark:block" aria-hidden />
    </Button>
  )
}
