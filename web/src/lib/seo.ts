/**
 * Phần thuần túy của SEO: mô tả trang và dữ liệu có cấu trúc (JSON-LD) cho công cụ tìm kiếm.
 * Tách riêng để kiểm thử được mà không cần chạy Next.js.
 */

interface ClubSeoInput {
  id: string
  name: string
  description: string | null
  address: string
  district: string | null
  city: string | null
  latitude?: number | null
  longitude?: number | null
  open_time?: string | null
  close_time?: string | null
  images?: string[] | null
}

const DESCRIPTION_MAX = 160

/** Cắt mô tả ở ranh giới từ để không bị đứt giữa chữ, thêm … khi bị cắt. */
export function truncateDescription(text: string, max = DESCRIPTION_MAX): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

export function clubDescription(club: Pick<ClubSeoInput, 'name' | 'description' | 'address' | 'district' | 'city'>, lang: 'vi' | 'en' = 'vi'): string {
  if (club.description?.trim()) return truncateDescription(club.description)
  const place = [club.address, club.district, club.city].filter(Boolean).join(', ')
  return truncateDescription(
    lang === 'en'
      ? `Book a court at ${club.name}, ${place}. Check availability and pay a quick deposit with VietQR on SportArena.`
      : `Đặt sân tại ${club.name}, ${place}. Xem lịch trống và đặt cọc nhanh qua VietQR trên SportArena.`
  )
}

/** Ảnh dùng cho thẻ chia sẻ phải là địa chỉ tuyệt đối http(s); bỏ qua giá trị khác. */
export function shareImage(images: string[] | null | undefined): string | undefined {
  const first = images?.[0]
  return first && /^https?:\/\//i.test(first) ? first : undefined
}

function hhmm(time: string | null | undefined): string | undefined {
  return time ? time.slice(0, 5) : undefined
}

const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function clubJsonLd(club: ClubSeoInput, url: string, ratings: number[] = []) {
  const opens = hhmm(club.open_time)
  const closes = hhmm(club.close_time)
  const valid = ratings.filter((r) => Number.isFinite(r) && r >= 1 && r <= 5)

  return {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    name: club.name,
    url,
    description: clubDescription(club),
    ...(shareImage(club.images) ? { image: shareImage(club.images) } : {}),
    address: {
      '@type': 'PostalAddress',
      streetAddress: club.address,
      ...(club.district ? { addressLocality: club.district } : {}),
      ...(club.city ? { addressRegion: club.city } : {}),
      addressCountry: 'VN',
    },
    ...(typeof club.latitude === 'number' && typeof club.longitude === 'number'
      ? { geo: { '@type': 'GeoCoordinates', latitude: club.latitude, longitude: club.longitude } }
      : {}),
    ...(opens && closes
      ? { openingHoursSpecification: { '@type': 'OpeningHoursSpecification', dayOfWeek: WEEK, opens, closes } }
      : {}),
    ...(valid.length > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10,
            reviewCount: valid.length,
          },
        }
      : {}),
  }
}

/** JSON-LD nhúng vào <script>: thoát "<" để nội dung do người dùng nhập (tên, mô tả) không thể đóng thẻ script. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
