import { getTranslations } from 'next-intl/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AnnouncementForm } from '@/components/admin/announcement-form'
import { ANNOUNCEMENT_AUDIENCES, ANNOUNCEMENT_KINDS } from '@/lib/support'
import { formatDate, formatTime } from '@/lib/format'

export async function generateMetadata() {
  const t = await getTranslations('admin.announce')
  return { title: t('metaTitle') }
}

export default async function AdminAnnouncementsPage() {
  const t = await getTranslations('admin.announce')
  const { data: history } = await createAdminClient()
    .from('announcements')
    .select('id, title, body, kind, audience, sent_count, sent_at, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-extrabold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('compose')}</CardTitle>
          <CardDescription>{t('composeHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <AnnouncementForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('recent')}</CardTitle>
        </CardHeader>
        <CardContent>
          {(history ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('none')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {(history ?? []).map((a) => (
                <li key={a.id} className="py-3 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{a.title}</span>
                    <Badge variant="outline" className="text-xs">{ANNOUNCEMENT_KINDS.some((k) => k.id === a.kind) ? t(`kinds.${a.kind as 'update' | 'maintenance' | 'promo'}`) : a.kind}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.body}</p>
                  <div className="text-xs text-muted-foreground">
                    {t('meta', { audience: ANNOUNCEMENT_AUDIENCES.some((x) => x.id === a.audience) ? t(`audiences.${a.audience as 'all' | 'owners' | 'players'}`) : a.audience, count: a.sent_count, date: formatDate(a.sent_at ?? a.created_at), time: formatTime(a.sent_at ?? a.created_at) })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
