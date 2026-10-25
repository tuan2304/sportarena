import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { LifeBuoy, Plus } from 'lucide-react'
import { getSupabase, getCurrentUser } from '@/lib/supabase/session'
import { MainHeader } from '@/components/layout/main-header'
import { Button } from '@/components/ui/button'
import { TicketStatusBadge } from '@/components/support/ticket-status-badge'
import { formatDate, formatTime } from '@/lib/format'
import { isTicketCategory } from '@/lib/support'

export async function generateMetadata() {
  const t = await getTranslations('support.list')
  return { title: t('metaTitle'), robots: { index: false, follow: false } }
}

export default async function SupportPage() {
  const t = await getTranslations('support')
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/support')

  // RLS đã giới hạn theo người dùng; lọc thêm theo user_id để admin cũng chỉ thấy phiếu của chính mình ở đây
  const supabase = await getSupabase()
  const { data: tickets } = await supabase
    .from('support_tickets')
    .select('id, subject, category, status, last_message_at')
    .eq('user_id', user.id)
    .order('last_message_at', { ascending: false })

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MainHeader />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold flex items-center gap-2">
              <LifeBuoy className="w-6 h-6 text-emerald-700 dark:text-emerald-400" aria-hidden /> {t('list.heading')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{t('list.subtitle')}</p>
          </div>
          <Link href="/support/new">
            <Button className="cursor-pointer bg-emerald-700 text-white hover:bg-emerald-800">
              <Plus className="mr-1.5 h-4 w-4" aria-hidden /> {t('list.newRequest')}
            </Button>
          </Link>
        </div>

        {(tickets ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            {t('list.empty')}
          </div>
        ) : (
          <ul className="space-y-3">
            {(tickets ?? []).map((ticket) => (
              <li key={ticket.id}>
                <Link href={`/support/${ticket.id}`} className="block rounded-xl border border-border bg-card p-4 hover:border-emerald-600/50 transition-colors">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold truncate">{ticket.subject}</div>
                      <div className="text-xs text-muted-foreground mt-1">{t(`categories.${isTicketCategory(ticket.category) ? ticket.category : 'other'}`)}</div>
                    </div>
                    <div className="text-right space-y-1">
                      <TicketStatusBadge status={ticket.status} />
                      <div className="text-xs text-muted-foreground">{formatDate(ticket.last_message_at)} {formatTime(ticket.last_message_at)}</div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
