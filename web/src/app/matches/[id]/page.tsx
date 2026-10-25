import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSupabase, getCurrentUser } from '@/lib/supabase/session'
import { MainHeader } from '@/components/layout/main-header'
import { MatchDetailView, type MatchDetailProps } from '@/components/matches/match-detail-view'
import { getMatchMessages } from '@/app/actions/chat'
import { truncateDescription } from '@/lib/seo'

interface MatchDetailPageProps {
  params: Promise<{
    id: string
  }>
}

export async function generateMetadata({ params }: MatchDetailPageProps): Promise<Metadata> {
  const { id } = await params
  const t = await getTranslations('matches')
  const supabase = await getSupabase()
  const { data: match } = await supabase.from('matches').select('title, description').eq('id', id).maybeSingle()
  if (!match) return { title: t('notFound'), robots: { index: false } }

  const description = truncateDescription(match.description || t('detailMetaDescription', { title: match.title }))
  return {
    title: match.title,
    description,
    alternates: { canonical: `/matches/${id}` },
    openGraph: { type: 'website', title: match.title, description, url: `/matches/${id}` },
  }
}

export default async function MatchDetailPage({ params }: MatchDetailPageProps) {
  const { id } = await params
  const supabase = await getSupabase()
  const user = await getCurrentUser()

  // 1. Fetch match details
  const { data: match, error } = await supabase
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
      creator_id,
      created_at,
      creator:profiles (
        id,
        full_name,
        avatar_url
      ),
      booking:bookings (
        id,
        start_time,
        end_time,
        total_price,
        court:courts (
          id,
          name,
          sport_type,
          club:clubs (
            id,
            name,
            address,
            district,
            city,
            latitude,
            longitude
          )
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !match) {
    notFound()
  }

  // Thành viên và tin nhắn không phụ thuộc nhau → lấy đồng thời
  const [{ data: participants }, initialMessages] = await Promise.all([
    supabase
      .from('match_participants')
      .select(`
        id,
        user_id,
        status,
        message,
        joined_at,
        user:profiles (
          id,
          full_name,
          avatar_url,
          skill_level
        )
      `)
      .eq('match_id', id)
      .order('joined_at', { ascending: true }),
    getMatchMessages(id),
  ])

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <MainHeader />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <MatchDetailView
          match={match as unknown as MatchDetailProps['match']}
          participants={(participants ?? []) as unknown as MatchDetailProps['participants']}
          initialMessages={initialMessages}
          currentUserId={user?.id || null}
        />
      </main>
    </div>
  )
}
