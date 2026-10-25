'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Loader2, LockKeyhole, RotateCcw, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { replyToTicket, setTicketStatus } from '@/app/actions/support'
import { formatDate, formatTime } from '@/lib/format'
import { BODY_MAX, isTicketStatus, type TicketStatus } from '@/lib/support'
import { TicketStatusBadge } from '@/components/support/ticket-status-badge'

export interface TicketMessage {
  id: string
  is_staff: boolean
  sender_name: string
  body: string
  created_at: string
}

interface TicketThreadProps {
  ticketId: string
  initialMessages: TicketMessage[]
  initialStatus: string
  /** admin: nhân viên hỗ trợ đang xem · user: người tạo yêu cầu */
  viewer: 'admin' | 'user'
}

export function TicketThread({ ticketId, initialMessages, initialStatus, viewer }: TicketThreadProps) {
  const router = useRouter()
  const t = useTranslations('support.thread')
  const [messages, setMessages] = useState<TicketMessage[]>(initialMessages)
  const [status, setStatus] = useState<string>(initialStatus)
  const [text, setText] = useState('')
  const [sending, startSend] = useTransition()
  const [changing, startChange] = useTransition()
  const endRef = useRef<HTMLDivElement>(null)
  const isAdmin = viewer === 'admin'
  const closed = status === 'closed'

  const refetch = useCallback(async () => {
    const supabase = createClient()
    const [{ data: rows }, { data: ticket }] = await Promise.all([
      supabase.from('ticket_messages').select('id, is_staff, sender_name, body, created_at').eq('ticket_id', ticketId).order('created_at'),
      supabase.from('support_tickets').select('status').eq('id', ticketId).maybeSingle(),
    ])
    if (rows) setMessages(rows)
    if (ticket?.status) setStatus(ticket.status)
  }, [ticketId])

  // Tin nhắn mới (từ phía bên kia) hiện ngay, không cần tải lại trang
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`ticket-${ticketId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_messages', filter: `ticket_id=eq.${ticketId}` }, () => {
        void refetch()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_tickets', filter: `id=eq.${ticketId}` }, () => {
        void refetch()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [ticketId, refetch])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  function send(e: React.FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    startSend(async () => {
      const res = await replyToTicket(ticketId, body)
      if (res.error) {
        toast.error(res.error)
        return
      }
      setText('')
      await refetch()
      router.refresh()
    })
  }

  function changeStatus(next: TicketStatus, successText: string) {
    startChange(async () => {
      const res = await setTicketStatus(ticketId, next)
      if (res.error) {
        toast.error(res.error)
        return
      }
      setStatus(next)
      toast.success(successText)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TicketStatusBadge status={isTicketStatus(status) ? status : 'closed'} forAdmin={isAdmin} />
        <div className="flex flex-wrap gap-2">
          {isAdmin && status !== 'resolved' && status !== 'closed' && (
            <Button type="button" size="sm" variant="outline" disabled={changing} onClick={() => changeStatus('resolved', t('markedResolved'))} className="cursor-pointer">
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" aria-hidden /> {t('resolved')}
            </Button>
          )}
          {!closed && (
            <Button type="button" size="sm" variant="outline" disabled={changing} onClick={() => changeStatus('closed', t('closedToast'))} className="cursor-pointer">
              <LockKeyhole className="mr-1.5 h-3.5 w-3.5" aria-hidden /> {t('close')}
            </Button>
          )}
          {isAdmin && (status === 'resolved' || status === 'closed') && (
            <Button type="button" size="sm" variant="outline" disabled={changing} onClick={() => changeStatus('open', t('reopenedToast'))} className="cursor-pointer">
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden /> {t('reopen')}
            </Button>
          )}
        </div>
      </div>

      <div
        role="log"
        aria-live="polite"
        aria-label={t('log')}
        className="max-h-[55vh] min-h-48 space-y-3 overflow-y-auto rounded-2xl border border-border bg-muted/30 p-4"
      >
        {messages.map((m) => {
          const mine = m.is_staff === isAdmin
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-xs ${
                  mine ? 'bg-emerald-700 text-white' : m.is_staff ? 'bg-amber-100 text-amber-950 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-100 dark:border-amber-500/40' : 'bg-card border border-border'
                }`}
              >
                <div className={`mb-0.5 text-xs font-semibold ${mine ? 'text-emerald-100' : 'text-muted-foreground'}`}>
                  {m.sender_name || (m.is_staff ? t('staffFallback') : t('userFallback'))}
                  <span className="font-normal"> · {formatDate(m.created_at)} {formatTime(m.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap break-words leading-relaxed">{m.body}</p>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      {closed && !isAdmin ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          {t('closedNote')}
        </p>
      ) : (
        <form onSubmit={send} className="space-y-2">
          <label htmlFor="ticket-reply" className="sr-only">
            {t('replyLabel')}
          </label>
          <textarea
            id="ticket-reply"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={BODY_MAX}
            rows={3}
            placeholder={isAdmin ? t('placeholderAdmin') : t('placeholderUser')}
            className="w-full resize-y rounded-xl border border-input bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{text.length}/{BODY_MAX}</span>
            <Button type="submit" disabled={sending || !text.trim()} className="cursor-pointer bg-emerald-700 text-white hover:bg-emerald-800">
              {sending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" aria-hidden />}
              {t('send')}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
