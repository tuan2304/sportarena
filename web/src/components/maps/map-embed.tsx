import { MapPinOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { buildEmbedUrl, type PlaceRef } from '@/lib/maps'

interface MapEmbedProps {
  place: PlaceRef
  /** Mô tả cho trình đọc màn hình */
  title: string
  className?: string
}

/**
 * Bản đồ Google nhúng. Dùng Maps Embed API khi có NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (miễn phí, nên giới hạn theo tên miền
 * trong Google Cloud), nếu không dùng dạng nhúng không cần khóa. Tải lười để không làm chậm trang.
 */
export function MapEmbed({ place, title, className = '' }: MapEmbedProps) {
  const t = useTranslations('maps')
  const src = buildEmbedUrl(place, process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)

  if (!src) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 bg-muted/40 text-muted-foreground text-xs p-6 ${className}`}>
        <MapPinOff className="w-6 h-6" aria-hidden />
        {t('noLocation')}
      </div>
    )
  }

  return (
    <iframe
      title={title}
      src={src}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      allowFullScreen
      className={`w-full border-0 bg-muted ${className}`}
    />
  )
}
