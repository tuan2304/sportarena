'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ClubReview } from '@/types/database'
import { submitClubReview } from '@/app/actions/reviews'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Star, MessageSquare, ThumbsUp, Send } from 'lucide-react'

import { formatDate } from '@/lib/format'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
interface ClubReviewsSectionProps {
  clubId: string
  currentUserId?: string | null
  initialReviews: ClubReview[]
}

export function ClubReviewsSection({
  clubId,
  currentUserId,
  initialReviews,
}: ClubReviewsSectionProps) {
  const router = useRouter()
  const t = useTranslations('reviews')
  const [reviews, setReviews] = useState<ClubReview[]>(initialReviews)
  const [rating, setRating] = useState<number>(5)
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  // Tính điểm đánh giá trung bình
  const totalReviews = reviews.length
  const averageRating =
    totalReviews > 0
      ? (reviews.reduce((acc, r) => acc + Number(r.rating), 0) / totalReviews).toFixed(1)
      : '5.0'

  // Lắng nghe Realtime review mới
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`club-reviews-${clubId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'club_reviews',
          filter: `club_id=eq.${clubId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newRev = payload.new as ClubReview

            let profile = undefined
            if (newRev.user_id) {
              const { data: p } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url')
                .eq('id', newRev.user_id)
                .single()
              profile = p || undefined
            }

            const completeReview: ClubReview = {
              id: newRev.id,
              club_id: newRev.club_id,
              user_id: newRev.user_id,
              rating: newRev.rating,
              comment: newRev.comment,
              created_at: newRev.created_at,
              updated_at: newRev.updated_at,
              profile,
            }

            setReviews((prev) => {
              const filtered = prev.filter((r) => r.id !== completeReview.id)
              return [completeReview, ...filtered]
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [clubId])

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault()
    if (!currentUserId) {
      toast.info(t('loginToast'), {
        action: { label: t('loginAction'), onClick: () => router.push('/login') },
      })
      return
    }

    setSubmitting(true)
    setSuccessMsg('')

    const res = await submitClubReview(clubId, rating, comment)
    setSubmitting(false)

    if (res.error) {
      toast.warning(res.error)
    } else {
      setSuccessMsg(t('thanks'))
      setComment('')
      setTimeout(() => setSuccessMsg(''), 4000)
    }
  }

  return (
    <div className="pt-6 border-t border-border/80 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
            {t('title')}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('subtitle')}
          </p>
        </div>

        {/* Rating Score Badge */}
        <div className="flex items-center gap-3 bg-muted/40 border border-border/70 px-4 py-2.5 rounded-2xl shrink-0">
          <div className="text-2xl font-black text-amber-500 flex items-center gap-1">
            <Star className="w-6 h-6 fill-amber-500 text-amber-500" />
            {averageRating}
          </div>
          <div className="text-xs text-muted-foreground leading-tight">
            <div className="font-semibold text-foreground">{t('score')}</div>
            <div>{t('basedOn', { count: totalReviews })}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form viết đánh giá (1 cột) */}
        <div className="lg:col-span-1">
          <Card className="border-border shadow-xs">
            <CardHeader className="bg-muted/30 border-b border-border/60 pb-3">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <ThumbsUp className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                {t('formTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {successMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                  {successMsg}
                </div>
              )}

              <form onSubmit={handleSubmitReview} className="space-y-4">
                {/* Chọn số sao */}
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1.5">
                    {t('satisfaction')}
                  </label>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const active = (hoverRating || rating) >= star
                      return (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => setRating(star)}
                          className="p-1 hover:scale-115 transition-transform cursor-pointer"
                        >
                          <Star
                            className={`w-6 h-6 ${
                              active
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-muted-foreground/40'
                            }`}
                          />
                        </button>
                      )
                    })}
                    <span className="text-xs font-bold text-amber-500 ml-2">
                      {hoverRating || rating} / 5 sao
                    </span>
                  </div>
                </div>

                {/* Nhập nhận xét */}
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1.5">
                    {t('commentLabel')}
                  </label>
                  <textarea
                    rows={3}
                    className="w-full bg-background border border-border rounded-xl p-3 text-xs sm:text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                    placeholder={
                      currentUserId
                        ? t('commentPlaceholder')
                        : t('commentLoginPlaceholder')
                    }
                    disabled={!currentUserId || submitting}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </div>

                <Button
                  type="submit"
                  size="sm"
                  disabled={!currentUserId || submitting}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold cursor-pointer text-xs h-9 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  {submitting ? t('sending') : t('submit')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Danh sách review (2 cột) */}
        <div className="lg:col-span-2 space-y-3">
          {reviews.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-border text-center text-muted-foreground space-y-2">
              <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto" />
              <div className="text-sm font-semibold">{t('emptyTitle')}</div>
              <div className="text-xs">{t('emptyText')}</div>
            </div>
          ) : (
            reviews.map((r) => {
              const author = r.profile?.full_name || t('anonymous')
              const initial = author.charAt(0).toUpperCase()
              const dateStr = formatDate(r.created_at)

              return (
                <div
                  key={r.id}
                  className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 font-bold flex items-center justify-center text-xs border border-emerald-500/20">
                        {initial}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground">{author}</div>
                        <div className="text-xs text-muted-foreground">{dateStr}</div>
                      </div>
                    </div>

                    {/* Star display */}
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3.5 h-3.5 ${
                            s <= Number(r.rating)
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-muted-foreground/30'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {r.comment && (
                    <p className="text-xs text-foreground/90 leading-relaxed pl-10">
                      &ldquo;{r.comment}&rdquo;
                    </p>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

