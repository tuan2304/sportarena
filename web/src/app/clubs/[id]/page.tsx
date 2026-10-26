import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { getSupabase, getCurrentUser } from '@/lib/supabase/session'
import { MainHeader } from '@/components/layout/main-header'
import { TimeSlotPicker } from '@/components/booking/time-slot-picker'
import { ClubReviewsSection } from '@/components/clubs/club-reviews-section'
import { getClubReviews } from '@/app/actions/reviews'
import { Badge } from '@/components/ui/badge'
import { RemoteImage } from '@/components/ui/remote-image'
import { canAcceptBookings } from '@/lib/payment-channel'
import { MapEmbed } from '@/components/maps/map-embed'
import { DirectionsLinks } from '@/components/maps/directions-links'
import { fullAddress, hasCoordinates } from '@/lib/maps'
import { bookableCourtIds, courtLimit, isBillingEnforced } from '@/lib/billing'
import { MapPin, Clock, ArrowLeft, Sparkles, ShieldCheck } from 'lucide-react'
import { resolveAppUrl } from '@/lib/app-url'
import { describePolicy } from '@/lib/cancellation'
import { clubDescription, clubJsonLd, serializeJsonLd, shareImage } from '@/lib/seo'

interface ClubDetailPageProps {
  params: Promise<{
    id: string
  }>
}

export async function generateMetadata({ params }: ClubDetailPageProps): Promise<Metadata> {
  const { id } = await params
  const t = await getTranslations('clubs.detail')
  const supabase = await getSupabase()
  const { data: club } = await supabase
    .from('clubs')
    .select('name, description, address, district, city, images')
    .eq('id', id)
    .maybeSingle()

  if (!club) return { title: t('notFound'), robots: { index: false } }

  const description = clubDescription(club, (await getLocale()) === 'en' ? 'en' : 'vi')
  const image = shareImage(club.images)
  return {
    title: club.name,
    description,
    alternates: { canonical: `/clubs/${id}` },
    openGraph: { type: 'website', title: club.name, description, url: `/clubs/${id}`, ...(image ? { images: [image] } : {}) },
    twitter: { card: image ? 'summary_large_image' : 'summary', title: club.name, description, ...(image ? { images: [image] } : {}) },
  }
}

