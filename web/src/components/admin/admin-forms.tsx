'use client'

import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { grantPlan, setFreePlan } from '@/app/actions/admin'

export function PlanActions({ clubId }: { clubId: string }) {
  const t = useTranslations('admin.plan')
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const run = (fn: () => Promise<{ error?: string; success?: boolean }>) =>
    startTransition(async () => {
      const res = await fn()
      setMessage(res.error ?? t('updated'))
    })

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => grantPlan(clubId, 1))} className="cursor-pointer">
        {t('month')}
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => grantPlan(clubId, 12))} className="cursor-pointer">
        {t('year')}
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setFreePlan(clubId))} className="cursor-pointer">
        {t('free')}
      </Button>
      {message && <span role="status" className="text-xs text-muted-foreground">{message}</span>}
    </div>
  )
}
