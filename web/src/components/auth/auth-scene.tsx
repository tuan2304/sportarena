'use client'

import { useEffect, useRef } from 'react'
import type * as THREE from 'three'
import { ballTexture, type BallKind } from '@/components/three/ball-texture'

/** Sân rộng 16 x 10 đơn vị, vẽ lên canvas 1600 x 1000 nên 1 đơn vị = 100 px. */
const COURT_W = 16
const COURT_H = 10
const PX = 100

const PALETTES = {
  dark: {
    floorA: 'rgba(8, 70, 52, 0.94)',
    floorB: 'rgba(3, 34, 26, 0.94)',
    stripe: 'rgba(52, 211, 153, 0.08)',
    line: '#9bf7d0',
    glow: '#34d399',
    particles: [0x34d399, 0xfbbf24, 0xe6fff5],
  },
  light: {
    floorA: 'rgba(52, 211, 153, 0.92)',
    floorB: 'rgba(5, 150, 105, 0.92)',
    stripe: 'rgba(255, 255, 255, 0.16)',
    line: '#ffffff',
    glow: 'rgba(255, 255, 255, 0.95)',
    particles: [0x059669, 0xf59e0b, 0x0f766e],
  },
} as const

/** Mặt sân có vạch kẻ phát sáng, mép mờ dần để sân như nổi lên giữa nền chứ không bị cắt vuông. */
function courtTexture(dark: boolean): HTMLCanvasElement {
  const p = dark ? PALETTES.dark : PALETTES.light
  const W = COURT_W * PX
  const H = COURT_H * PX
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const g = canvas.getContext('2d')!

  const floor = g.createLinearGradient(0, 0, 0, H)
  floor.addColorStop(0, p.floorA)
  floor.addColorStop(1, p.floorB)
  g.fillStyle = floor
  g.fillRect(0, 0, W, H)

  const m = 150 // lề giữa mép texture và vạch biên
  const x0 = m
  const y0 = m
  const fw = W - m * 2
  const fh = H - m * 2
  const cx = W / 2
  const cy = H / 2

  // Sọc cỏ/sàn xen kẽ
  g.fillStyle = p.stripe
  for (let i = 0; i < 8; i += 2) g.fillRect(x0 + (i * fw) / 8, y0, fw / 8, fh)

  g.strokeStyle = p.line
  g.fillStyle = p.line
  g.lineWidth = 7
  g.lineJoin = 'round'
  g.shadowColor = p.glow
  g.shadowBlur = 22
  g.strokeRect(x0, y0, fw, fh)
  g.beginPath()
  g.moveTo(cx, y0)
  g.lineTo(cx, y0 + fh)
  g.stroke()
  g.beginPath()
  g.arc(cx, cy, 130, 0, Math.PI * 2)
  g.stroke()
  g.beginPath()
  g.arc(cx, cy, 9, 0, Math.PI * 2)
  g.fill()
  for (const side of [0, 1]) {
    const dir = side === 0 ? 1 : -1
    const edge = side === 0 ? x0 : x0 + fw
    g.strokeRect(side === 0 ? edge : edge - 230, cy - 190, 230, 380)
    g.strokeRect(side === 0 ? edge : edge - 90, cy - 90, 90, 180)
    g.beginPath()
    g.arc(edge + dir * 230, cy, 110, side === 0 ? -Math.PI * 0.38 : Math.PI * 0.62, side === 0 ? Math.PI * 0.38 : Math.PI * 1.38)
    g.stroke()
  }

  // Mép mờ dần: xóa dần alpha về 0 ở bốn cạnh
  g.shadowBlur = 0
  g.globalCompositeOperation = 'destination-out'
  const F = 210
  const fade = (x1: number, y1: number, x2: number, y2: number, rect: [number, number, number, number]) => {
    const grad = g.createLinearGradient(x1, y1, x2, y2)
    grad.addColorStop(0, 'rgba(0,0,0,1)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grad
    g.fillRect(...rect)
  }
  fade(0, 0, F, 0, [0, 0, F, H])
  fade(W, 0, W - F, 0, [W - F, 0, F, H])
  fade(0, 0, 0, F, [0, 0, W, F])
  fade(0, H, 0, H - F, [0, H - F, W, F])
  return canvas
}

/** Chấm sáng tròn mờ viền, làm sprite cho hạt bay và bóng đổ. */
function softDot(color: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const g = canvas.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, color)
  grad.addColorStop(0.45, color)
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  return canvas
}

