/** Texture bóng thể thao vẽ bằng canvas (không cần tải ảnh), dùng chung cho các cảnh Three.js. Chỉ chạy ở trình duyệt. */
export type BallKind = 'soccer' | 'basketball' | 'tennis' | 'pickleball' | 'volleyball'

const TAU = Math.PI * 2

/** Texture trải phẳng (equirectangular) vẽ bằng canvas cho từng loại bóng, không cần tải ảnh. */
export function ballTexture(kind: BallKind): HTMLCanvasElement {
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
