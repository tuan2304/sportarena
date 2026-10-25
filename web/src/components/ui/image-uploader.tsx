'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Loader2, Star, X } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { imagePath, publicImageUrl, validateImageFile, type ImageBucket } from '@/lib/image-upload'

interface ImageUploaderProps {
  bucket: ImageBucket
  /** Thư mục trong bucket: id cụm sân (club-images) hoặc id người dùng (avatars) */
  folder: string
  value: string[]
  onChange: (urls: string[]) => void
  max: number
  maxBytes: number
  /** Cho phép đặt ảnh làm ảnh bìa (đưa lên đầu danh sách) */
  allowCover?: boolean
  disabled?: boolean
}

/**
 * Chọn và tải ảnh thẳng lên Supabase Storage bằng phiên đăng nhập của người dùng (quyền ghi do chính sách bucket
 * quyết định). Tên file là UUID ngẫu nhiên, đuôi lấy từ loại ảnh; ảnh chưa được lưu vào cụm sân/hồ sơ cho tới khi
 * nơi gọi bấm lưu.
 */
export function ImageUploader({ bucket, folder, value, onChange, max, maxBytes, allowCover = false, disabled }: ImageUploaderProps) {
  const t = useTranslations('images')
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const room = max - value.length
    if (room <= 0) {
      toast.error(t('maxImages', { max }))
      return
    }

    const supabase = createClient()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const added: string[] = []
    setUploading(true)
    for (const file of Array.from(files).slice(0, room)) {
      const problem = validateImageFile(file, maxBytes)
      if (problem) {
        toast.error(`${file.name}: ${problem}`)
        continue
      }
      const path = imagePath(folder, crypto.randomUUID(), file.type)
      if (!path) continue
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        contentType: file.type,
        cacheControl: '31536000',
        upsert: false,
      })
      if (error) {
        toast.error(t('uploadFailed', { name: file.name, message: error.message }))
        continue
      }
      added.push(publicImageUrl(bucket, path, supabaseUrl))
    }
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
    if (added.length > 0) onChange([...value, ...added])
    if (files.length > room) toast.info(t('addMore', { room, max }))
  }

  function remove(url: string) {
    onChange(value.filter((u) => u !== url))
  }

  function makeCover(url: string) {
    onChange([url, ...value.filter((u) => u !== url)])
  }

  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {value.map((url, index) => (
          <li key={url} className="relative aspect-video rounded-lg overflow-hidden border border-border bg-muted group">
            {/* eslint-disable-next-line @next/next/no-img-element -- bản xem trước ảnh vừa tải lên, chưa cần tối ưu */}
            <img src={url} alt={t('alt', { index: index + 1 })} className="absolute inset-0 w-full h-full object-cover" />
            {index === 0 && allowCover && (
              <span className="absolute top-1.5 left-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-700 text-white">{t('cover')}</span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 p-1.5 bg-gradient-to-t from-black/60 to-transparent">
              {allowCover && index !== 0 && (
                <button
                  type="button"
                  onClick={() => makeCover(url)}
                  disabled={disabled || uploading}
                  className="h-7 w-7 rounded-md bg-white/90 text-slate-800 flex items-center justify-center cursor-pointer disabled:opacity-50"
                  title={t('setCover')}
                  aria-label={t('setCover')}
                >
                  <Star className="w-3.5 h-3.5" aria-hidden />
                </button>
              )}
              <button
                type="button"
                onClick={() => remove(url)}
                disabled={disabled || uploading}
                className="h-7 w-7 rounded-md bg-white/90 text-red-700 flex items-center justify-center cursor-pointer disabled:opacity-50"
                title={t('remove')}
                aria-label={t('remove')}
              >
                <X className="w-3.5 h-3.5" aria-hidden />
              </button>
            </div>
          </li>
        ))}

        {value.length < max && (
          <li>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || uploading}
              className="aspect-video w-full rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-emerald-500/50 hover:text-emerald-700 dark:hover:text-emerald-400 flex flex-col items-center justify-center gap-1 text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden /> : <ImagePlus className="w-5 h-5" aria-hidden />}
              {uploading ? t('uploading') : t('add')}
            </button>
          </li>
        )}
      </ul>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={max > 1}
        className="sr-only"
        aria-label={t('chooseLabel')}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <p className="text-xs text-muted-foreground">
        {t('hint', { size: Math.round(maxBytes / 1024 / 1024), count: value.length, max })}
      </p>
    </div>
  )
}
