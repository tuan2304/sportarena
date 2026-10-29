'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { Menu, X } from 'lucide-react'

/**
 * Menu trượt từ trái cho khu chủ sân / quản trị trên điện thoại (từ md trở lên đã có thanh bên cố định).
 * Tự đóng khi chuyển trang, bấm ra ngoài hoặc nhấn Esc; con (thanh điều hướng) không cần biết trạng thái mở.
 */
export function PortalNavDrawer({ children }: { children: React.ReactNode }) {
  const t = useTranslations('common')
  const pathname = usePathname()
  const [openFor, setOpenFor] = useState<string | null>(null)
  // Gắn trạng thái mở với đường dẫn: đổi trang là menu tự đóng, không cần effect
  const open = openFor === pathname

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => setOpenFor(next ? pathname : null)}>
      <DialogPrimitive.Trigger
        aria-label={t('openMenu')}
        className="md:hidden -ml-2 inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-foreground hover:bg-muted/80 active:bg-muted"
      >
        <Menu className="size-5" aria-hidden />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 md:hidden" />
        <DialogPrimitive.Popup
          className="fixed inset-y-0 left-0 z-50 flex w-[min(18rem,85vw)] flex-col overflow-y-auto overscroll-contain bg-background shadow-2xl outline-none duration-150 data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left md:hidden"
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <DialogPrimitive.Title className="sr-only">{t('openMenu')}</DialogPrimitive.Title>
          <DialogPrimitive.Close
            aria-label={t('close')}
            className="absolute right-2 top-2.5 z-10 inline-flex size-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          >
            <X className="size-5" aria-hidden />
          </DialogPrimitive.Close>
          {children}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