export default async function ClubDetailPage({ params }: ClubDetailPageProps) {
  const { id } = await params
  const t = await getTranslations('clubs.detail')
  const lang = (await getLocale()) === 'en' ? 'en' : 'vi'
  const supabase = await getSupabase()
  const user = await getCurrentUser()

  // Cụm sân, sân con và đánh giá không phụ thuộc nhau → lấy đồng thời (mỗi lượt đi về tới Singapore tốn 0,3 - 1 giây)
  const [{ data: club }, { data: courts }, initialReviews] = await Promise.all([
    supabase.from('clubs').select('*').eq('id', id).single(),
    supabase
      .from('courts')
      .select(`
        id,
        created_at,
        name,
        sport_type,
        surface_type,
        base_price_per_hour,
        deposit_percentage,
        is_active,
        court_pricing_rules (*)
      `)
      .eq('club_id', id)
      .eq('is_active', true),
    getClubReviews(id),
  ])

  if (!club) {
    notFound()
  }

  const courtList = (courts || []).map((c) => ({
    id: c.id,
    name: c.name,
    sport_type: c.sport_type,
    surface_type: c.surface_type,
    base_price_per_hour: Number(c.base_price_per_hour),
    deposit_percentage: Number(c.deposit_percentage),
    is_active: c.is_active,
    court_pricing_rules: (c.court_pricing_rules || []).map((r) => ({
      id: r.id,
      name: r.name,
      start_time: r.start_time,
      end_time: r.end_time,
      price_per_hour: Number(r.price_per_hour),
      days_of_week: r.days_of_week,
    })),
  }))

  // Sân vượt giới hạn gói Free (chỉ khi đã bắt đầu thu phí) tạm không nhận đặt
   
  const now = new Date()
  const limit = courtLimit({ plan: club.plan, planUntil: club.plan_until, now, enforced: isBillingEnforced(now) })
  const allowedIds = bookableCourtIds(courts ?? [], limit)
  const bookableCourts = courtList.filter((c) => allowedIds.has(c.id))
  const acceptsPayments = canAcceptBookings(club.accepts_online_payment, club.accepts_manual_transfer)

  const courtIds = bookableCourts.map((c) => c.id)

  const mapPlace = { lat: club.latitude, lng: club.longitude, name: club.name, address: fullAddress(club) }
  const isPinned = hasCoordinates(mapPlace)

  // 3. Lấy bookings của các sân con này
  let existingBookings: Array<{
    id: string
    court_id: string
    start_time: string
    end_time: string
    status: string
  }> = []

  if (courtIds.length > 0) {
    // RPC công khai chỉ trả khung giờ bận (không lộ người đặt). Trước đây RLS khiến người chơi
    // chỉ thấy đơn của chính mình nên lưới giờ hiển thị sai.
    const { data: busy } = await supabase.rpc('get_busy_slots', { p_court_ids: courtIds })

    existingBookings = (busy || []).map((b, i) => ({
      id: `${b.court_id}-${i}`,
      court_id: b.court_id,
      start_time: b.start_time,
      end_time: b.end_time,
      status: b.status,
    }))
  }

  const imageSrc =
    club.images && club.images[0]
      ? club.images[0]
      : 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&q=80&w=1200'

  const jsonLd = clubJsonLd(club, `${resolveAppUrl()}/clubs/${club.id}`, initialReviews.map((r) => Number(r.rating)))

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <MainHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        {/* Back Link */}
        <div>
          <Link
            href="/clubs"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {t('backToList')}
          </Link>
        </div>

        {/* Club Hero Banner */}
        <div className="relative rounded-3xl overflow-hidden border border-border bg-card shadow-sm">
          <div className="h-64 sm:h-80 w-full relative">
            <RemoteImage
              src={imageSrc}
              alt={club.name}
              sizes="(min-width: 1280px) 1200px, 100vw"
              priority
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            <div className="absolute top-4 left-4 flex gap-2">
              <Badge className="bg-emerald-800/95 text-white font-semibold backdrop-blur-xs">
                <Sparkles className="w-3 h-3 mr-1" /> {t('active')}
              </Badge>
            </div>
          </div>

          <div className="p-6 sm:p-8 -mt-16 sm:-mt-20 relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3">
              <h1 className="text-2xl sm:text-4xl font-black text-foreground tracking-tight">
                {club.name}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  {club.address}, {club.ward ? `${club.ward}, ` : ''}{club.district}, {club.city}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
                  {t('openingHours', { open: club.open_time?.slice(0, 5) ?? '', close: club.close_time?.slice(0, 5) ?? '' })}
                </span>
              </div>

              {/* Amenities */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(club.amenities || ['wifi', 'parking', 'shower', 'lighting']).map((amenity: string, idx: number) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-md bg-background text-xs text-muted-foreground border border-border/70 capitalize font-medium"
                  >
                    ✓ {amenity}
                  </span>
                ))}
              </div>
            </div>

            <div className="text-xs text-muted-foreground max-w-md">
              {club.description || t('defaultDescription')}
            </div>
          </div>
        </div>

        {/* Vị trí & chỉ đường */}
        <section
          aria-labelledby="club-location-title"
          className="grid md:grid-cols-5 rounded-2xl border border-border bg-card overflow-hidden shadow-sm"
        >
          <div className="md:col-span-2 p-6 space-y-4">
            <h2 id="club-location-title" className="text-xl font-extrabold text-foreground tracking-tight">
              {t('locationTitle')}
            </h2>
            <p className="flex items-start gap-2 text-sm text-foreground">
              <MapPin className="w-4 h-4 mt-0.5 text-emerald-700 dark:text-emerald-400 shrink-0" aria-hidden />
              {mapPlace.address}
            </p>
            {!isPinned && (
              <p className="text-xs text-muted-foreground">
                {t('notPinned')}
              </p>
            )}
            <DirectionsLinks place={mapPlace} />
          </div>
          <div className="md:col-span-3">
            <MapEmbed place={mapPlace} title={t('mapTitle', { name: club.name })} className="h-72 md:h-full md:min-h-72" />
          </div>
        </section>

        {/* Booking Slot Picker Section */}
        <div className="pt-2">
          <div className="mb-4">
            <h2 className="text-xl font-extrabold text-foreground tracking-tight">
              {t('pickerTitle')}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('pickerSubtitle')}
            </p>
          </div>

          {acceptsPayments && (
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden />
              <span>
                <strong className="text-foreground">{t('cancelPolicy')}</strong> {describePolicy(club.free_cancel_hours, lang)}
                {club.accepts_manual_transfer && !club.accepts_online_payment && t('manualTransferNote')}
              </span>
            </p>
          )}
          {acceptsPayments ? (
            <TimeSlotPicker
              courts={bookableCourts}
              existingBookings={existingBookings}
              clubOpenTime={club.open_time || '06:00:00'}
              clubCloseTime={club.close_time || '23:00:00'}
              cancelPolicy={describePolicy(club.free_cancel_hours, lang)}
            />
          ) : (
            <div role="status" className="p-8 text-center border border-dashed rounded-xl text-sm text-muted-foreground">
              {t('noPayments')}
            </div>
          )}
        </div>

        {/* Club Reviews & Ratings Section */}
        <ClubReviewsSection
          clubId={id}
          currentUserId={user?.id || null}
          initialReviews={initialReviews}
        />
      </main>
    </div>
  )
}
