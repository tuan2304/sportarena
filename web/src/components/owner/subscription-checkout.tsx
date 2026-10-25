'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Loader2, QrCode, AlertCircle } from 'lucide-react'
import {
  createSubscriptionPayment,
  getSubscriptionPaymentStatus,
  simulateSubscriptionPayment,
  type SubscriptionCheckout,
} from '@/app/actions/billing'
import { bankNameFromBin } from '@/lib/banks'
import { formatVnd } from '@/lib/format'

interface Props {
  clubId: string
  options: Array<{ months: number; price: number }>
}

export function SubscriptionCheckoutPanel({ clubId, options }: Props) {
  const t = useTranslations('ownerBilling')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [checkout, setCheckout] = useState<SubscriptionCheckout | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [paid, setPaid] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Hỏi trạng thái mỗi 4 giây trong lúc chờ chủ sân chuyển khoản
  useEffect(() => {
    if (!checkout || paid) return
    timer.current = setInterval(async () => {
      const res = await getSubscriptionPaymentStatus(checkout.paymentId)
      if (res.status === 'paid') {
        setPaid(true)
        router.refresh()
      }
    }, 4000)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [checkout, paid, router])

  function start(months: number) {
    setError(null)
    startTransition(async () => {
      const res = await createSubscriptionPayment(clubId, months)
      if (res.error) setError(res.error)
      else if (res.checkout) setCheckout(res.checkout)
    })
  }

  function simulate() {
    if (!checkout) return
    startTransition(async () => {
      const res = await simulateSubscriptionPayment(checkout.paymentId)
      if (res.error) setError(res.error)
      else {
        setPaid(true)
        router.refresh()
      }
    })
  }

  if (paid) {
    return (
      <div role="status" className="flex items-center gap-2 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 dark:text-emerald-300 text-sm font-semibold">
        <CheckCircle2 className="w-5 h-5" aria-hidden /> {t('paid')}
      </div>
    )
  }

  if (checkout) {
    return (
      <div className="grid sm:grid-cols-[auto_1fr] gap-5 items-start">
        <div className="p-3 bg-white rounded-2xl border-2 border-emerald-500/30 w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh QR động từ img.vietqr.io */}
          <img src={checkout.qrImageUrl} alt={t('qrAlt')} className="w-48 h-48 object-contain" />
        </div>
        <div className="space-y-2 text-sm">
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{formatVnd(checkout.amount)}</div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">{t('bank')}</dt>
            <dd className="font-semibold">{bankNameFromBin(checkout.bankName) ?? checkout.bankName}</dd>
            <dt className="text-muted-foreground">{t('accountNumber')}</dt>
            <dd className="font-mono font-semibold">{checkout.accountNumber}</dd>
            <dt className="text-muted-foreground">{t('accountName')}</dt>
            <dd className="font-semibold">{checkout.accountName}</dd>
            <dt className="text-muted-foreground">{t('content')}</dt>
            <dd className="font-mono font-semibold">{checkout.transferContent}</dd>
          </dl>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> {t('waiting')}
          </p>
          {checkout.simulated && (
            <Button type="button" onClick={simulate} disabled={pending} className="bg-amber-400 hover:bg-amber-300 text-slate-900 cursor-pointer">
              {t('simulate')}
            </Button>
          )}
          {error && <p role="alert" className="text-xs text-red-700 dark:text-red-400">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Button
            key={o.months}
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => start(o.months)}
            className="cursor-pointer"
          >
            {pending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <QrCode className="w-4 h-4 mr-1.5" aria-hidden />}
            {t('option', { months: o.months, price: formatVnd(o.price) })}
          </Button>
        ))}
      </div>
      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4" aria-hidden /> {error}
        </p>
      )}
    </div>
  )
}
