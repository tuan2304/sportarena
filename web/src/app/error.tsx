'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

/** Lỗi render ở một trang: ghi nhận (không kèm dữ liệu cá nhân) và cho thử lại hoặc về trang chủ. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('errorPage')

  useEffect(() => {
    try {
      const payload = JSON.stringify({
        source: 'web',
        message: error.message || 'Unknown error',
        stack: error.stack,
        path: window.location.pathname,
        digest: error.digest,
      })
      if (!navigator.sendBeacon?.('/api/monitoring/client-error', new Blob([payload], { type: 'application/json' }))) {
        void fetch('/api/monitoring/client-error', { method: 'POST', body: payload, keepalive: true }).catch(() => {})
      }
    } catch {
      // báo cáo lỗi không được tự gây thêm lỗi
    }
  }, [error])

  return (
    <main className="min-h-[60vh] flex items-center justify-center px-4 py-16 text-center">
      <div className="max-w-md space-y-4">
        <h1 className="text-2xl font-extrabold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('body')}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={reset} className="bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer">
            {t('retry')}
          </Button>
          <Link href="/">
            <Button variant="outline" className="cursor-pointer">{t('home')}</Button>
          </Link>
        </div>
      </div>
    </main>
  )
}
