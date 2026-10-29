import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TicketThread } from '@/components/support/ticket-thread'
import { isTicketCategory } from '@/lib/support'
import { formatDate } from '@/lib/format'

export async function generateMetadata() {
  const t = await getTranslations('admin.tickets')
  return { title: t('detailMetaTitle') }
}

export default async function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations('admin.tickets')
  const th = await getTranslations('header')
  const ts = await getTranslations('support')
  const { id } = await params
  const admin = createAdminClient()

  const { data: ticket } = await admin
    .from('support_tickets')
    .select('id, subject, category, status, created_at, user:profiles!support_tickets_user_id_fkey(full_name, role), club:clubs(id, name)')
    .eq('id', id)
    .maybeSingle()
  if (!ticket) notFound()

  const { data: messages } = await admin
    .from('ticket_messages')
    .select('id, is_staff, is_ai, sender_name, body, created_at')
    .eq('ticket_id', id)
    .order('created_at')

  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/admin/tickets" className="py-2.5 -my-2.5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" aria-hidden /> {t('back')}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{ticket.subject}</CardTitle>
          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
            <span>{ticket.user?.full_name || t('userFallback')} ({ticket.user?.role === 'owner' ? th('roleOwner') : ticket.user?.role === 'admin' ? th('roleAdmin') : th('rolePlayer')})</span>
            <span>· {ts(`categories.${isTicketCategory(ticket.category) ? ticket.category : 'other'}`)}</span>
            {ticket.club?.name && <span>· {t('club', { name: ticket.club.name })}</span>}
            <span>· {t('created', { date: formatDate(ticket.created_at) })}</span>
          </div>
        </CardHeader>
        <CardContent>
          <TicketThread ticketId={ticket.id} initialMessages={messages ?? []} initialStatus={ticket.status} viewer="admin" />
        </CardContent>
      </Card>
    </div>
  )
}
