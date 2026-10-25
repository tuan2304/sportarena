'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useLabels } from '@/i18n/labels'
import { Input } from '@/components/ui/input'
import { Search, MapPin } from 'lucide-react'

import { SPORT_FILTER_OPTIONS } from '@/lib/constants'
import { ALL_DISTRICTS } from '@/lib/club-search'
import { SportIcon } from '@/components/ui/sport-icon'
// 'Tất cả khu vực' là giá trị đặc biệt (ALL_DISTRICTS) hiển thị bằng nhãn dịch; tên quận là tên riêng nên giữ nguyên
const DISTRICTS = [
  ALL_DISTRICTS,
  'Quận 1',
  'Quận 3',
  'Quận 7',
  'Quận 10',
  'Tân Bình',
  'Bình Thạnh',
  'Thủ Đức',
  'Gò Vấp',
]

export function ClubFilters() {
  const t = useTranslations('clubs.filters')
  const labels = useLabels()
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentSport = searchParams.get('sport') || 'all'
  const currentDistrict = searchParams.get('district') || ALL_DISTRICTS
  const currentQuery = searchParams.get('q') || ''

  function updateParams(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('page') // đổi bộ lọc thì quay về trang đầu
    if (value && value !== 'all' && value !== ALL_DISTRICTS) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`/clubs?${params.toString()}`)
  }

  return (
    <div className="space-y-4 bg-card p-4 sm:p-5 rounded-2xl border border-border shadow-sm">
      {/* Top search & district */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            defaultValue={currentQuery}
            onChange={(e) => updateParams('q', e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="pl-9 h-10 bg-muted/30 focus-visible:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <MapPin className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          <select
            value={currentDistrict}
            onChange={(e) => updateParams('district', e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-full sm:w-48 cursor-pointer"
          >
            {DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d === ALL_DISTRICTS ? t('allDistricts') : d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sport Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-none">
        {SPORT_FILTER_OPTIONS.map((sport) => {
          const isActive = currentSport === sport.id
          return (
            <button
              key={sport.id}
              type="button"
              onClick={() => updateParams('sport', sport.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-emerald-700 text-white shadow-xs font-bold shadow-emerald-600/20'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50'
              }`}
            >
              {sport.id !== 'all' && <SportIcon sport={sport.id} className="w-3.5 h-3.5" />}
              {labels.sport(sport.id)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