interface BallSpec {
  kind: BallKind
  r: number
  /** Quả bóng chạy vòng elip quanh (cx, cz) trên mặt sân */
  cx: number
  cz: number
  rx: number
  rz: number
  w: number
  phase: number
  /** Độ cao đỉnh mỗi cú nảy và chu kỳ (giây) */
  height: number
  period: number
  spin: [number, number]
}

const BALLS: BallSpec[] = [
  { kind: 'soccer', r: 0.62, cx: -3.6, cz: 0.4, rx: 2.4, rz: 1.7, w: 0.34, phase: 0, height: 2.3, period: 1.55, spin: [1.3, 0.8] },
  { kind: 'basketball', r: 0.72, cx: 3.6, cz: -0.6, rx: 2.2, rz: 1.5, w: -0.28, phase: 2.1, height: 2.9, period: 1.75, spin: [-1.1, 0.9] },
  { kind: 'tennis', r: 0.34, cx: 0.4, cz: 2.5, rx: 3.2, rz: 1.0, w: 0.5, phase: 4.0, height: 1.9, period: 1.0, spin: [2.2, -1.4] },
  { kind: 'pickleball', r: 0.42, cx: -0.6, cz: -2.4, rx: 3.0, rz: 0.9, w: -0.42, phase: 1.2, height: 2.1, period: 1.3, spin: [1.6, 1.9] },
  { kind: 'volleyball', r: 0.58, cx: 5.4, cz: 2.4, rx: 1.4, rz: 1.1, w: 0.4, phase: 3.3, height: 2.5, period: 1.6, spin: [-0.9, 1.2] },
]

/**
 * Nền 3D cho các trang đăng nhập/đăng ký: một sân thể thao nghiêng trong không gian, vạch kẻ phát sáng, xoay đung
 * đưa chậm; các quả bóng chạy vòng và nảy trên sân (bị ép dẹt khi chạm đất, có bóng đổ), hạt sáng bay lên, camera
 * lệch nhẹ theo con trỏ. Màu đổi theo giao diện sáng/tối. Three.js nạp động nên không nằm trong bundle đầu; không có
 * WebGL thì im lặng bỏ qua, nền CSS bên dưới vẫn hiển thị. Giảm chuyển động thì chỉ vẽ một khung tĩnh.
 */
