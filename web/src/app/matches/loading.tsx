import { useTranslations } from 'next-intl'

export default function MatchesLoading() {
  const t = useTranslations('common')
  return (
    <div className="min-h-screen bg-background" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{t('loading')}</span>
      <div className="h-16 border-b border-border/70" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="space-y-3">
          <div className="skeleton h-6 w-48 rounded-full" />
          <div className="skeleton h-12 w-72 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl ring-1 ring-foreground/10 bg-card p-5 space-y-4">
              <div className="flex gap-2">
                <div className="skeleton h-5 w-20 rounded-full" />
                <div className="skeleton h-5 w-16 rounded-full" />
              </div>
              <div className="skeleton h-5 w-3/4 rounded" />
              <div className="skeleton h-3 w-full rounded" />
              <div className="skeleton h-9 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
