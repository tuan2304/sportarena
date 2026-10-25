import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { clubsHref, pageItems, type ClubListParams } from '@/lib/club-search'

interface ClubPaginationProps {
  page: number
  totalPages: number
  filters: Omit<ClubListParams, 'page'>
}

const base =
  'inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm font-semibold transition-colors'
const idle = 'border-border bg-card text-foreground hover:border-emerald-500/50 hover:bg-emerald-500/10'
const active = 'border-emerald-700 bg-emerald-700 text-white shadow-xs'
const disabled = 'border-border/60 bg-muted/30 text-muted-foreground/60 pointer-events-none'

export function ClubPagination({ page, totalPages, filters }: ClubPaginationProps) {
  const t = useTranslations('clubs.pagination')
  if (totalPages <= 1) return null

  const href = (p: number) => clubsHref({ ...filters, page: p })
  const hasPrev = page > 1
  const hasNext = page < totalPages

  return (
    <nav aria-label={t('label')} className="flex flex-wrap items-center justify-center gap-2 pt-2">
      <Link
        href={href(page - 1)}
        rel="prev"
        aria-label={t('prev')}
        aria-disabled={!hasPrev}
        tabIndex={hasPrev ? undefined : -1}
        className={`${base} ${hasPrev ? idle : disabled}`}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </Link>

      {pageItems(page, totalPages).map((item, i) =>
        item === '…' ? (
          <span key={`gap-${i}`} className="px-1 text-sm text-muted-foreground" aria-hidden>
            …
          </span>
        ) : (
          <Link
            key={item}
            href={href(item)}
            aria-label={t('page', { page: item })}
            aria-current={item === page ? 'page' : undefined}
            className={`${base} ${item === page ? active : idle}`}
          >
            {item}
          </Link>
        )
      )}

      <Link
        href={href(page + 1)}
        rel="next"
        aria-label={t('next')}
        aria-disabled={!hasNext}
        tabIndex={hasNext ? undefined : -1}
        className={`${base} ${hasNext ? idle : disabled}`}
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Link>
    </nav>
  )
}