export function AuthScene() {
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return

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
      const compact = window.innerWidth < 700
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, compact ? 1.5 : 1.75))
      renderer.outputColorSpace = THREE.SRGBColorSpace
      const canvas = renderer.domElement
      canvas.className = 'absolute inset-0 h-full w-full'
      canvas.style.opacity = '0'
      canvas.style.transition = 'opacity 1.4s ease'
      wrap.appendChild(canvas)

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100)
      const BASE_Y = 5.4
      const BASE_Z = 13.4

      scene.add(new THREE.AmbientLight(0xffffff, 1.5))
      const key = new THREE.DirectionalLight(0xffffff, 2.3)
      key.position.set(-4, 9, 6)
      scene.add(key)
      const rim = new THREE.PointLight(0x34d399, 45, 40)
      rim.position.set(6, 2.5, 4)
      scene.add(rim)

      const disposables: Array<{ dispose: () => void }> = []
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      // Sân + các quả bóng + bóng đổ cùng nằm trong một nhóm để xoay chung
      const stage = new THREE.Group()
      scene.add(stage)

      const courtGeo = new THREE.PlaneGeometry(COURT_W, COURT_H)
      const courtMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide })
      const court = new THREE.Mesh(courtGeo, courtMat)
      court.rotation.x = -Math.PI / 2
      stage.add(court)
      disposables.push(courtGeo, courtMat)

      const shadowTex = new THREE.CanvasTexture(softDot('rgba(0,0,0,0.9)'))
      disposables.push(shadowTex)
      const shadowGeo = new THREE.PlaneGeometry(1, 1)
      disposables.push(shadowGeo)

      const sphereGeo = new THREE.SphereGeometry(1, 40, 28)
      disposables.push(sphereGeo)
      const textures = new Map<BallKind, THREE.CanvasTexture>()

      const specs = compact ? BALLS.slice(0, 3) : BALLS
      const balls = specs.map((spec) => {
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
        const body = new THREE.Mesh(sphereGeo, mat)
        body.scale.setScalar(spec.r)
        const holder = new THREE.Group() // chỗ áp dụng độ dẹt khi chạm đất, không làm méo vòng quay của quả bóng
        holder.add(body)
        stage.add(holder)

        const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
        disposables.push(shadowMat)
        const shadow = new THREE.Mesh(shadowGeo, shadowMat)
        shadow.rotation.x = -Math.PI / 2
        shadow.position.y = 0.02
        stage.add(shadow)
        return { spec, holder, body, shadow, shadowMat }
      })

      // Hạt sáng bay lên từ mặt sân
      const COUNT = compact ? 36 : 80
      const positions = new Float32Array(COUNT * 3)
      const colors = new Float32Array(COUNT * 3)
      const rise = new Float32Array(COUNT)
      for (let i = 0; i < COUNT; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 18
        positions[i * 3 + 1] = Math.random() * 8
        positions[i * 3 + 2] = (Math.random() - 0.5) * 12
        rise[i] = 0.25 + Math.random() * 0.45
      }
      const particleGeo = new THREE.BufferGeometry()
      particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      const dotTex = new THREE.CanvasTexture(softDot('rgba(255,255,255,1)'))
      const particleMat = new THREE.PointsMaterial({
        size: 0.2,
        map: dotTex,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        sizeAttenuation: true,
      })
      const particles = new THREE.Points(particleGeo, particleMat)
      scene.add(particles)
      disposables.push(particleGeo, dotTex, particleMat)

      // Màu theo giao diện sáng/tối; dựng lại mặt sân khi người dùng đổi theme
      let courtTex: THREE.CanvasTexture | null = null
      const applyTheme = () => {
        const dark = document.documentElement.classList.contains('dark')
        courtTex?.dispose()
        courtTex = new THREE.CanvasTexture(courtTexture(dark))
        courtTex.colorSpace = THREE.SRGBColorSpace
        courtTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
        courtMat.map = courtTex
        courtMat.needsUpdate = true

        const palette = (dark ? PALETTES.dark : PALETTES.light).particles
        const c = new THREE.Color()
        for (let i = 0; i < COUNT; i++) {
          c.setHex(palette[i % palette.length])
          colors[i * 3] = c.r
          colors[i * 3 + 1] = c.g
          colors[i * 3 + 2] = c.b
        }
        particleGeo.attributes.color.needsUpdate = true
        particleMat.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending
        particleMat.needsUpdate = true
        for (const b of balls) b.shadowMat.color.set(dark ? 0x000000 : 0x064e3b)
      }
      applyTheme()
      const themeObserver = new MutationObserver(() => {
        applyTheme()
        if (reducedMotion) frame(STILL_TIME)
      })
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

      let aspect = 1
      const place = () => {
        const rect = wrap.getBoundingClientRect()
        const width = Math.max(rect.width, 1)
        const height = Math.max(rect.height, 1)
        renderer.setSize(width, height, false)
        aspect = width / height
        camera.aspect = aspect
        // Màn hình dọc (điện thoại): mở rộng góc nhìn và thu nhỏ sân một chút để vẫn thấy được sân lẫn bóng
        camera.fov = 36 * Math.min(1.9, Math.max(1, 1.1 / aspect))
        // ...và dời cảnh xuống phần dưới màn hình, nơi thẻ đăng nhập không che
        if (aspect < 1) camera.setViewOffset(width, height, 0, -height * 0.3, width, height)
        else camera.clearViewOffset()
        camera.updateProjectionMatrix()
        stage.scale.setScalar(aspect < 1 ? 0.75 : 1)
        if (reducedMotion) frame(STILL_TIME)
      }

      const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
      const onPointer = (e: PointerEvent) => {
        pointer.tx = (e.clientX / window.innerWidth) * 2 - 1
        pointer.ty = (e.clientY / window.innerHeight) * 2 - 1
      }
      if (!reducedMotion) window.addEventListener('pointermove', onPointer, { passive: true })

      const STILL_TIME = 2.4 // thời điểm dùng cho khung tĩnh khi giảm chuyển động
      let lastTime = 0
      const frame = (time: number) => {
        const t = time
        const dt = lastTime ? Math.min(t - lastTime, 0.05) : 0
        lastTime = t

        // Camera lệch theo con trỏ (làm mượt) và đung đưa nhẹ
        const ease = 1 - Math.exp(-dt * 3)
        pointer.x += (pointer.tx - pointer.x) * ease
        pointer.y += (pointer.ty - pointer.y) * ease
        camera.position.set(pointer.x * 1.8 + Math.sin(t * 0.21) * 0.5, BASE_Y - pointer.y * 0.9 + Math.cos(t * 0.17) * 0.25, BASE_Z)
        camera.lookAt(0, -0.2, 0)

        // Sân xoay đung đưa chậm; màn dọc (điện thoại) thì xoay 90° để chiều dài sân chạy dọc theo màn hình
        stage.rotation.y = aspect < 1 ? Math.PI / 2 + Math.sin(t * 0.11) * 0.4 : Math.sin(t * 0.11) * 0.6 + 0.15

        for (const b of balls) {
          const { spec, holder, body, shadow, shadowMat } = b
          const a = t * spec.w + spec.phase
          holder.position.x = spec.cx + Math.cos(a) * spec.rx
          holder.position.z = spec.cz + Math.sin(a) * spec.rz

          const u = (t / spec.period + spec.phase) % 1
          const h = spec.height * 4 * u * (1 - u) // đường parabol: chạm đất ở u = 0 và 1
          const squash = Math.max(0, 1 - h / 0.28) // ép dẹt ngay lúc chạm đất
          holder.scale.set(1 + 0.12 * squash, 1 - 0.16 * squash, 1 + 0.12 * squash)
          holder.position.y = spec.r * (1 - 0.16 * squash) + h

          body.rotation.x += dt * spec.spin[0]
          body.rotation.y += dt * spec.spin[1]

          const lift = Math.min(h / (spec.height * 1.3), 1)
          shadow.position.x = holder.position.x
          shadow.position.z = holder.position.z
          shadow.scale.setScalar(spec.r * 2.6 * (1 - 0.45 * lift))
          shadowMat.opacity = 0.62 * (1 - 0.75 * lift)
        }

        // Hạt bay lên rồi quay về mặt sân
        for (let i = 0; i < COUNT; i++) {
          let y = positions[i * 3 + 1] + rise[i] * dt
          if (y > 8) y = 0
          positions[i * 3 + 1] = y
          positions[i * 3] += Math.sin(t * 0.6 + i) * dt * 0.12
        }
        particleGeo.attributes.position.needsUpdate = true

        renderer.render(scene, camera)
      }

      place()
      const resizeObserver = new ResizeObserver(place)
      resizeObserver.observe(wrap)

      canvas.dataset.ready = 'true'
      let raf = 0
      const loop = (time: number) => {
        frame(time / 1000)
        raf = document.hidden ? 0 : requestAnimationFrame(loop)
      }
      const start = () => {
        if (!raf && !reducedMotion) raf = requestAnimationFrame(loop)
      }
      if (reducedMotion) frame(STILL_TIME)
      else start()
      // Hiện dần sau khung hình đầu để cảnh không "bật" ra đột ngột
      requestAnimationFrame(() => {
        canvas.style.opacity = '1'
      })
      const onVisibility = () => {
        if (!document.hidden) start()
      }
      document.addEventListener('visibilitychange', onVisibility)

      cleanup = () => {
        cancelAnimationFrame(raf)
        themeObserver.disconnect()
        resizeObserver.disconnect()
        window.removeEventListener('pointermove', onPointer)
        document.removeEventListener('visibilitychange', onVisibility)
        courtTex?.dispose()
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

  return <div ref={wrapRef} aria-hidden className="auth-scene absolute inset-0" />
}
