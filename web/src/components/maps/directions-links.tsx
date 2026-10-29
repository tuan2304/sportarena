import { useTranslations } from 'next-intl'
import { ExternalLink, Navigation } from 'lucide-react'
import { buildDirectionsUrl, buildViewUrl, type PlaceRef } from '@/lib/maps'

interface DirectionsLinksProps {
  place: PlaceRef
  /** compact: chỉ một nút "Chỉ đường" nhỏ gọn, dùng trong thẻ danh sách */
  compact?: boolean
  className?: string
}

const BASE_BTN =
  'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all cursor-pointer pointer-coarse:min-h-10'

/** Nút mở Google Maps: "Chỉ đường" (từ vị trí của khách) và "Xem trên Google Maps". Trên điện thoại sẽ mở app Maps. */
export function DirectionsLinks({ place, compact = false, className = '' }: DirectionsLinksProps) {
  const t = useTranslations('maps')
  const directions = buildDirectionsUrl(place)
  const view = buildViewUrl(place)
  if (!directions) return null

  if (compact) {
    return (
      <a
        href={directions}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 py-2.5 -my-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline ${className}`}
      >
        <Navigation className="w-3.5 h-3.5" aria-hidden />
        {t('directions')}
        <span className="sr-only">{t('opensNewTab')}</span>
      </a>
    )
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <a
        href={directions}
        target="_blank"
        rel="noopener noreferrer"
        className={`${BASE_BTN} px-4 py-2 text-sm bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm`}
      >
        <Navigation className="w-4 h-4" aria-hidden />
        {t('directions')}
        <span className="sr-only">{t('opensNewTab')}</span>
      </a>
      {view && (
        <a
          href={view}
          target="_blank"
          rel="noopener noreferrer"
          className={`${BASE_BTN} px-4 py-2 text-sm border border-border bg-background hover:bg-muted text-foreground`}
        >
          <ExternalLink className="w-4 h-4" aria-hidden />
          {t('viewOnGoogle')}
          <span className="sr-only">{t('newTab')}</span>
        </a>
      )}
    </div>
  )
}
