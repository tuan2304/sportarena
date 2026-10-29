import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import { getSupabase, getCurrentUser } from '@/lib/supabase/session'
import { MainHeader } from '@/components/layout/main-header'
import { TicketThread } from '@/components/support/ticket-thread'
import { isTicketCategory } from '@/lib/support'
import { formatDate } from '@/lib/format'

export async function generateMetadata() {
  const t = await getTranslations('support.detail')
  return { title: t('metaTitle') }
}

export default async function SupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const t = await getTranslations('support')
  const user = await getCurrentUser()
  if (!user) redirect(`/login?next=/support/${id}`)

  // RLS: phiếu của người khác không trả về dòng nào → 404
  const supabase = await getSupabase()
  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('id, user_id, subject, category, status, created_at')
    .eq('id', id)
    .maybeSingle()
  if (!ticket) notFound()
  // Quản trị xem phiếu của người khác trong khu vực quản trị
  if (ticket.user_id !== user.id) redirect(`/admin/tickets/${id}`)

  const { data: messages } = await supabase
    .from('ticket_messages')
    .select('id, is_staff, is_ai, sender_name, body, created_at')
    .eq('ticket_id', id)
    .order('created_at')

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MainHeader />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <Link href="/support" className="py-2.5 -my-2.5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" aria-hidden /> {t('new.back')}
        </Link>
        <div>
          <h1 className="text-xl font-extrabold">{ticket.subject}</h1>
          <p className="text-xs text-muted-foreground mt-1">{t('detail.meta', { category: t(`categories.${isTicketCategory(ticket.category) ? ticket.category : 'other'}`), date: formatDate(ticket.created_at) })}</p>
        </div>
        <TicketThread ticketId={ticket.id} initialMessages={messages ?? []} initialStatus={ticket.status} viewer="user" />
      </main>
    </div>
  )
}
