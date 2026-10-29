import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'
import { resolveAppUrl } from '@/lib/app-url'
import { BOOKABLE_CLUB_FILTER, listsOnlyBookableClubs } from '@/lib/payment-channel'

// Giới hạn của một file sitemap là 50.000 địa chỉ; số cụm sân còn xa mức đó
const MAX_CLUBS = 5000

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = resolveAppUrl()
  const supabase = await createClient()

  // Chỉ các cụm sân đang hoạt động (RLS cũng chỉ cho khách thấy những cụm này) và đã liên kết ngân hàng như trang danh sách
  let clubQuery = supabase.from('clubs').select('id, updated_at').eq('is_active', true)
  if (listsOnlyBookableClubs()) clubQuery = clubQuery.or(BOOKABLE_CLUB_FILTER)
  const { data: clubs } = await clubQuery.order('updated_at', { ascending: false }).limit(MAX_CLUBS)

  return [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/clubs`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/matches`, changeFrequency: 'hourly', priority: 0.7 },
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/delete-account`, changeFrequency: 'yearly', priority: 0.2 },
    ...(clubs ?? []).map((club) => ({
      url: `${base}/clubs/${club.id}`,
      lastModified: new Date(club.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ]
}
