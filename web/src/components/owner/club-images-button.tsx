'use client'

import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ImageIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ImageUploader } from '@/components/ui/image-uploader'
import { setClubImages } from '@/app/actions/images'
import { MAX_CLUB_IMAGES, MAX_CLUB_IMAGE_BYTES } from '@/lib/image-upload'

interface ClubImagesButtonProps {
  clubId: string
  clubName: string
  initial: string[]
}

/** Nút + hộp thoại để chủ sân tải, gỡ và sắp xếp ảnh của cụm sân. Ảnh đầu tiên là ảnh bìa ở danh sách sân. */
export function ClubImagesButton({ clubId, clubName, initial }: ClubImagesButtonProps) {
  const t = useTranslations('owner.images')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState(initial)
  const [images, setImages] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const dirty = images.length !== saved.length || images.some((u, i) => u !== saved[i])

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setImages(saved)
      setError(null)
    }
  }

  function save() {
    setError(null)
    startTransition(async () => {
      const res = await setClubImages(clubId, images)
      if (res.error) {
        setError(res.error)
        return
      }
      setSaved(res.images ?? images)
      toast.success(t('saved'))
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-8 text-xs cursor-pointer"
        title={t('manage')}
      >
        <ImageIcon className="w-3.5 h-3.5 mr-1" aria-hidden />
        {t('button', { count: saved.length })}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('title', { name: clubName })}</DialogTitle>
            <DialogDescription>
              {t('hint')}
            </DialogDescription>
          </DialogHeader>

          <ImageUploader
            bucket="club-images"
            folder={clubId}
            value={images}
            onChange={setImages}
            max={MAX_CLUB_IMAGES}
            maxBytes={MAX_CLUB_IMAGE_BYTES}
            allowCover
            disabled={pending}
          />

          {error && (
            <p role="alert" className="text-xs text-red-700 dark:text-red-400">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={pending} className="cursor-pointer">
              {t('close')}
            </Button>
            <Button onClick={save} disabled={pending || !dirty} className="bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer">
              {pending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
