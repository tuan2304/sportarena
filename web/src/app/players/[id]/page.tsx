import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { getLabels } from '@/i18n/labels-server'
import { notFound } from 'next/navigation'
import { getSupabase, getCurrentUser } from '@/lib/supabase/session'
import { MainHeader } from '@/components/layout/main-header'
import { Avatar } from '@/components/profile/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate, formatTime } from '@/lib/format'
import { fetchReputations } from '@/lib/reputation'
import { ReputationBadge } from '@/components/profile/reputation-badge'
import { Calendar, Flame, Star, Trophy, Users } from 'lucide-react'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface PlayerPageProps {
  params: Promise<{ id: string }>
}

// Chỉ các cột công khai của profiles (khách cũng đọc được); số điện thoại và vai trò không bao giờ nằm ở đây
const PUBLIC_COLUMNS = 'id, full_name, avatar_url, skill_level, rating'

export async function generateMetadata({ params }: PlayerPageProps): Promise<Metadata> {
  const { id } = await params
  const t = await getTranslations('profile.player')
  if (!UUID.test(id)) return { title: t('notFound'), robots: { index: false } }
  const supabase = await getSupabase()
  const { data } = await supabase.from('profiles').select('full_name').eq('id', id).maybeSingle()
  return {
    title: data?.full_name ? t('metaTitle', { name: data.full_name }) : t('notFound'),
    // Hồ sơ cá nhân không nên xuất hiện trên công cụ tìm kiếm
    robots: { index: false, follow: true },
  }
}

export default async function PlayerPage({ params }: PlayerPageProps) {
  const { id } = await params
  const t = await getTranslations('profile.player')
  const labels = await getLabels()
  if (!UUID.test(id)) notFound()

  const supabase = await getSupabase()
  const viewer = await getCurrentUser()

  const [{ data: profile }, { data: stats }, { data: openMatches }] = await Promise.all([
    supabase.from('profiles').select(PUBLIC_COLUMNS).eq('id', id).maybeSingle(),
    supabase.rpc('player_public_stats', { p_user: id }),
    supabase
      .from('matches')
      .select('id, title, sport_type, current_players, required_players, start_time, end_time')
      .eq('creator_id', id)
      .eq('status', 'open')
      // Kèo đã qua giờ kết thúc không còn là "kèo đang mở"
      .gt('end_time', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  if (!profile) notFound()

  const reputation = (await fetchReputations(supabase, [profile.id])).get(profile.id)

  const s = stats?.[0] ?? { matches_created: 0, matches_joined: 0, bookings_played: 0 }
  const isMe = viewer?.id === profile.id
  const tiles = [
    { icon: Calendar, label: t('played'), value: s.bookings_played },
    { icon: Flame, label: t('created'), value: s.matches_created },
    { icon: Users, label: t('joined'), value: s.matches_joined },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <MainHeader />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Card className="overflow-hidden">
          <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center gap-5">
            <Avatar name={profile.full_name} src={profile.avatar_url} size={88} />
            <div className="flex-1 space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{profile.full_name || t('fallback')}</h1>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                  <Trophy className="w-3.5 h-3.5 mr-1" aria-hidden />
                  {labels.playerSkill(profile.skill_level)}
                </Badge>
                {profile.rating !== null && (
                  <Badge variant="outline" className="border-amber-500/30 text-amber-700 dark:text-amber-400">
                    <Star className="w-3.5 h-3.5 mr-1" aria-hidden />
                    {Number(profile.rating).toFixed(1)}
                  </Badge>
                )}
                <ReputationBadge reputation={reputation} />
              </div>
            </div>
            {isMe && (
              <Link href="/profile">
                <Button variant="outline" size="sm" className="cursor-pointer">{t('edit')}</Button>
              </Link>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-3">
          {tiles.map(({ icon: Icon, label, value }) => (
            <Card key={label}>
              <CardContent className="p-4 text-center space-y-1">
                <Icon className="w-5 h-5 mx-auto text-emerald-700 dark:text-emerald-400" aria-hidden />
                <div className="text-2xl font-extrabold">{value}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <section aria-labelledby="open-matches" className="space-y-3">
          <h2 id="open-matches" className="text-lg font-bold">{t('openMatches')}</h2>
          {(openMatches ?? []).length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">{t('noOpenMatches')}</CardContent>
            </Card>
          ) : (
            <ul className="space-y-2">
              {(openMatches ?? []).map((m) => {
                return (
                  <li key={m.id}>
                    <Link href={`/matches/${m.id}`}>
                      <Card className="hover:border-emerald-500/40 transition-colors">
                        <CardContent className="p-4 flex items-center justify-between gap-3">
                          <div className="space-y-0.5 min-w-0">
                            <div className="font-bold text-sm truncate">{m.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatTime(m.start_time)} - {formatTime(m.end_time)} ({formatDate(m.start_time)})
                            </div>
                          </div>
                          <Badge variant="outline" className="shrink-0">{t('playersCount', { current: m.current_players, required: m.required_players })}</Badge>
                        </CardContent>
                      </Card>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
