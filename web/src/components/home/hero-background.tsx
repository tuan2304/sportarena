'use client'

import { useEffect, useRef } from 'react'
import { HeroScene } from './hero-scene'

/**
 * Nền hero: lưới mờ, hai đốm sáng và một vệt sáng đi theo con trỏ.
 * Con trỏ di chuyển trong hero thì các lớp trượt lệch nhau (thị sai) và mượt dần về đích bằng rAF,
 * ghi thẳng vào biến CSS nên không render lại React. Tắt khi người dùng giảm chuyển động hoặc dùng màn hình cảm ứng.
 * Phần tử cha (hero) cần `relative`.
 */
export function HeroBackground() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const hero = root?.parentElement
    if (!root || !hero) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!window.matchMedia('(any-pointer: fine)').matches) return

    // Vị trí con trỏ chuẩn hóa về -1..1 (0 là giữa hero); cur đuổi theo target
    let targetX = 0
    let targetY = 0
    let curX = 0
    let curY = 0
    let raf = 0

    const tick = () => {
      curX += (targetX - curX) * 0.08
      curY += (targetY - curY) * 0.08
      root.style.setProperty('--mx', curX.toFixed(4))
      root.style.setProperty('--my', curY.toFixed(4))
      const settled = Math.abs(targetX - curX) < 0.0005 && Math.abs(targetY - curY) < 0.0005
      raf = settled ? 0 : requestAnimationFrame(tick)
    }
    const run = () => {
      if (!raf) raf = requestAnimationFrame(tick)
    }

    const onMove = (e: PointerEvent) => {
      const rect = hero.getBoundingClientRect()
      targetX = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width) * 2 - 1))
      targetY = Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height) * 2 - 1))
      root.dataset.active = 'true'
      run()
    }
    const onLeave = () => {
      targetX = 0
      targetY = 0
      root.dataset.active = 'false'
      run()
    }

    hero.addEventListener('pointermove', onMove)
    hero.addEventListener('pointerleave', onLeave)
    return () => {
      hero.removeEventListener('pointermove', onMove)
      hero.removeEventListener('pointerleave', onLeave)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div ref={rootRef} aria-hidden className="hero-bg absolute inset-0 pointer-events-none" data-active="false">
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
