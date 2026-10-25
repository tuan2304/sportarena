'use client'

import { useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { setLocale } from '@/app/actions/locale'
import type { Locale } from '@/i18n/config'

/** Đổi Việt <-> Anh. Lưu vào cookie rồi làm mới trang để server dựng lại bằng ngôn ngữ mới. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations('language')
  const locale = useLocale() as Locale
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const next: Locale = locale === 'vi' ? 'en' : 'vi'

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setLocale(next)
          router.refresh()
        })
      }
      title={t('switchTo', { language: t(next) })}
      aria-label={t('switchTo', { language: t(next) })}
      className={`h-8 gap-1 px-2 text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer ${className ?? ''}`}
    >
      <Languages className="w-4 h-4" aria-hidden />
      <span lang={next}>{next.toUpperCase()}</span>
    </Button>
  )
}
