import { getTranslations } from 'next-intl/server'
import { getSupabase, getCurrentUser } from '@/lib/supabase/session'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SubscriptionCheckoutPanel } from '@/components/owner/subscription-checkout'
import {
  courtLimit,
  FREE_COURT_LIMIT,
  getBillingStart,
  getProMonthlyPrice,
  isBillingEnforced,
  isProActive,
  SUBSCRIPTION_MONTH_OPTIONS,
  subscriptionPrice,
} from '@/lib/billing'
import { formatDate, formatVnd } from '@/lib/format'
import { Crown } from 'lucide-react'

export async function generateMetadata() {
  const t = await getTranslations('ownerBilling')
  return { title: t('metaTitle') }
}

export default async function OwnerBillingPage() {
  const t = await getTranslations('ownerBilling')
  const supabase = await getSupabase()
  const user = await getCurrentUser()

  const { data: clubs } = await supabase
    .from('clubs')
    .select('id, name, plan, plan_until, courts:courts(id, is_active)')
    .eq('owner_id', user?.id ?? '')
    .order('created_at', { ascending: true })

   
  const now = new Date()
  const start = getBillingStart()
  const enforced = isBillingEnforced(now, start)
  const monthly = getProMonthlyPrice()
  const options = SUBSCRIPTION_MONTH_OPTIONS.map((months) => ({ months, price: subscriptionPrice(months, monthly) }))

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
          <Crown className="w-7 h-7 text-amber-600 dark:text-amber-400" aria-hidden />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t.rich('subtitle', { limit: FREE_COURT_LIMIT, strong: (c) => <strong>{c}</strong> })}
        </p>
      </div>

      <div
        className={`p-4 rounded-xl border text-sm ${
          enforced
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
            : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-900 dark:text-emerald-200'
        }`}
      >
        {enforced
          ? t('enforced', { price: formatVnd(monthly) })
          : start
          ? t('startsOn', { date: formatDate(start) })
          : t('freeNow')}
      </div>

      {(clubs ?? []).length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">{t('noClubs')}</CardContent>
        </Card>
      ) : (
        (clubs ?? []).map((club) => {
          const activeCourts = (club.courts ?? []).filter((c) => c.is_active).length
          const pro = isProActive(club.plan, club.plan_until, now)
          const limit = courtLimit({ plan: club.plan, planUntil: club.plan_until, now, enforced })
          const over = Number.isFinite(limit) && activeCourts > limit
          return (
            <Card key={club.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <CardTitle className="text-lg">{club.name}</CardTitle>
                  {pro ? (
                    <Badge className="bg-amber-400 text-slate-900 gap-1">
                      <Crown className="w-3.5 h-3.5" aria-hidden /> {t('proUntil', { date: formatDate(club.plan_until!) })}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Free</Badge>
                  )}
                </div>
                <CardDescription>
                  {t.rich('activeCourts', { count: activeCourts, strong: (c) => <strong>{c}</strong> })}
                  {Number.isFinite(limit) ? t('ofLimit', { limit }) : t('unlimited')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {over && (
                  <p role="status" className="text-xs p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400">
                    {t('over', { limit })}
                  </p>
                )}
                <div>
                  <h3 className="text-sm font-bold mb-2">{pro ? t('renew') : t('upgrade')}</h3>
                  <SubscriptionCheckoutPanel clubId={club.id} options={options} />
                </div>
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
