'use client'

import { useTranslations } from 'next-intl'
import { useLabels } from '@/i18n/labels'
import { useState } from 'react'
import { createCourt, updateCourt } from '@/app/actions/owner'
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
import { Plus, Pencil, Loader2 } from 'lucide-react'

export interface EditableCourt {
  id: string
  name: string
  surface_type: string | null
  base_price_per_hour: number
  deposit_percentage: number
}

interface CourtFormModalProps {
  clubId: string
  clubName: string
  /** Truyền vào để sửa sân con này thay vì thêm sân mới (môn thể thao không đổi được) */
  court?: EditableCourt
}

export function CourtFormModal({ clubId, clubName, court }: CourtFormModalProps) {
  const t = useTranslations('owner.courtForm')
  const tc = useTranslations('common')
  const labels = useLabels()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.set('clubId', clubId)

    const result = court ? await updateCourt(court.id, formData) : await createCourt(formData)

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
      {court ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setOpen(true)}
          className="h-10 px-3 text-xs md:h-7 md:px-2 text-muted-foreground hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
        >
          <Pencil className="w-3 h-3 mr-1" />
          {t('editButton')}
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen(true)}
          className="border-dashed border-emerald-500/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          {t('openButton')}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{court ? t('editTitle') : t('title')}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {court ? t('editDescription', { court: court.name }) : t('description', { club: clubName })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="courtName">{t('name')}</Label>
            <Input
              id="courtName"
              name="name"
              placeholder={t('namePlaceholder')}
              defaultValue={court?.name}
              required
              className="h-9"
            />
          </div>

          {!court && (
            <div className="space-y-1.5">
              <Label htmlFor="sportType">{t('sport')}</Label>
              <select
                id="sportType"
                name="sportType"
                required
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="football">{t('football')}</option>
                <option value="badminton">{labels.sport('badminton')}</option>
                <option value="pickleball">{labels.sport('pickleball')}</option>
                <option value="tennis">{labels.sport('tennis')}</option>
                <option value="basketball">{labels.sport('basketball')}</option>
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="surfaceType">{t('surface')}</Label>
            <Input
              id="surfaceType"
              name="surfaceType"
              placeholder={t('surfacePlaceholder')}
              defaultValue={court ? (court.surface_type ?? '') : t('surfaceDefault')}
              className="h-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="basePrice">{t('basePrice')}</Label>
              <Input
                id="basePrice"
                name="basePricePerHour"
                type="number"
                min="0"
                step="10000"
                defaultValue={court ? court.base_price_per_hour : '200000'}
                required
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="depositPercentage">{t('deposit')}</Label>
              <Input
                id="depositPercentage"
                name="depositPercentage"
                type="number"
                min="0"
                max="100"
                defaultValue={court ? court.deposit_percentage : '30'}
                required
                className="h-9"
              />
            </div>
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
                  {court ? t('saving') : t('adding')}
                </>
              ) : (
                court ? t('editSubmit') : t('submit')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  )
}
