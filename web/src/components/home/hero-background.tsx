'use client'

import { useEffect, useRef } from 'react'
import { HeroScene } from './hero-scene'

/**
 * Nền hero tự chuyển động ngay khi mở trang: lưới nghiêng 3D, hai đốm sáng và vệt sáng trôi theo nhịp riêng,
 * kèm cảnh bóng 3D. Chuyển động lấy từ thời gian (không theo con trỏ): rAF ghi các biến CSS --mx/--my (từ -1 đến 1)
 * nên không render lại React. Dừng khi hero khuất khỏi màn hình hoặc tab ẩn; tắt khi người dùng giảm chuyển động.
 * Phần tử cha (hero) cần `relative`.
 */
export function HeroBackground() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const hero = root?.parentElement
    if (!root || !hero) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let raf = 0
    let visible = true

    const tick = (time: number) => {
      const t = time / 1000
      root.style.setProperty('--mx', (Math.sin(t * 0.35) * 0.9).toFixed(4))
      root.style.setProperty('--my', (Math.cos(t * 0.27) * 0.7).toFixed(4))
      raf = visible && !document.hidden ? requestAnimationFrame(tick) : 0
    }
    const start = () => {
      if (!raf) raf = requestAnimationFrame(tick)
    }

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) start()
    })
    observer.observe(hero)
    const onVisibility = () => {
      if (!document.hidden) start()
    }
    document.addEventListener('visibilitychange', onVisibility)

    start()
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <div ref={rootRef} aria-hidden className="hero-bg absolute inset-0 pointer-events-none">
      <div className="hero-bg-grid absolute inset-0 bg-grid" />
      <div className="hero-bg-spot absolute inset-0" />
      <div className="hero-bg-blob-a absolute top-10 left-[12%]">
        <div className="w-[420px] h-[420px] bg-emerald-500/35 rounded-full blur-[90px] animate-float" />
      </div>
      <div className="hero-bg-blob-b absolute bottom-0 right-[8%]">
        <div className="w-[360px] h-[360px] bg-amber-400/35 rounded-full blur-[90px] animate-float-slow" />
      </div>
      <HeroScene />
    </div>
  )
}
