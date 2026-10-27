'use client'

import { useEffect, useRef } from 'react'
import type * as THREE from 'three'
import { stepBodies, type Body } from '@/lib/ball-physics'
import { ballTexture, type BallKind } from '@/components/three/ball-texture'

type Kind = BallKind | 'shuttlecock'

/** Vị trí xuất phát chuẩn hóa: x, y theo nửa bề rộng/cao khung nhìn (-1..1), s là cỡ. Mọi quả cùng một mặt phẳng để va chạm trông đúng. */
const LAYOUT: Array<{ kind: Kind; x: number; y: number; s: number; spin: number }> = [
  { kind: 'soccer', x: -0.82, y: 0.42, s: 1.15, spin: 0.35 },
  { kind: 'basketball', x: 0.84, y: 0.55, s: 1.3, spin: -0.3 },
  { kind: 'tennis', x: -0.66, y: -0.62, s: 0.55, spin: 0.6 },
  { kind: 'pickleball', x: 0.68, y: -0.62, s: 0.7, spin: -0.5 },
  { kind: 'volleyball', x: -0.56, y: 0.86, s: 0.8, spin: 0.25 },
  { kind: 'shuttlecock', x: 0.9, y: -0.1, s: 0.8, spin: 0.45 },
  { kind: 'tennis', x: 0.5, y: 0.88, s: 0.5, spin: -0.4 },
  { kind: 'pickleball', x: -0.96, y: -0.08, s: 0.55, spin: 0.5 },
]

/**
 * Cảnh 3D các quả bóng thể thao nảy qua lại trong khung hero ngay khi mở trang (không cần chuột): bay thẳng,
 * chạm mép hoặc chạm nhau thì bật ra (vật lý ở lib/ball-physics.ts), lăn theo hướng bay, camera đung đưa nhẹ.
 * Three.js nạp động (không vào bundle đầu), tự dừng khi hero khuất khỏi màn hình hoặc tab ẩn.
 * Không có WebGL thì im lặng bỏ qua: nền CSS phía dưới vẫn hiển thị.
 */
