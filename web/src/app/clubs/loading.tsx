import { useTranslations } from 'next-intl'

export default function ClubsLoading() {
  const t = useTranslations('common')
  return (
    <div className="min-h-screen bg-background" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{t('loading')}</span>
      <div className="h-16 border-b border-border/70" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="space-y-3">
          <div className="skeleton h-6 w-56 rounded-full" />
          <div className="skeleton h-12 w-80 rounded-lg" />
        </div>
        <div className="skeleton h-12 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl ring-1 ring-foreground/10 overflow-hidden bg-card">
              <div className="skeleton h-48 w-full" />
              <div className="p-5 space-y-3">
                <div className="skeleton h-5 w-3/4 rounded" />
                <div className="skeleton h-3 w-1/2 rounded" />
                <div className="skeleton h-3 w-full rounded" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
