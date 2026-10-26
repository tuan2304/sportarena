'use client'

import { useEffect, useRef } from 'react'
import type * as THREE from 'three'

type Kind = 'soccer' | 'basketball' | 'tennis' | 'pickleball' | 'volleyball' | 'shuttlecock'

/** Vị trí chuẩn hóa: x, y theo nửa bề rộng/cao khung nhìn (-1..1), z là độ sâu (âm = xa), s là cỡ. */
const LAYOUT: Array<{ kind: Kind; x: number; y: number; z: number; s: number; spin: number }> = [
  { kind: 'soccer', x: -0.82, y: 0.42, z: 0, s: 1.15, spin: 0.35 },
  { kind: 'basketball', x: 0.84, y: 0.55, z: -1.5, s: 1.3, spin: -0.3 },
  { kind: 'tennis', x: -0.66, y: -0.62, z: 1.2, s: 0.55, spin: 0.6 },
  { kind: 'pickleball', x: 0.68, y: -0.62, z: 0.4, s: 0.7, spin: -0.5 },
  { kind: 'volleyball', x: -0.56, y: 0.86, z: -2, s: 0.8, spin: 0.25 },
  { kind: 'shuttlecock', x: 0.9, y: -0.1, z: -1, s: 0.8, spin: 0.45 },
  { kind: 'tennis', x: 0.5, y: 0.88, z: -4, s: 0.5, spin: -0.4 },
  { kind: 'pickleball', x: -0.96, y: -0.08, z: -2.5, s: 0.55, spin: 0.5 },
]

const TAU = Math.PI * 2