export function HeroScene() {
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const hero = wrap.closest('section') ?? wrap.parentElement
    if (!hero) return

    let disposed = false
    let cleanup = () => {}

    ;(async () => {
      const THREE = await import('three')
      if (disposed) return

      let renderer: THREE.WebGLRenderer
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
      } catch {
        return // máy không có WebGL
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
      renderer.outputColorSpace = THREE.SRGBColorSpace
      const canvas = renderer.domElement
      canvas.className = 'absolute inset-0 h-full w-full'
      wrap.appendChild(canvas)

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
      camera.position.set(0, 0, 14)

      scene.add(new THREE.AmbientLight(0xffffff, 1.35))
      const key = new THREE.DirectionalLight(0xffffff, 2.4)
      key.position.set(-4, 6, 8)
      scene.add(key)
      const rim = new THREE.PointLight(0x34d399, 40, 40)
      rim.position.set(6, -3, 4)
      scene.add(rim)

      const disposables: Array<{ dispose: () => void }> = []
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const compact = window.innerWidth < 700
      // Điện thoại: bóng nhỏ hơn để không che chữ tiêu đề
      const sizeK = compact ? 0.68 : 1
      const layout = compact ? LAYOUT.filter((_, i) => i < 6) : LAYOUT

      const textures = new Map<string, THREE.CanvasTexture>()
      const sphereGeo = new THREE.SphereGeometry(1, 48, 32)
      disposables.push(sphereGeo)

      const items = layout.map((spec, index) => {
        let object: THREE.Object3D
        if (spec.kind === 'shuttlecock') {
          const group = new THREE.Group()
          // Chùm lông: mặt xoay tròn loe dần; nút cầu là quả cầu nhỏ ở đầu
          const profile = [
            new THREE.Vector2(0.18, 0),
            new THREE.Vector2(0.3, 0.35),
            new THREE.Vector2(0.62, 1.25),
            new THREE.Vector2(0.72, 1.6),
          ]
          const skirtGeo = new THREE.LatheGeometry(profile, 24)
          const skirtMat = new THREE.MeshStandardMaterial({ color: 0xf4f7f2, roughness: 0.6, side: THREE.DoubleSide })
          const skirt = new THREE.Mesh(skirtGeo, skirtMat)
          const corkGeo = new THREE.SphereGeometry(0.3, 24, 16)
          const corkMat = new THREE.MeshStandardMaterial({ color: 0xe9c46a, roughness: 0.5 })
          const cork = new THREE.Mesh(corkGeo, corkMat)
          cork.position.y = -0.05
          group.add(skirt, cork)
          group.position.y = -0.8
          const holder = new THREE.Group()
          holder.add(group)
          holder.rotation.z = 0.5
          disposables.push(skirtGeo, skirtMat, corkGeo, corkMat)
          object = holder
        } else {
          let texture = textures.get(spec.kind)
          if (!texture) {
            texture = new THREE.CanvasTexture(ballTexture(spec.kind))
            texture.colorSpace = THREE.SRGBColorSpace
            texture.anisotropy = 4
            textures.set(spec.kind, texture)
            disposables.push(texture)
          }
          const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: spec.kind === 'basketball' ? 0.8 : 0.5 })
          disposables.push(mat)
          object = new THREE.Mesh(sphereGeo, mat)
        }
        scene.add(object)
        // Trạng thái vật lý (đơn vị thế giới); khởi tạo ở khung hình đầu khi đã biết kích thước khung nhìn
        const body: Body = { x: 0, y: 0, vx: 0, vy: 0, r: 1, mass: 1 }
        return {
          spec,
          object,
          phase: index * 1.7,
          body,
          angle: index * 2.4 + 0.5,
          speed: 0.2 + (index % 3) * 0.06, // đơn vị: "unit" mỗi giây
          ready: false,
        }
      })

      let width = 1
      let height = 1
      let halfW = 1
      let halfH = 1
      const place = () => {
        const rect = wrap.getBoundingClientRect()
        width = Math.max(rect.width, 1)
        height = Math.max(rect.height, 1)
        renderer.setSize(width, height, false)
        camera.aspect = width / height
        camera.updateProjectionMatrix()
        halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z
        halfW = halfH * camera.aspect
      }
      place()
      const resizeObserver = new ResizeObserver(place)
      resizeObserver.observe(wrap)

      const unit = () => Math.min(halfW, halfH * 1.6)
      let lastTime = 0
      const frame = (time: number) => {
        const t = time / 1000
        const dt = lastTime ? Math.min(t - lastTime, 0.05) : 0
        lastTime = t
        // Camera đung đưa rất nhẹ để cảnh có chiều sâu (không phụ thuộc con trỏ)
        camera.position.x = Math.sin(t * 0.35) * 0.9
        camera.position.y = Math.cos(t * 0.27) * 0.6
        camera.lookAt(0, 0, 0)

        const u = unit()
        for (const item of items) {
          const { spec, body } = item
          const size = spec.s * u * 0.12 * sizeK
          body.r = size * (spec.kind === 'shuttlecock' ? 0.9 : 1.05)
          body.mass = body.r * body.r
          if (!item.ready) {
            body.x = spec.x * halfW * 0.9
            body.y = spec.y * halfH * 0.85
            body.vx = Math.cos(item.angle) * item.speed * u
            body.vy = Math.sin(item.angle) * item.speed * u * 0.8
            item.ready = true
          }
        }
        // Bật tường + va chạm đàn hồi giữa các quả (quả to nặng hơn nên ít bị đẩy hơn)
        const hits = stepBodies(
          items.map((item) => item.body),
          dt,
          halfW,
          halfH
        )
        if (hits > 0) canvas.dataset.hits = String(Number(canvas.dataset.hits ?? 0) + hits)

        for (const item of items) {
          const { spec, object, phase, body } = item
          // Giữ nhịp: sau nhiều va chạm không để quả nào chậm hẳn lại hay nhanh quá mức
          const target = item.speed * u
          const speedNow = Math.hypot(body.vx, body.vy)
          if (speedNow > 1e-6 && (speedNow < target * 0.6 || speedNow > target * 1.8)) {
            const k = (speedNow < target * 0.6 ? target * 0.6 : target * 1.8) / speedNow
            body.vx *= k
            body.vy *= k
          }

          object.position.set(body.x, body.y, 0)
          object.scale.setScalar(spec.s * u * 0.12 * sizeK)
          // Lăn theo hướng đang bay: đổi chiều quay ngay khi bị va chạm hay bật tường
          const roll = (speedNow / Math.max(body.r, 0.01)) * 0.8
          if (spec.kind === 'shuttlecock') {
            object.rotation.y = t * spec.spin * 1.5
            object.rotation.z = 0.5 + Math.sin(t * 0.7 + phase) * 0.35
          } else {
            object.rotation.y += (body.vx > 0 ? 1 : -1) * roll * dt * Math.abs(body.vx / (speedNow || 1))
            object.rotation.x += (body.vy > 0 ? -1 : 1) * roll * dt * Math.abs(body.vy / (speedNow || 1))
          }
        }
        renderer.render(scene, camera)
      }

      canvas.dataset.hits = '0'
      canvas.dataset.ready = 'true'

      let raf = 0
      let visible = true
      const loop = (time: number) => {
        frame(time)
        raf = visible && !document.hidden ? requestAnimationFrame(loop) : 0
      }
      const start = () => {
        if (!raf && !reducedMotion) raf = requestAnimationFrame(loop)
      }
      if (reducedMotion) {
        frame(0) // một khung tĩnh
      } else {
        start()
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

      cleanup = () => {
        cancelAnimationFrame(raf)
        observer.disconnect()
        resizeObserver.disconnect()
        document.removeEventListener('visibilitychange', onVisibility)
        for (const d of disposables) d.dispose()
        renderer.dispose()
        renderer.forceContextLoss()
        canvas.remove()
      }
    })()

    return () => {
      disposed = true
      cleanup()
    }
  }, [])

  return <div ref={wrapRef} aria-hidden className="hero-scene absolute inset-0" />
}
