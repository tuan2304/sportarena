import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { TICKET_STATUS, isTicketStatus } from '@/lib/support'

export function TicketStatusBadge({ status, forAdmin = false }: { status: string; forAdmin?: boolean }) {
  const t = useTranslations('support.status')
  const meta = isTicketStatus(status) ? TICKET_STATUS[status] : TICKET_STATUS.closed
  return (
    <Badge variant="outline" className={`text-xs font-semibold ${meta.tone}`}>
      {forAdmin ? meta.adminLabel : t(isTicketStatus(status) ? status : 'closed')}
    </Badge>
  )
}
