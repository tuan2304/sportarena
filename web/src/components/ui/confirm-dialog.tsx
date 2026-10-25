'use client'

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, HelpCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export interface ConfirmOptions {
  title: string
  description?: ReactNode
  confirmText?: string
  cancelText?: string
  /** true: thao tác nguy hiểm (xóa, hủy...), nút xác nhận màu đỏ */
  destructive?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

/**
 * Hộp xác nhận cùng phong cách giao diện, thay cho confirm() mặc định của trình duyệt.
 *
 *   const confirm = useConfirm()
 *   if (!(await confirm({ title: 'Xóa sân?', destructive: true }))) return
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm phải nằm trong <ConfirmProvider>')
  return ctx
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const t = useTranslations('common')
  const [open, setOpen] = useState(false)
  // Giữ nội dung cuối cùng để hộp thoại không bị trống trong lúc đóng
  const [options, setOptions] = useState<ConfirmOptions>({ title: '' })
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value)
    resolver.current = null
    setOpen(false)
  }, [])

  const confirm = useCallback<ConfirmFn>(
    (next) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false) // đang có hộp khác mở thì coi như đã hủy
        resolver.current = resolve
        setOptions(next)
        setOpen(true)
      }),
    []
  )

  const destructive = options.destructive ?? false

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={open} onOpenChange={(next) => !next && settle(false)}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader className="items-center text-center sm:items-start sm:text-left">
            <div
              className={`mb-1 flex h-11 w-11 items-center justify-center rounded-full ${
                destructive ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {destructive ? <AlertTriangle className="h-5 w-5" aria-hidden /> : <HelpCircle className="h-5 w-5" aria-hidden />}
            </div>
            <DialogTitle className="text-base font-bold">{options.title}</DialogTitle>
            {options.description && (
              <DialogDescription className="text-sm leading-relaxed">{options.description}</DialogDescription>
            )}
          </DialogHeader>
          {/* Nút Hủy đứng trước để là nút được focus đầu tiên: an toàn hơn cho thao tác xóa */}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => settle(false)} className="cursor-pointer">
              {options.cancelText ?? t('cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => settle(true)}
              className={`cursor-pointer text-white ${
                destructive ? 'bg-red-700 hover:bg-red-800' : 'bg-emerald-700 hover:bg-emerald-800'
              }`}
            >
              {options.confirmText ?? t('confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  )
}
