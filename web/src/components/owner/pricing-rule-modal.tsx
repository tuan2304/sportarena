'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { createPricingRule } from '@/app/actions/owner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Loader2 } from 'lucide-react'

interface PricingRuleModalProps {
  courts: Array<{ id: string; name: string; club_name: string }>
}

export function PricingRuleModal({ courts }: PricingRuleModalProps) {
  const t = useTranslations('ownerPricing.modal')
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = await createPricingRule(formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      setLoading(false)
      setOpen(false)
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer shadow-sm"
      >
        <Plus className="w-4 h-4 mr-1.5" />
        {t('open')}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{t('title')}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t('description')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="courtId">{t('court')}</Label>
            <select
              id="courtId"
              name="courtId"
              required
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {courts.map((court) => (
                <option key={court.id} value={court.id}>
                  {court.club_name} - {court.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ruleName">{t('name')}</Label>
            <Input
              id="ruleName"
              name="name"
              placeholder={t('namePlaceholder')}
              required
              className="h-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startTime">{t('start')}</Label>
              <Input
                id="startTime"
                name="startTime"
                type="time"
                defaultValue="17:00"
                required
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endTime">{t('end')}</Label>
              <Input
                id="endTime"
                name="endTime"
                type="time"
                defaultValue="21:00"
                required
                className="h-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pricePerHour">{t('price')}</Label>
            <Input
              id="pricePerHour"
              name="pricePerHour"
              type="number"
              min="0"
              step="10000"
              placeholder="250000"
              required
              className="h-9"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="cursor-pointer"
            >
              {tc('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('saving')}
                </>
              ) : (
                t('submit')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  )
}
