'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { markPaymentRefunded, repairStuckPayment } from '@/app/actions/reconciliation'

interface Props {
  paymentId: string
  kind: 'refund' | 'stuck'
  /** Hiện trong hộp xác nhận: "<khách> · <số tiền>" */
  summary: string
}

/** Nút xử lý một khoản trong trang đối soát. Hành động ghi vào sổ và báo cho khách nên luôn hỏi xác nhận. */
export function ReconcileActions({ paymentId, kind, summary }: Props) {
  const t = useTranslations('admin.payments.actions')
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null)

  function run() {
    startTransition(async () => {
      const ok = await confirm({
        title: kind === 'refund' ? t('refundConfirmTitle') : t('repairConfirmTitle'),
        description: `${summary}. ${kind === 'refund' ? t('refundConfirmBody') : t('repairConfirmBody')}`,
        confirmText: kind === 'refund' ? t('refundButton') : t('repairButton'),
        destructive: false,
      })
      if (!ok) return

      const res = kind === 'refund' ? await markPaymentRefunded(paymentId, note) : await repairStuckPayment(paymentId)
      if (res.error) setMessage({ text: res.error, tone: 'error' })
      else if (res.outcome === 'slot_taken') setMessage({ text: t('slotTaken'), tone: 'error' })
      else setMessage({ text: kind === 'refund' ? t('refunded') : t('repaired'), tone: 'ok' })
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {kind === 'refund' && (
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder={t('notePlaceholder')}
          aria-label={t('noteLabel')}
          disabled={pending}
          className="h-8 w-52 text-xs"
        />
      )}
      <Button size="sm" variant="outline" disabled={pending} onClick={run} className="cursor-pointer">
        {pending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" aria-hidden />}
        {kind === 'refund' ? t('refundButton') : t('repairButton')}
      </Button>
      {message && (
        <span
          role="status"
          className={`text-xs ${message.tone === 'error' ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}
        >
          {message.text}
        </span>
      )}
    </div>
  )
}
