'use client'

import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, MapPin } from 'lucide-react'
import { LocationPicker } from '@/components/maps/location-picker'
import { updateClubLocation } from '@/app/actions/owner'
import type { LatLng } from '@/lib/maps'

interface ClubLocationButtonProps {
  clubId: string
  clubName: string
  address: string
  initial: LatLng | null
}

/** Nút + hộp thoại để chủ sân ghim (hoặc sửa) vị trí cụm sân trên Google Maps. */
export function ClubLocationButton({ clubId, clubName, address, initial }: ClubLocationButtonProps) {
  const t = useTranslations('owner.location')
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState<LatLng | null>(initial)
  const [saved, setSaved] = useState<LatLng | null>(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save() {
    setError(null)
    startTransition(async () => {
      const res = await updateClubLocation(clubId, value?.lat ?? null, value?.lng ?? null)
      if (res.error) {
        setError(res.error)
        return
      }
      setSaved(value)
      setOpen(false)
    })
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className={`cursor-pointer ${saved ? '' : 'border-amber-500/50 text-amber-800 dark:text-amber-300'}`}
      >
        <MapPin className="w-3.5 h-3.5 mr-1" aria-hidden />
        {saved ? t('saved') : t('pin')}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{t('title', { name: clubName })}</DialogTitle>
            <DialogDescription className="text-xs">
              {t('hint')}
            </DialogDescription>
          </DialogHeader>

          <LocationPicker initial={saved} address={address} name={clubName} onChange={setValue} />

          {error && (
            <div role="alert" className="p-2.5 text-xs bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-lg">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="cursor-pointer">
              {t('cancel')}
            </Button>
            <Button type="button" onClick={save} disabled={pending} className="bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer">
              {pending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
