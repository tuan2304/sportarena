import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { TICKET_STATUS, isTicketStatus } from '@/lib/support'

export function TicketStatusBadge({ status, forAdmin = false }: { status: string; forAdmin?: boolean }) {
  const t = useTranslations('support.status')
  const ta = useTranslations('support.adminStatus')
  const meta = isTicketStatus(status) ? TICKET_STATUS[status] : TICKET_STATUS.closed
  return (
    <Badge variant="outline" className={`text-xs font-semibold ${meta.tone}`}>
      {forAdmin ? ta(isTicketStatus(status) ? status : 'closed') : t(isTicketStatus(status) ? status : 'closed')}
    </Badge>
  )
}