/** Texture trải phẳng (equirectangular) vẽ bằng canvas cho từng loại bóng, không cần tải ảnh. */
function ballTexture(kind: Exclude<Kind, 'shuttlecock'>): HTMLCanvasElement {
  const W = 1024
  const H = 512
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const g = canvas.getContext('2d')!

  // Ellipse bù méo ở gần cực để chấm tròn trên mặt cầu vẫn tròn
  const dot = (u: number, v: number, r: number, color: string) => {
    const lat = (0.5 - v) * Math.PI
    const stretch = 1 / Math.max(Math.cos(lat), 0.25)
    g.fillStyle = color
    g.beginPath()
    g.ellipse(u * W, v * H, r * stretch, r, 0, 0, TAU)
    g.fill()
  }
  const curve = (fn: (u: number) => number, color: string, width: number, shift = 0) => {
    g.strokeStyle = color
    g.lineWidth = width
    g.beginPath()
    for (let x = 0; x <= W; x += 4) {
      const y = fn(((x / W) + shift) % 1) * H
      if (x === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.stroke()
  }

  if (kind === 'soccer') {
    g.fillStyle = '#f6f6f2'
    g.fillRect(0, 0, W, H)
    // 12 đỉnh của khối 20 mặt = vị trí 12 mảng ngũ giác đen
    const phi = (1 + Math.sqrt(5)) / 2
    const verts: Array<[number, number, number]> = []
    for (const a of [-1, 1]) for (const b of [-phi, phi]) {
      verts.push([0, a, b], [a, b, 0], [b, 0, a])
    }
    for (const [x, y, z] of verts) {
      const len = Math.hypot(x, y, z)
      const lat = Math.asin(y / len)
      const lon = Math.atan2(z, x)
      dot((lon / TAU + 0.5) % 1, 0.5 - lat / Math.PI, 30, '#17181c')
    }
  } else if (kind === 'basketball') {
    g.fillStyle = '#e4691f'
    g.fillRect(0, 0, W, H)
    const line = '#23140b'
    g.strokeStyle = line
    g.lineWidth = 9
    g.beginPath()
    g.moveTo(0, H / 2)
    g.lineTo(W, H / 2)
    g.moveTo(0, 0)
    g.lineTo(0, H)
    g.moveTo(W / 2, 0)
    g.lineTo(W / 2, H)
    g.stroke()
    curve((u) => 0.5 + 0.34 * Math.sin(u * TAU * 2), line, 8)
    curve((u) => 0.5 - 0.34 * Math.sin(u * TAU * 2), line, 8)
  } else if (kind === 'tennis') {
    g.fillStyle = '#c9e23a'
    g.fillRect(0, 0, W, H)
    curve((u) => 0.5 + 0.3 * Math.sin(u * TAU), '#f7f9ec', 16)
    curve((u) => 0.5 + 0.3 * Math.sin(u * TAU), '#f7f9ec', 16, 0.5)
  } else if (kind === 'pickleball') {
    g.fillStyle = '#f3d830'
    g.fillRect(0, 0, W, H)
    for (let row = 1; row < 11; row++) {
      const v = row / 11
      const count = 18
      for (let i = 0; i < count; i++) {
        dot((i + (row % 2 ? 0.5 : 0)) / count, v, 11, '#b8960d')
      }
    }
  } else {
    // volleyball: ba dải màu xen kẽ
    const colors = ['#f6f1df', '#2f6fdd', '#f3c316']
    const bands = 12
    for (let i = 0; i < bands; i++) {
      g.fillStyle = colors[i % 3]
      g.fillRect((i / bands) * W, 0, W / bands + 1, H)
    }
    g.strokeStyle = 'rgba(20, 24, 40, 0.55)'
    g.lineWidth = 5
    for (let i = 0; i < bands; i++) {
      g.beginPath()
      g.moveTo((i / bands) * W, 0)
      g.lineTo((i / bands) * W, H)
      g.stroke()
    }
    curve((u) => 0.5 + 0.18 * Math.sin(u * TAU * 3), 'rgba(20, 24, 40, 0.55)', 5)
  }
  return canvas
}

/**
 * Cảnh 3D các quả bóng thể thao nảy qua lại trong khung hero ngay khi mở trang (không cần chuột): bay thẳng,
 * chạm mép thì bật lại và lăn theo hướng bay, camera đung đưa nhẹ để có chiều sâu.
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
        // Vị trí và vận tốc chuẩn hóa theo khung nhìn tại độ sâu của quả bóng (-1..1); bật lại khi chạm mép
        const angle = index * 2.4 + 0.5
        const speed = 0.16 + (index % 3) * 0.05
        return {
          spec,
          object,
          phase: index * 1.7,
          nx: spec.x,
          ny: spec.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed * 0.8,
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
          const { spec, object, phase } = item
          const size = spec.s * u * 0.12
          // Khung nhìn tại độ sâu của quả bóng (xa camera thì rộng hơn); chừa lề bằng bán kính để chạm mép là bật
          const zScale = (camera.position.z - spec.z) / camera.position.z
          const limitX = Math.max(halfW * zScale - size * 1.2, 0.1)
          const limitY = Math.max(halfH * zScale - size * 1.2, 0.1)
          item.nx += item.vx * dt * (halfW / limitX)
          item.ny += item.vy * dt * (halfH / limitY)
          if (item.nx > 1) { item.nx = 1; item.vx = -Math.abs(item.vx) }
          if (item.nx < -1) { item.nx = -1; item.vx = Math.abs(item.vx) }
          if (item.ny > 1) { item.ny = 1; item.vy = -Math.abs(item.vy) }
          if (item.ny < -1) { item.ny = -1; item.vy = Math.abs(item.vy) }

          object.position.set(item.nx * limitX, item.ny * limitY, spec.z)
          object.scale.setScalar(size)
          // Lăn theo hướng đang bay: quay nhanh hơn khi bật vào tường
          const roll = Math.hypot(item.vx, item.vy) * 6
          if (spec.kind === 'shuttlecock') {
            object.rotation.y = t * spec.spin * 1.5
            object.rotation.z = 0.5 + Math.sin(t * 0.7 + phase) * 0.35
          } else {
            object.rotation.y += (item.vx > 0 ? 1 : -1) * roll * dt
            object.rotation.x += (item.vy > 0 ? -1 : 1) * roll * dt * 0.7
          }
        }
        renderer.render(scene, camera)
      }

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
