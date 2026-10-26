import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { getLabels } from '@/i18n/labels-server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MainHeader } from '@/components/layout/main-header'
import { ClubFilters } from '@/components/clubs/club-filters'
import { ClubPagination } from '@/components/clubs/club-pagination'
import { ClubCardOverlay, type ClubOverlayData } from '@/components/clubs/club-card-overlay'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RemoteImage } from '@/components/ui/remote-image'
import { DirectionsLinks } from '@/components/maps/directions-links'
import { fullAddress } from '@/lib/maps'
import { Button } from '@/components/ui/button'
import { MapPin, Clock, ArrowRight, Trophy, Sparkles } from 'lucide-react'

import { formatNumber } from '@/lib/format'
import {
  ALL_DISTRICTS,
  ALL_SPORTS,
  clubsHref,
  pageRange,
  parsePage,
  sanitizeSearch,
  totalPages as countPages,
} from '@/lib/club-search'

export async function generateMetadata({ searchParams }: ClubsPageProps): Promise<Metadata> {
  const params = await searchParams
  const page = parsePage(params.page)
  const q = sanitizeSearch(params.q)
  const t = await getTranslations('clubs')
  return {
    title: page > 1 ? t('metaTitlePage', { page }) : t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: clubsHref({ sport: params.sport, district: params.district, page }) },
    // Kết quả tìm theo từ khóa là vô hạn biến thể, không nên để công cụ tìm kiếm lập chỉ mục
    robots: q ? { index: false, follow: true } : undefined,
  }
}

interface ClubsPageProps {
  searchParams: Promise<{
    sport?: string
    district?: string
    q?: string
    page?: string
  }>
}

// Ghép thêm một bản nhúng courts!inner chỉ khi lọc theo môn: lọc cụm sân có ít nhất một sân thuộc môn đó
// mà vẫn giữ nguyên danh sách sân con (courts) để hiện giá và các môn của cụm sân.
const CLUB_SELECT = `*, courts:courts(*)`
const CLUB_SELECT_BY_SPORT = `*, courts:courts(*), sport_match:courts!inner(sport_type)`

type ClubRow = {
  id: string
  name: string
  address: string
  ward: string | null
  district: string | null
  city: string | null
  description: string | null
  latitude: number | null
  longitude: number | null
  open_time: string
  close_time: string
  images: string[] | null
  amenities: string[] | null
  courts: Array<{
    id: string
    name: string
    sport_type: string
    surface_type: string | null
    base_price_per_hour: number
    deposit_percentage: number
    is_active: boolean | null
  }> | null
}

