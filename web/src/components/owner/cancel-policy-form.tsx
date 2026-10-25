'use client'

import { useTranslations, useLocale } from 'next-intl'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { updateCancellationPolicy } from '@/app/actions/cancellation'
import { describePolicy, MAX_FREE_CANCEL_HOURS, parseFreeCancelHours } from '@/lib/cancellation'

interface CancelPolicyFormProps {
  clubId: string
  hours: number
}

export function CancelPolicyForm({ clubId, hours }: CancelPolicyFormProps) {
  const t = useTranslations('ownerPolicy')
  const lang = useLocale() === 'en' ? 'en' : 'vi'
  const [pending, startTransition] = useTransition()
  const [value, setValue] = useState(String(hours))
  const [saved, setSaved] = useState(hours)
  const [error, setError] = useState<string | null>(null)

  const parsed = parseFreeCancelHours(value)

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    startTransition(async () => {
      const res = await updateCancellationPolicy(clubId, parsed.hours)
      if (res.error) {
        setError(res.error)
        return
      }
      setSaved(parsed.hours)
      toast.success(t('saved'))
    })
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold flex items-center gap-1.5">
        <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" aria-hidden />
        {t('title')}
      </h3>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {t('text')}
      </p>

      {error && (
        <div role="alert" className="flex items-start gap-2 p-3 rounded-lg text-xs border bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor={`cancel-${clubId}`} className="text-xs font-semibold">{t('hours')}</Label>
          <Input
            id={`cancel-${clubId}`}
            type="number"
            min={0}
            max={MAX_FREE_CANCEL_HOURS}
            step={1}
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
            className="h-9 w-32 text-xs"
          />
        </div>
        <Button type="submit" disabled={pending || !parsed.ok || (parsed.ok && parsed.hours === saved)} className="bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer">
          {pending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
          {t('submit')}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">{t('preview', { text: describePolicy(parsed.ok ? parsed.hours : saved, lang) })}</p>
    </div>
  )
}
