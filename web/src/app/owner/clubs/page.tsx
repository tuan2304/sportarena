import { getTranslations } from 'next-intl/server'
import { getLabels } from '@/i18n/labels-server'
import { getSupabase, getCurrentUser } from '@/lib/supabase/session'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ClubFormModal } from '@/components/owner/club-form-modal'
import { CourtFormModal } from '@/components/owner/court-form-modal'
import { CourtItemActions } from '@/components/owner/court-item-actions'
import { ClubItemActions } from '@/components/owner/club-item-actions'
import { ClubLocationButton } from '@/components/owner/club-location-button'
import { ClubImagesButton } from '@/components/owner/club-images-button'
import { fullAddress, hasCoordinates } from '@/lib/maps'
import { Building2, MapPin, Clock, CircleDot, ShieldCheck } from 'lucide-react'

import { formatNumber } from '@/lib/format'
export default async function OwnerClubsPage() {
  const t = await getTranslations('owner.clubs')
  const labels = await getLabels()
  const supabase = await getSupabase()
  const user = await getCurrentUser()

  const { data: clubs } = await supabase
    .from('clubs')
    .select(`
      *,
      courts:courts(*)
    `)
    .eq('owner_id', user?.id || '')
    .order('created_at', { ascending: false })

  const clubList = clubs || []

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('subtitle')}
          </p>
        </div>
        <ClubFormModal />
      </div>

      {/* Clubs List */}
      {clubList.length === 0 ? (
        <Card className="border-dashed border-2 border-border/80">
          <CardContent className="py-16 text-center space-y-3">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground/40" />
            <h3 className="text-lg font-bold text-foreground">{t('emptyTitle')}</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {t('emptyText')}
            </p>
            <div className="pt-2">
              <ClubFormModal />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {clubList.map((club) => {
            const courtList = club.courts || []

            return (
              <Card key={club.id} className="border-border/80 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border/60 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-xl font-bold text-foreground">
                          {club.name}
                        </CardTitle>
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs">
                          <ShieldCheck className="w-3 h-3 mr-1" />
                          {t('active')}
                        </Badge>
                      </div>
                      <CardDescription className="flex items-center gap-1.5 mt-1 text-xs">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span>{club.address}, {club.district}, {club.city}</span>
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                        <span>{club.open_time?.slice(0, 5)} - {club.close_time?.slice(0, 5)}</span>
                      </div>
                      <ClubLocationButton
                        clubId={club.id}
                        clubName={club.name}
                        address={fullAddress(club)}
                        initial={hasCoordinates({ lat: club.latitude, lng: club.longitude }) ? { lat: Number(club.latitude), lng: Number(club.longitude) } : null}
                      />
                      <ClubImagesButton clubId={club.id} clubName={club.name} initial={club.images ?? []} />
                      <CourtFormModal clubId={club.id} clubName={club.name} />
                      <ClubItemActions clubId={club.id} clubName={club.name} />
                    </div>
                  </div>

                  {/* Amenities tags */}
                  {club.amenities && club.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {club.amenities.map((amenity: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-background text-xs text-muted-foreground border border-border/70 capitalize"
                        >
                          {amenity}
                        </span>
                      ))}
                    </div>
                  )}
                </CardHeader>

                <CardContent className="p-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <span>{t('courtList', { count: courtList.length })}</span>
                    </div>

                    {courtList.length === 0 ? (
                      <div className="py-6 text-center border border-dashed border-border rounded-lg bg-muted/10">
                        <p className="text-xs text-muted-foreground mb-2">
                          {t('noCourts')}
                        </p>
                        <CourtFormModal clubId={club.id} clubName={club.name} />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {courtList.map((court: {
                          id: string
                          name: string
                          sport_type: string
                          surface_type: string | null
                          base_price_per_hour: number
                          deposit_percentage: number
                          is_active: boolean
                        }) => (
                          <div
                            key={court.id}
                            className={`p-3.5 rounded-xl border transition-colors flex flex-col justify-between gap-2 ${
                              court.is_active
                                ? 'border-border bg-card hover:border-emerald-500/30'
                                : 'border-border/50 bg-muted/30 opacity-75'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <h4 className="font-bold text-sm text-foreground">{court.name}</h4>
                                  {!court.is_active && (
                                    <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 py-0">
                                      {t('suspended')}
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 capitalize">
                                  <CircleDot className="w-2.5 h-2.5 text-emerald-700 dark:text-emerald-400" />
                                  <span>{labels.sport(court.sport_type)} • {court.surface_type || t('standardSurface')}</span>
                                </div>
                              </div>
                              <Badge variant="secondary" className="text-xs font-semibold">
                                {t('depositPct', { percent: court.deposit_percentage })}
                              </Badge>
                            </div>

                            <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{t('basePrice')}</span>
                              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                {formatNumber(court.base_price_per_hour)} đ/h
                              </span>
                            </div>

                            <CourtItemActions courtId={court.id} isActive={court.is_active} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
