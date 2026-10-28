'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useLocale, useTranslations } from 'next-intl'
import { AlertCircle, Download, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { deleteMyAccount } from '@/app/actions/account'

/** Quyền của chủ dữ liệu: tải bản sao dữ liệu và xóa tài khoản (Apple 5.1.1(v), Nghị định 13/2023). */
export function AccountSection({ needsPassword }: { needsPassword: boolean }) {
  const t = useTranslations('profile.account')
  const locale = useLocale()
  const phrase = locale === 'vi' ? 'XÓA' : 'DELETE'

  const [exporting, setExporting] = useState(false)
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch('/api/account/export')
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        toast.error(body?.error ?? t('exportFailed'))
        return
      }
      const filename = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'sportarena-data.json'
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error(t('exportFailed'))
    } finally {
      setExporting(false)
    }
  }

  function handleOpenChange(next: boolean) {
    if (pending) return
    setOpen(next)
    if (!next) {
      setPassword('')
      setConfirmation('')
      setError(null)
    }
  }

  function handleDelete(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      // Thành công thì Server Action chuyển hướng về trang chủ; chỉ khi thất bại mới có kết quả trả về
      const res = await deleteMyAccount({ password, confirmation })
      if (res?.error) setError(res.error)
    })
  }

  const canSubmit = confirmation.trim().length > 0 && (!needsPassword || password.length > 0)

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border/70 p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="min-w-0 flex-1 basis-60">
              <div className="text-sm font-semibold">{t('exportTitle')}</div>
              <p className="text-xs text-muted-foreground mt-0.5">{t('exportHint')}</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="cursor-pointer">
              {exporting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" aria-hidden /> : <Download className="w-3.5 h-3.5 mr-1.5" aria-hidden />}
              {t('exportButton')}
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="min-w-0 flex-1 basis-60">
              <div className="text-sm font-semibold text-red-700 dark:text-red-400">{t('deleteTitle')}</div>
              <p className="text-xs text-muted-foreground mt-0.5">{t('deleteHint')}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(true)}
              className="cursor-pointer border-red-500/40 text-red-700 hover:bg-red-500/10 dark:text-red-400"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" aria-hidden />
              {t('deleteButton')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">{t('dialogTitle')}</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">{t('dialogIntro')}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDelete} className="space-y-4">
            <ul className="space-y-1.5 text-xs text-muted-foreground list-disc pl-4">
              <li>{t('willDelete')}</li>
              <li>{t('willKeep')}</li>
              <li>{t('ownerNote')}</li>
            </ul>

            {needsPassword && (
              <div className="space-y-1.5">
                <Label htmlFor="delete-password" className="text-xs font-semibold">{t('passwordLabel')}</Label>
                <Input
                  id="delete-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={pending}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="delete-confirm" className="text-xs font-semibold">{t('confirmLabel', { phrase })}</Label>
              <Input
                id="delete-confirm"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder={phrase}
                autoComplete="off"
                autoCapitalize="characters"
                disabled={pending}
              />
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-2 p-3 rounded-lg text-xs border bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
                <span>{error}</span>
              </div>
            )}

            {/* Nút Hủy đứng trước để là nút được focus đầu tiên: an toàn hơn cho thao tác xóa */}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={pending} className="cursor-pointer">
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={!canSubmit || pending} className="bg-red-600 hover:bg-red-700 text-white cursor-pointer">
                {pending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" aria-hidden />}
                {pending ? t('deleting') : t('confirm')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
