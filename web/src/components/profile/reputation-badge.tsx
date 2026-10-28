import { useTranslations } from 'next-intl'
import { ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Reputation, ReputationTier } from '@/lib/reputation'

const STYLE: Record<ReputationTier, string> = {
  new: 'border-border text-muted-foreground',
  excellent: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  good: 'border-emerald-500/30 text-emerald-700 dark:text-emerald-400',
  fair: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  risky: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
}

/** Huy hiệu uy tín người chơi; rê chuột để xem chi tiết số lần không đến / hủy muộn. */
export function ReputationBadge({ reputation, className }: { reputation: Reputation | undefined; className?: string }) {
  const t = useTranslations('reputation')
  if (!reputation) return null

  const Icon = reputation.tier === 'new' ? ShieldQuestion : reputation.tier === 'risky' || reputation.tier === 'fair' ? ShieldAlert : ShieldCheck
  const label = reputation.score === null ? t('new') : `${t(reputation.tier)} · ${t('score', { score: reputation.score })}`
  const detail = t('detail', { played: reputation.played, noShows: reputation.noShows, lateCancels: reputation.lateCancels })

  return (
    <Badge variant="outline" className={`${STYLE[reputation.tier]} ${className ?? ''}`} title={`${t('title')}: ${detail}`}>
      <Icon aria-hidden />
      <span>{label}</span>
      <span className="sr-only">{detail}</span>
    </Badge>
  )
}
