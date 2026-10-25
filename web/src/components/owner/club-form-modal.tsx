'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { createClub } from '@/app/actions/owner'
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
import { LocationPicker } from '@/components/maps/location-picker'

export function ClubFormModal() {
  const t = useTranslations('owner.clubForm')
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = await createClub(formData)

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
        {t('openButton')}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
            <Label htmlFor="name">{t('name')}</Label>
            <Input
              id="name"
              name="name"
              placeholder={t('namePlaceholder')}
              required
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address">{t('address')}</Label>
            <Input
              id="address"
              name="address"
              placeholder={t('addressPlaceholder')}
              required
              className="h-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="district">{t('district')}</Label>
              <Input
                id="district"
                name="district"
                placeholder={t('districtPlaceholder')}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">{t('city')}</Label>
              <Input
                id="city"
                name="city"
                defaultValue={t('cityDefault')}
                className="h-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="openTime">{t('openTime')}</Label>
              <Input
                id="openTime"
                name="openTime"
                type="time"
                defaultValue="06:00"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="closeTime">{t('closeTime')}</Label>
              <Input
                id="closeTime"
                name="closeTime"
                type="time"
                defaultValue="23:00"
                className="h-9"
              />
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <Label>{t('location')}</Label>
            <LocationPicker />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="amenities">{t('amenities')}</Label>
            <Input
              id="amenities"
              name="amenities"
              placeholder={t('amenitiesPlaceholder')}
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
