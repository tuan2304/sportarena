import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { MainHeader } from '@/components/layout/main-header'
import { MatchFilters } from '@/components/matches/match-filters'
import { MatchCard, type MatchCardProps } from '@/components/matches/match-card'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { isMatchEnded } from '@/lib/match-time'
import { Flame, PlusCircle, Trophy, Users } from 'lucide-react'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('matches')
  return { title: t('metaTitle'), description: t('metaDescription'), alternates: { canonical: '/matches' } }
}

interface MatchesPageProps {
  searchParams: Promise<{
    sport?: string
    skill?: string
    cost?: string
    q?: string
  }>
}

export default async function MatchesPage({ searchParams }: MatchesPageProps) {
  const { sport, skill, cost, q } = await searchParams
  const t = await getTranslations('matches')
  const supabase = await createClient()
  // eslint-disable-next-line react-hooks/purity -- server component, chạy một lần mỗi request
  const nowMs = Date.now()

  let query = supabase
    .from('matches')
    .select(`
      id,
      title,
      description,
      sport_type,
      skill_level,
      required_players,
      current_players,
      cost_sharing_type,
      cost_per_person,
      status,
      created_at,
      creator:profiles (
        id,
        full_name,
        avatar_url,
        rating
      ),
      start_time,
      end_time,
      court:courts (
        id,
        name,
        club:clubs (
          id,
          name,
          address,
          district
        )
      )
    `)
    .in('status', ['open', 'full'])
    // Qua giờ kết thúc của khung giờ đã đặt thì kèo không còn hiện ở danh sách
    .gt('end_time', new Date(nowMs).toISOString())
    .order('created_at', { ascending: false })

  if (sport && sport !== 'all') {
    query = query.eq('sport_type', sport)
  }

  if (skill && skill !== 'all') {
    query = query.eq('skill_level', skill)
  }

  if (cost && cost !== 'all') {
    query = query.eq('cost_sharing_type', cost)
  }

  if (q) {
    query = query.ilike('title', `%${q}%`)
  }

  const { data: matches } = await query
  // Lọc thêm ở đây phòng khi dữ liệu trả về lúc cắt trang đã chớm qua giờ kết thúc
  const matchList = (matches || []).filter((m) => !isMatchEnded(m.end_time, nowMs))

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <MainHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-amber-600 via-orange-500 to-amber-700 text-white p-6 sm:p-10 shadow-lg shadow-amber-500/10">
          <div className="relative z-10 max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold uppercase tracking-wider text-amber-100">
              <Flame className="w-3.5 h-3.5 text-amber-300" />
              {t('hero.badge')}
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
              {t('hero.title')}
            </h1>
            <p className="text-xs sm:text-sm text-amber-100/90 max-w-xl">
              {t('hero.text')}
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Link href="/my-bookings">
                <Button
                  size="sm"
                  className="bg-white text-amber-700 hover:bg-amber-50 font-bold shadow-md cursor-pointer text-xs sm:text-sm h-10 px-4"
                >
                  <PlusCircle className="w-4 h-4 mr-1.5" />
                  {t('hero.openFromMine')}
                </Button>
              </Link>
              <Link href="/clubs">
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-black/20 hover:bg-black/30 text-white border-white/30 font-semibold cursor-pointer text-xs sm:text-sm h-10 px-4"
                >
                  {t('hero.bookNew')}
                </Button>
              </Link>
            </div>
          </div>

          {/* Decorative sport badge in background */}
          <div className="absolute -right-10 -bottom-10 opacity-15 pointer-events-none hidden sm:block">
            <Users className="w-80 h-80 text-white" />
          </div>
        </div>

        {/* Filter Bar */}
        <MatchFilters />

        {/* Matches Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-500" />
              {t('listTitle', { count: matchList.length })}
            </h2>
            <div className="text-xs text-muted-foreground hidden sm:block">
              {t('live')}
            </div>
          </div>

          {matchList.length === 0 ? (
            <Card className="p-12 text-center border-dashed border-2 space-y-3">
              <Trophy className="w-12 h-12 text-muted-foreground/30 mx-auto" />
              <h3 className="text-base font-bold text-foreground">{t('emptyTitle')}</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {t('emptyText')}
              </p>
              <div className="pt-2 flex justify-center gap-3">
                <Link href="/my-bookings">
                  <Button size="sm" className="bg-amber-400 hover:bg-amber-300 text-slate-900 cursor-pointer">
                    {t('openNow')}
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {matchList.map((match) => (
                <MatchCard key={match.id} match={match as unknown as MatchCardProps['match']} nowMs={nowMs} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
