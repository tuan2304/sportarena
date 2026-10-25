'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { deleteClub } from '@/app/actions/owner'
import { Button } from '@/components/ui/button'
import { Trash2, Loader2 } from 'lucide-react'

import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'
interface ClubItemActionsProps {
  clubId: string
  clubName: string
}

export function ClubItemActions({ clubId, clubName }: ClubItemActionsProps) {
  const t = useTranslations('owner.clubActions')
  const [loading, setLoading] = useState(false)
  const askConfirm = useConfirm()

  async function handleDelete() {
    const ok = await askConfirm({
      title: t('deleteTitle', { name: clubName }),
      description: t('deleteText'),
      confirmText: t('deleteConfirm'),
      destructive: true,
    })
    if (!ok) return
    setLoading(true)
    const res = await deleteClub(clubId)
    setLoading(false)
    if (res?.error) toast.error(res.error)
    else toast.success(t('deleted'))
  }

  return (
    <div>
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      ) : (
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDelete}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
          title={t('deleteConfirm')}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  )
}
