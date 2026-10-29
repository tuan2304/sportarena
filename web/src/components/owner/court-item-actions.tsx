'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toggleCourtStatus, deleteCourt } from '@/app/actions/owner'
import { Button } from '@/components/ui/button'
import { Power, Trash2, Loader2 } from 'lucide-react'

import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'
interface CourtItemActionsProps {
  courtId: string
  isActive: boolean
  /** Nút phụ do trang truyền vào (ví dụ nút sửa sân), đặt trước nút tạm ngưng */
  children?: React.ReactNode
}

export function CourtItemActions({ courtId, isActive, children }: CourtItemActionsProps) {
  const t = useTranslations('owner.courtActions')
  const [loading, setLoading] = useState(false)
  const askConfirm = useConfirm()

  async function handleToggle() {
    setLoading(true)
    const res = await toggleCourtStatus(courtId, !isActive)
    setLoading(false)
    if (res?.error) toast.error(res.error)
    else toast.success(isActive ? t('suspended') : t('activated'))
  }

  async function handleDelete() {
    const ok = await askConfirm({
      title: t('deleteTitle'),
      description: t('deleteText'),
      confirmText: t('deleteConfirm'),
      destructive: true,
    })
    if (!ok) return
    setLoading(true)
    const res = await deleteCourt(courtId)
    setLoading(false)
    if (res?.error) toast.error(res.error)
    else toast.success(t('deleted'))
  }

  return (
    <div className="flex items-center gap-1.5 pt-2 border-t border-border/40 justify-end">
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
      ) : (
        <>
          {children}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleToggle}
            className={`h-10 px-3 text-xs md:h-7 md:px-2 cursor-pointer ${
              isActive
                ? 'text-amber-700 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-500/10'
                : 'text-emerald-700 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-500/10'
            }`}
          >
            <Power className="w-3 h-3 mr-1" />
            {isActive ? t('suspend') : t('activate')}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleDelete}
            className="h-10 w-10 p-0 md:h-7 md:w-7 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </>
      )}
    </div>
  )
}
