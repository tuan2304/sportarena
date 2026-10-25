import { getTranslations } from 'next-intl/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PlanActions } from '@/components/admin/admin-forms'
import { isProActive } from '@/lib/billing'
import { formatDate } from '@/lib/format'

export async function generateMetadata() {
  const t = await getTranslations('admin.finance')
  return { title: t('metaTitle') }
}

// Quyền admin đã được kiểm tra ở app/admin/layout.tsx
export default async function AdminFinancePage() {
  const t = await getTranslations('admin.finance')
  // Trang chỉ dành cho admin nên dùng service_role để xem toàn bộ cụm sân
  const admin = createAdminClient()
  const { data: clubs } = await admin
    .from('clubs')
    .select('id, name, plan, plan_until, accepts_online_payment, owner:profiles!clubs_owner_id_fkey(full_name), courts(id, is_active)')
    .order('created_at', { ascending: true })

  const now = new Date()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('cardTitle')}</CardTitle>
          <CardDescription>{t('cardSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(clubs ?? []).map((club) => {
            const pro = isProActive(club.plan, club.plan_until, now)
            const active = (club.courts ?? []).filter((c) => c.is_active).length
            return (
              <div key={club.id} className="p-4 rounded-xl border border-border flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-bold flex items-center gap-2 flex-wrap">
                    {club.name}
                    {pro ? (
                      <Badge className="bg-amber-400 text-slate-900">{t('proUntil', { date: formatDate(club.plan_until!) })}</Badge>
                    ) : (
                      <Badge variant="outline">Free</Badge>
                    )}
                    {club.accepts_online_payment ? (
                      <Badge className="bg-emerald-700 text-white">{t('ownPayos')}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-800 dark:text-amber-300 border-amber-500/40">{t('notConnected')}</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t('owner', { name: club.owner?.full_name || '—', count: active })}
                  </div>
                </div>
                <PlanActions clubId={club.id} />
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
