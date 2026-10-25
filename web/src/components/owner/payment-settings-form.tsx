'use client'

import { useLocale, useTranslations } from 'next-intl'
import { intlLocale, type Locale } from '@/i18n/config'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Loader2, Plug, Unplug, AlertCircle } from 'lucide-react'
import { removePaymentSettings, savePaymentSettings } from '@/app/actions/payment-settings'

import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'
interface PaymentSettingsFormProps {
  clubId: string
  clubName: string
  connected: boolean
  /** Client ID đã lưu (không phải bí mật), hiển thị để chủ sân biết đang dùng kênh nào */
  clientId: string | null
  verifiedAt: string | null
}

export function PaymentSettingsForm({ clubId, clubName, connected, clientId, verifiedAt }: PaymentSettingsFormProps) {
  const t = useTranslations('ownerPayments.form')
  const locale = useLocale() as Locale
  const [pending, startTransition] = useTransition()
  const askConfirm = useConfirm()
  const [form, setForm] = useState({ clientId: '', apiKey: '', checksumKey: '' })
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [isConnected, setIsConnected] = useState(connected)
  const [savedClientId, setSavedClientId] = useState(clientId)

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    startTransition(async () => {
      const res = await savePaymentSettings(clubId, form)
      if (res.error) {
        setMessage({ type: 'error', text: res.error })
        return
      }
      toast.success(t('connected'))
      setIsConnected(true)
      setSavedClientId(form.clientId.trim())
      setForm({ clientId: '', apiKey: '', checksumKey: '' })
      setMessage({
        type: 'success',
        text: res.account
          ? t('connectedAccount', { name: res.account.accountName, bank: res.account.bankName, number: res.account.accountNumber })
          : t('connectedOk'),
      })
    })
  }

  async function handleRemove() {
    const ok = await askConfirm({
      title: t('disconnectTitle', { name: clubName }),
      description: t('disconnectText'),
      confirmText: t('disconnectConfirm'),
      destructive: true,
    })
    if (!ok) return
    setMessage(null)
    startTransition(async () => {
      const res = await removePaymentSettings(clubId)
      if (res.error) {
        setMessage({ type: 'error', text: res.error })
        return
      }
      setIsConnected(false)
      setSavedClientId(null)
      setMessage({ type: 'success', text: t('disconnected') })
      toast.success(t('disconnectedToast'))
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {isConnected ? (
          <Badge className="bg-emerald-700 text-white gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden /> {t('isConnected')}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-amber-800 dark:text-amber-300 border-amber-500/40">
            {t('notConnected')}
          </Badge>
        )}
        {isConnected && savedClientId && (
          <span className="text-xs text-muted-foreground font-mono">Client ID: {savedClientId.slice(0, 8)}…</span>
        )}
        {isConnected && verifiedAt && (
          <span className="text-xs text-muted-foreground">
            {t('verified', { date: new Date(verifiedAt).toLocaleDateString(intlLocale(locale), { timeZone: 'Asia/Ho_Chi_Minh' }) })}
          </span>
        )}
      </div>

      {message && (
        <div
          role={message.type === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-2 p-3 rounded-lg text-xs border ${
            message.type === 'error'
              ? 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
          }`}
        >
          {message.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="grid gap-3 sm:grid-cols-3" autoComplete="off">
        <div className="space-y-1">
          <Label htmlFor={`cid-${clubId}`} className="text-xs font-semibold">Client ID</Label>
          <Input id={`cid-${clubId}`} value={form.clientId} onChange={set('clientId')} required className="h-9 text-xs font-mono" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`key-${clubId}`} className="text-xs font-semibold">API Key</Label>
          <Input id={`key-${clubId}`} type="password" value={form.apiKey} onChange={set('apiKey')} required className="h-9 text-xs font-mono" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`chk-${clubId}`} className="text-xs font-semibold">Checksum Key</Label>
          <Input id={`chk-${clubId}`} type="password" value={form.checksumKey} onChange={set('checksumKey')} required className="h-9 text-xs font-mono" />
        </div>

        <div className="sm:col-span-3 flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={pending} className="bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer">
            {pending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plug className="w-4 h-4 mr-1.5" aria-hidden />}
            {isConnected ? t('update') : t('save')}
          </Button>
          {isConnected && (
            <Button type="button" variant="outline" disabled={pending} onClick={handleRemove} className="text-red-700 dark:text-red-400 border-red-500/30 cursor-pointer">
              <Unplug className="w-4 h-4 mr-1.5" aria-hidden />
              {t('disconnect')}
            </Button>
          )}
          <p className="text-xs text-muted-foreground">{t('encrypted')}</p>
        </div>
      </form>
    </div>
  )
}
