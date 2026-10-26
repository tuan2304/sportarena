'use client'

import { useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight, Clock, MapPin, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RemoteImage } from '@/components/ui/remote-image'
import { DirectionsLinks } from '@/components/maps/directions-links'
import { formatNumber } from '@/lib/format'
import type { PlaceRef } from '@/lib/maps'

export interface ClubOverlayData {
  id: string
  name: string
  address: string
  openTime: string
  closeTime: string
  images: string[]
  amenities: string[]
  description: string | null
  place: PlaceRef
  courts: Array<{
    id: string
    name: string
    sportLabel: string
    surface: string | null
    price: number
    depositPercentage: number
  }>
}

interface ClubCardOverlayProps {
  club: ClubOverlayData
  className?: string
  style?: CSSProperties
  /** Nội dung thẻ, đã render ở server */
  children: ReactNode
}

/**
 * Thẻ cụm sân trong danh sách: bấm vào bất kỳ chỗ nào của thẻ (trừ liên kết bên trong) sẽ mở overlay chi tiết.
 * Hộp thoại đặt NGOÀI thẻ để sự kiện click bên trong overlay (portal) không nổi bọt ngược lên thẻ và mở lại.
 */
export function ClubCardOverlay({ club, className, style, children }: ClubCardOverlayProps) {
  const t = useTranslations('clubs.overlay')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const onCardClick = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('a')) return
    setActive(0)
    setOpen(true)
  }

  return (
    <>
      <Card className={`cursor-pointer ${className ?? ''}`} style={style} onClick={onCardClick}>
        {/* Lối vào cho bàn phím / trình đọc màn hình: chỉ hiện khi được focus */}
        <button
          type="button"
          aria-haspopup="dialog"
          className="sr-only focus:not-sr-only focus:absolute focus:z-10 focus:m-2 focus:rounded-md focus:bg-background focus:px-3 focus:py-1.5 focus:text-xs focus:font-semibold focus:ring-2 focus:ring-emerald-600"
        >
          {t('open', { name: club.name })}
        </button>
        {children}
      </Card>
      <ClubOverlayDialog club={club} open={open} onOpenChange={setOpen} active={active} onActiveChange={setActive} />
    </>
  )
}

interface ClubOverlayDialogProps {
  club: ClubOverlayData
  open: boolean
  onOpenChange: (open: boolean) => void
  active: number
  onActiveChange: (index: number) => void
}

function ClubOverlayDialog({ club, open, onOpenChange, active, onActiveChange }: ClubOverlayDialogProps) {
  const t = useTranslations('clubs.overlay')
  const td = useTranslations('clubs.detail')
  const images = club.images
  const current = images[Math.min(active, images.length - 1)]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        {current && (
          <div className="space-y-2">
            <div className="relative h-52 sm:h-64 w-full overflow-hidden rounded-lg bg-muted">
              <RemoteImage src={current} alt={club.name} sizes="(min-width: 672px) 640px, 100vw" className="object-cover" />
            </div>
            {images.length > 1 && (
              <ul className="flex gap-2 overflow-x-auto" aria-label={t('photos')}>
                {images.map((src, i) => (
                  <li key={src + i} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => onActiveChange(i)}
                      aria-label={t('photo', { index: i + 1 })}
                      aria-current={i === active}
                      className={`relative block h-14 w-20 overflow-hidden rounded-md bg-muted cursor-pointer ring-2 ${
                        i === active ? 'ring-emerald-600' : 'ring-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <RemoteImage src={src} alt="" sizes="80px" className="object-cover" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold">{club.name}</DialogTitle>
          <DialogDescription className="flex flex-col gap-1">
            <span className="flex items-start gap-1.5">
              <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden />
              {club.address}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 shrink-0 text-teal-700 dark:text-teal-400" aria-hidden />
              {td('openingHours', { open: club.openTime, close: club.closeTime })}
            </span>
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">{club.description || td('defaultDescription')}</p>

        {club.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {club.amenities.map((amenity, i) => (
              <span
                key={i}
                className="px-2.5 py-1 rounded-md bg-background text-xs text-muted-foreground border border-border/70 capitalize font-medium"
              >
                ✓ {amenity}
              </span>
            ))}
          </div>
        )}

        <section aria-labelledby={`club-courts-${club.id}`} className="space-y-2">
          <h3 id={`club-courts-${club.id}`} className="text-sm font-bold text-foreground">
            {t('courts', { count: club.courts.length })}
          </h3>
          {club.courts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noCourts')}</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden text-sm">
              {club.courts.map((court) => (
                <li key={court.id} className="flex items-center justify-between gap-3 p-3 bg-card">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{court.name}</p>
                    <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2">
                      <span className="capitalize">{court.sportLabel}</span>
                      <span>• {court.surface || t('standardSurface')}</span>
                      <span className="inline-flex items-center gap-1">
                        <Wallet className="w-3 h-3" aria-hidden /> {t('deposit', { percent: court.depositPercentage })}
                      </span>
                    </p>
                  </div>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                    {t('perHour', { price: formatNumber(court.price) })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <DirectionsLinks place={club.place} />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="cursor-pointer">
            {t('close')}
          </Button>
          <Link href={`/clubs/${club.id}`}>
            <Button type="button" className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold cursor-pointer">
              {t('viewAndBook')} <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
