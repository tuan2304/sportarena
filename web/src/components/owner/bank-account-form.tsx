'use client'

import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle2, Landmark, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { removeBankAccount, saveBankAccount } from '@/app/actions/bank-account'
import { BANKS } from '@/lib/banks'

interface BankAccountFormProps {
  clubId: string
  clubName: string
  initial: { bin: string; accountNumber: string; accountName: string } | null
}

/** Kênh nhận cọc bằng chuyển khoản thủ công: khách quét VietQR, chủ sân đối chiếu rồi xác nhận từng đơn. */
export function BankAccountForm({ clubId, clubName, initial }: BankAccountFormProps) {
  const t = useTranslations('ownerPayments.bank')
  const [pending, startTransition] = useTransition()
  const askConfirm = useConfirm()
  const [saved, setSaved] = useState(initial)
  const [form, setForm] = useState({
    bin: initial?.bin ?? BANKS[0].bin,
    accountNumber: initial?.accountNumber ?? '',
    accountName: initial?.accountName ?? '',
  })
  const [error, setError] = useState<string | null>(null)

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await saveBankAccount(clubId, form)
      if (res.error) {
        setError(res.error)
        return
      }
      setSaved({ ...form })
      toast.success(t('saved'))
    })
  }

  async function handleRemove() {
    const ok = await askConfirm({
      title: t('removeTitle', { name: clubName }),
      description: t('removeText'),
      confirmText: t('removeConfirm'),
      destructive: true,
    })
    if (!ok) return
    setError(null)
    startTransition(async () => {
      const res = await removeBankAccount(clubId)
      if (res.error) {
        setError(res.error)
        return
      }
      setSaved(null)
      setForm({ bin: BANKS[0].bin, accountNumber: '', accountName: '' })
      toast.success(t('removed'))
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-sm font-bold flex items-center gap-1.5">
          <Landmark className="w-4 h-4 text-emerald-700 dark:text-emerald-400" aria-hidden />
          {t('title')}
        </h3>
        {saved ? (
          <Badge className="bg-emerald-700 text-white gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden /> {t('on')}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">{t('off')}</Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {t.rich('text', { strong: (c) => <strong>{c}</strong> })}
      </p>

      {error && (
        <div role="alert" className="flex items-start gap-2 p-3 rounded-lg text-xs border bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="grid gap-3 sm:grid-cols-3" autoComplete="off">
        <div className="space-y-1">
          <Label htmlFor={`bank-${clubId}`} className="text-xs font-semibold">{t('bank')}</Label>
          <select
            id={`bank-${clubId}`}
            value={form.bin}
            onChange={set('bin')}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs shadow-xs cursor-pointer"
          >
            {BANKS.map((b) => (
              <option key={b.bin} value={b.bin}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`acc-${clubId}`} className="text-xs font-semibold">{t('number')}</Label>
          <Input id={`acc-${clubId}`} inputMode="numeric" value={form.accountNumber} onChange={set('accountNumber')} required className="h-9 text-xs font-mono" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`name-${clubId}`} className="text-xs font-semibold">{t('name')}</Label>
          <Input id={`name-${clubId}`} value={form.accountName} onChange={set('accountName')} required className="h-9 text-xs uppercase" />
        </div>

        <div className="sm:col-span-3 flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={pending} className="bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer">
            {pending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            {saved ? t('update') : t('saveEnable')}
          </Button>
          {saved && (
            <Button type="button" variant="outline" disabled={pending} onClick={handleRemove} className="text-red-700 dark:text-red-400 border-red-500/30 cursor-pointer">
              <Trash2 className="w-4 h-4 mr-1.5" aria-hidden />
              {t('remove')}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
