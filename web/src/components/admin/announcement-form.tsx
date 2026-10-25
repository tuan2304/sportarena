'use client'

import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Megaphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { sendAnnouncement } from '@/app/actions/announcements'
import { ANNOUNCEMENT_AUDIENCES, ANNOUNCEMENT_KINDS } from '@/lib/support'

const EMPTY = { title: '', body: '', kind: 'update', audience: 'all', link: '' }

export function AnnouncementForm() {
  const t = useTranslations('admin.announce')
  const router = useRouter()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState(EMPTY)

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const audience = ANNOUNCEMENT_AUDIENCES.some((a) => a.id === form.audience) ? t(`audiences.${form.audience as 'all' | 'owners' | 'players'}`) : ''
    // Thông báo đã gửi không thu hồi được nên luôn hỏi lại
    const ok = await confirm({
      title: t('form.confirmTitle'),
      description: t('form.confirmText', { audience }),
      confirmText: t('form.confirmButton'),
    })
    if (!ok) return
    startTransition(async () => {
      const res = await sendAnnouncement(form)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(t('form.sent', { count: res.sent ?? 0 }))
      setForm(EMPTY)
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="a-kind" className="text-xs font-semibold">{t('form.kind')}</Label>
          <select id="a-kind" value={form.kind} onChange={set('kind')} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            {ANNOUNCEMENT_KINDS.map((k) => (
              <option key={k.id} value={k.id}>{t(`kinds.${k.id}`)}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="a-audience" className="text-xs font-semibold">{t('form.to')}</Label>
          <select id="a-audience" value={form.audience} onChange={set('audience')} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            {ANNOUNCEMENT_AUDIENCES.map((a) => (
              <option key={a.id} value={a.id}>{t(`audiences.${a.id}`)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="a-title" className="text-xs font-semibold">{t('form.subject')}</Label>
        <Input id="a-title" value={form.title} onChange={set('title')} maxLength={120} required placeholder={t('form.subjectPlaceholder')} className="h-10" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="a-body" className="text-xs font-semibold">{t('form.body')}</Label>
        <textarea
          id="a-body"
          value={form.body}
          onChange={set('body')}
          maxLength={1000}
          rows={4}
          required
          className="w-full resize-y rounded-xl border border-input bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        <div className="text-right text-xs text-muted-foreground">{form.body.length}/1000</div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="a-link" className="text-xs font-semibold">{t('form.link')}</Label>
        <Input id="a-link" value={form.link} onChange={set('link')} maxLength={200} placeholder="/clubs" className="h-10" />
        <p className="text-xs text-muted-foreground">{t('form.linkHint')}</p>
      </div>

      <Button type="submit" disabled={pending} className="cursor-pointer bg-emerald-700 text-white hover:bg-emerald-800">
        {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Megaphone className="mr-1.5 h-4 w-4" aria-hidden />}
        {t('form.submit')}
      </Button>
    </form>
  )
}
