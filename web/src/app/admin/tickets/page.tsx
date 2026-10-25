import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TicketStatusBadge } from '@/components/support/ticket-status-badge'
import { isTicketCategory, isTicketStatus } from '@/lib/support'
import { formatDate, formatTime } from '@/lib/format'

export async function generateMetadata() {
  const t = await getTranslations('admin.tickets')
  return { title: t('metaTitle') }
}

const FILTERS = [
  { id: 'open', key: 'filterOpen' },
  { id: 'answered', key: 'filterAnswered' },
  { id: 'resolved', key: 'filterResolved' },
  { id: 'closed', key: 'filterClosed' },
  { id: 'all', key: 'filterAll' },
] as const

export default async function AdminTicketsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const t = await getTranslations('admin.tickets')
  const th = await getTranslations('header')
  const ts = await getTranslations('support')
  const { status: statusParam } = await searchParams
  const filter = isTicketStatus(statusParam) ? statusParam : statusParam === 'all' ? 'all' : 'open'

  let query = createAdminClient()
    .from('support_tickets')
    .select('id, subject, category, status, last_message_at, user:profiles!support_tickets_user_id_fkey(full_name, role), club:clubs(name)')
    .order('last_message_at', { ascending: false })
    .limit(100)
  if (filter !== 'all') query = query.eq('status', filter)
  const { data: tickets } = await query

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label={t('filterLabel')}>
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={`/admin/tickets?status=${f.id}`}
            aria-current={f.id === filter ? 'page' : undefined}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold border ${
              f.id === filter ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-card text-muted-foreground border-border hover:text-foreground'
            }`}
          >
            {t(f.key)}
          </Link>
        ))}
      </nav>

      {(tickets ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">{t('empty')}</CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {(tickets ?? []).map((tk) => (
            <li key={tk.id}>
              <Link href={`/admin/tickets/${tk.id}`} className="block rounded-xl border border-border bg-card p-4 hover:border-emerald-600/50 transition-colors">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold truncate">{tk.subject}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>{tk.user?.full_name || t('userFallback')}</span>
                      <Badge variant="outline" className="text-xs py-0">{tk.user?.role === 'owner' ? th('roleOwner') : tk.user?.role === 'admin' ? th('roleAdmin') : th('rolePlayer')}</Badge>
                      <span>· {ts(`categories.${isTicketCategory(tk.category) ? tk.category : 'other'}`)}</span>
                      {tk.club?.name && <span>· {tk.club.name}</span>}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <TicketStatusBadge status={tk.status} forAdmin />
                    <div className="text-xs text-muted-foreground">{formatDate(tk.last_message_at)} {formatTime(tk.last_message_at)}</div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
