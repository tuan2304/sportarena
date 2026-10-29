'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { remindOwnerAboutRefund } from '@/app/actions/reconciliation'

/** Nhắc chủ sân hoàn cọc cho khách. Kết quả hiện ngay cạnh nút. */
export function RemindOwnerButton({ bookingId }: { bookingId: string }) {
  const t = useTranslations('admin.payments.actions')
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null)

  function run() {
    startTransition(async () => {
      const res = await remindOwnerAboutRefund(bookingId)
      setMessage(res.error ? { text: res.error, tone: 'error' } : { text: t('reminded'), tone: 'ok' })
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" disabled={pending} onClick={run} className="cursor-pointer">
        {pending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" aria-hidden />}
        {t('remindButton')}
      </Button>
      {message && (
        <span role="status" className={`text-xs ${message.tone === 'error' ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
          {message.text}
        </span>
      )}
    </div>
  )
}