export default async function ClubsPage({ searchParams }: ClubsPageProps) {
  const t = await getTranslations('clubs')
  const labels = await getLabels()
  const params = await searchParams
  const sportFilter = params.sport || ALL_SPORTS
  const districtFilter = params.district || ALL_DISTRICTS
  const searchQuery = sanitizeSearch(params.q)
  const page = parsePage(params.page)
  const filters = { sport: sportFilter, district: districtFilter, q: searchQuery }

  const supabase = await createClient()
  const bySport = sportFilter !== ALL_SPORTS

  // Lọc và cắt trang ở database: chỉ tải 12 cụm sân của trang hiện tại thay vì toàn bộ rồi lọc trong bộ nhớ
  let query = supabase
    .from('clubs')
    .select(bySport ? CLUB_SELECT_BY_SPORT : CLUB_SELECT, { count: 'exact' })
    .eq('is_active', true)

  if (searchQuery) {
    const term = `%${searchQuery}%`
    query = query.or(`name.ilike.${term},address.ilike.${term},district.ilike.${term}`)
  }
  if (districtFilter !== ALL_DISTRICTS && districtFilter !== 'all') {
    query = query.ilike('district', `%${sanitizeSearch(districtFilter)}%`)
  }
  if (bySport) {
    query = query.eq('sport_match.sport_type', sportFilter)
  }

  const [from, to] = pageRange(page)
  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: true }) // thứ tự ổn định để hai trang liên tiếp không lặp hay sót cụm sân
    .range(from, to)

  const totalClubs = count ?? 0
  const pages = countPages(totalClubs)

  // Trang vượt quá số trang hiện có (do bộ lọc đổi hoặc link cũ): về trang đầu của cùng bộ lọc
  if ((error || (data ?? []).length === 0) && page > 1) {
    redirect(clubsHref({ ...filters, page: 1 }))
  }

  const filteredClubs = (data ?? []) as unknown as ClubRow[]

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <MainHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Banner Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              {t('badge')}
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-foreground animate-fade-up">
              {t('heading')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              {t('subheading')}
            </p>
          </div>
        </div>

        {/* Filters */}
        <ClubFilters />

        {/* Clubs Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            <span>
              {t('found', { count: totalClubs })}
              {pages > 1 && t('pageOf', { page, pages })}
            </span>
          </div>

          {filteredClubs.length === 0 ? (
            <Card className="border-dashed border-2 p-16 text-center">
              <Trophy className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <h3 className="text-base font-bold text-foreground">{t('emptyTitle')}</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
                {t('emptyText')}
              </p>
              <Link href="/clubs">
                <Button size="sm" variant="outline" className="cursor-pointer">
                  {t('viewAll')}
                </Button>
              </Link>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClubs.map((club, cardIndex) => {
                const courts = (club.courts || []).filter((c) => c.is_active !== false)
                const sports = Array.from(new Set(courts.map((c) => c.sport_type)))
                const prices = courts.map((c) => Number(c.base_price_per_hour))
                const minPrice = prices.length > 0 ? Math.min(...prices) : 0

                const imageSrc =
                  club.images && club.images[0]
                    ? club.images[0]
                    : 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&q=80&w=800'

                const overlay: ClubOverlayData = {
                  id: club.id,
                  name: club.name,
                  address: fullAddress(club),
                  openTime: club.open_time?.slice(0, 5) ?? '',
                  closeTime: club.close_time?.slice(0, 5) ?? '',
                  images: club.images ?? [],
                  amenities: club.amenities ?? [],
                  description: club.description,
                  place: { lat: club.latitude, lng: club.longitude, name: club.name, address: fullAddress(club) },
                  courts: courts.map((c) => ({
                    id: c.id,
                    name: c.name,
                    sportLabel: labels.sport(c.sport_type),
                    surface: c.surface_type,
                    price: Number(c.base_price_per_hour),
                    depositPercentage: Number(c.deposit_percentage),
                  })),
                }

                return (
                  <ClubCardOverlay
                    key={club.id}
                    club={overlay}
                    className="card-lift animate-fade-up stagger border-border shadow-sm hover:border-emerald-500/40 overflow-hidden flex flex-col justify-between group"
                    style={{ '--i': cardIndex } as CSSProperties}
                  >
                    <div>
                      {/* Image Preview */}
                      <div className="relative h-48 w-full bg-muted overflow-hidden">
                        <RemoteImage
                          src={imageSrc}
                          alt={club.name}
                          sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                          className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                        />
                        <div className="absolute top-3 right-3">
                          <Badge className="bg-background/90 text-foreground backdrop-blur-md border border-border/60 text-xs font-semibold shadow-xs">
                            <Clock className="w-3 h-3 text-emerald-700 dark:text-emerald-400 mr-1" />
                            {club.open_time?.slice(0, 5)} - {club.close_time?.slice(0, 5)}
                          </Badge>
                        </div>
                      </div>

                      <CardContent className="p-5 space-y-3">
                        <div>
                          <h3 className="font-bold text-lg text-foreground group-hover:text-emerald-600 transition-colors">
                            {club.name}
                          </h3>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                            <MapPin className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                            <span className="truncate">{club.address}, {club.district}</span>
                          </p>
                          <DirectionsLinks
                            compact
                            className="mt-1.5"
                            place={{ lat: club.latitude, lng: club.longitude, name: club.name, address: fullAddress(club) }}
                          />
                        </div>

                        {/* Sport types badges */}
                        <div className="flex flex-wrap gap-1.5">
                          {sports.map((s, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-semibold capitalize"
                            >
                              {labels.sport(s)}
                            </span>
                          ))}
                        </div>

                        {/* Amenities */}
                        {club.amenities && club.amenities.length > 0 && (
                          <div className="text-xs text-muted-foreground flex items-center gap-2 pt-1 border-t border-border/50 truncate">
                            <span>{t('amenities')}</span>
                            <span className="font-medium text-foreground truncate">
                              {club.amenities.join(' • ')}
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </div>

                    {/* Bottom CTA */}
                    <div className="p-5 pt-0 border-t border-border/50 flex items-center justify-between mt-auto">
                      <div>
                        <div className="text-xs text-muted-foreground">{t('priceFrom')}</div>
                        <div className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
                          {formatNumber(minPrice)} đ/h
                        </div>
                      </div>

                      <Link href={`/clubs/${club.id}`}>
                        <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold cursor-pointer shadow-xs">
                          {t('bookNow')} <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                        </Button>
                      </Link>
                    </div>
                  </ClubCardOverlay>
                )
              })}
            </div>
          )}

          <ClubPagination page={page} totalPages={pages} filters={filters} />
        </div>
      </main>
    </div>
  )
}
