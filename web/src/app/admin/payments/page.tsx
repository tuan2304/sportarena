import { getTranslations } from 'next-intl/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ReconcileActions } from '@/components/admin/reconcile-actions'
import { RemindOwnerButton } from '@/components/admin/remind-owner-button'
import { loadReconciliation, OVERDUE_REFUND_DAYS, type ReconPayment } from '@/lib/reconciliation'
import { formatDate, formatTime, formatVnd } from '@/lib/format'

export async function generateMetadata() {
  const t = await getTranslations('admin.payments')
  return { title: t('metaTitle') }
}

// Quyền admin đã được kiểm tra ở app/admin/layout.tsx
export default async function AdminPaymentsPage() {
  const t = await getTranslations('admin.payments')
  const { needsRefund, stuck, overdue } = await loadReconciliation(createAdminClient())

  const when = (iso: string | null) => (iso ? `${formatDate(iso)} ${formatTime(iso)}` : '—')

  function PaymentRow({ p, kind }: { p: ReconPayment; kind: 'refund' | 'stuck' }) {
    return (
      <div className="p-4 rounded-xl border border-border flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="font-bold flex items-center gap-2 flex-wrap">
            {formatVnd(p.amount)}
            <Badge variant="outline">#{p.orderCode}</Badge>
            <Badge variant="outline">{p.channel === 'club' ? t('channelClub') : t('channelPlatform')}</Badge>
            {p.reason === 'slot_taken_after_expiry' && (
              <Badge className="bg-amber-400 text-slate-900">{t('reasonSlotTaken')}</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {t('rowCustomer', { name: p.customerName })} · {p.clubName} / {p.courtName}
          </div>
          <div className="text-xs text-muted-foreground">
            {t('rowPaidAt', { time: when(p.paidAt) })} · {t('rowPlayAt', { time: when(p.startTime) })} · {t(`bookingStatus.${p.bookingStatus}` as 'bookingStatus.pending')}
          </div>
        </div>
        <ReconcileActions paymentId={p.id} kind={kind} summary={`${p.customerName} · ${formatVnd(p.amount)}`} />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('refundTitle', { count: needsRefund.length })}</CardTitle>
          <CardDescription>{t('refundHint')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {needsRefund.length === 0 && <p className="text-sm text-muted-foreground">{t('empty')}</p>}
          {needsRefund.map((p) => (
            <PaymentRow key={p.id} p={p} kind="refund" />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('stuckTitle', { count: stuck.length })}</CardTitle>
          <CardDescription>{t('stuckHint')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {stuck.length === 0 && <p className="text-sm text-muted-foreground">{t('empty')}</p>}
          {stuck.map((p) => (
            <PaymentRow key={p.id} p={p} kind="stuck" />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('overdueTitle', { count: overdue.length })}</CardTitle>
          <CardDescription>{t('overdueHint', { days: OVERDUE_REFUND_DAYS })}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {overdue.length === 0 && <p className="text-sm text-muted-foreground">{t('empty')}</p>}
          {overdue.map((o) => (
            <div key={o.bookingId} className="p-4 rounded-xl border border-border flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="font-bold flex items-center gap-2 flex-wrap">
                  {formatVnd(o.amount)}
                  <Badge className="bg-red-600 text-white">{t('overdueDays', { days: o.daysOverdue })}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('rowCustomer', { name: o.customerName })} · {o.clubName} · {t('rowOwner', { name: o.ownerName })}
                </div>
                <div className="text-xs text-muted-foreground">{t('rowCancelledAt', { time: when(o.cancelledAt) })}</div>
              </div>
              <RemindOwnerButton bookingId={o.bookingId} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
