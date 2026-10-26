/** Vật lý 2D đơn giản cho các quả bóng ở nền trang chủ: bật tường và va chạm đàn hồi giữa các hình tròn. */

export interface Body {
  x: number
  y: number
  vx: number
  vy: number
  /** Bán kính va chạm */
  r: number
  /** Khối lượng (quả to nặng hơn quả nhỏ) */
  mass: number
}

/** Bật lại khi chạm mép khung chữ nhật [-halfW, halfW] x [-halfH, halfH] (tính theo tâm, đã chừa bán kính). */
export function bounceWalls(b: Body, halfW: number, halfH: number): void {
  const limX = Math.max(halfW - b.r, 0)
  const limY = Math.max(halfH - b.r, 0)
  if (b.x > limX) {
    b.x = limX
    b.vx = -Math.abs(b.vx)
  } else if (b.x < -limX) {
    b.x = -limX
    b.vx = Math.abs(b.vx)
  }
  if (b.y > limY) {
    b.y = limY
    b.vy = -Math.abs(b.vy)
  } else if (b.y < -limY) {
    b.y = -limY
    b.vy = Math.abs(b.vy)
  }
}

/**
 * Va chạm đàn hồi giữa mọi cặp bóng đang chồng lên nhau: đổi vận tốc theo phương nối hai tâm
 * (bảo toàn động lượng và động năng) rồi đẩy hai quả tách khỏi nhau để không bị dính hay xuyên qua.
 * Trả về số cặp đã va chạm.
 */
export function collideBodies(bodies: Body[]): number {
  let hits = 0
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i]
      const b = bodies[j]
      let dx = b.x - a.x
      let dy = b.y - a.y
      const minDist = a.r + b.r
      const distSq = dx * dx + dy * dy
      if (distSq >= minDist * minDist) continue

      let dist = Math.sqrt(distSq)
      if (dist < 1e-6) {
        // Trùng tâm: chọn một phương bất kỳ để tách ra
        dx = 1
        dy = 0
        dist = 1
      }
      const nx = dx / dist
      const ny = dy / dist
      const invA = 1 / a.mass
      const invB = 1 / b.mass

      // Chỉ đổi vận tốc khi hai quả đang lao vào nhau (tránh đổi lại khi đã tách)
      const approach = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny
      if (approach > 0) {
        const impulse = (2 * approach) / (invA + invB)
        a.vx -= impulse * invA * nx
        a.vy -= impulse * invA * ny
        b.vx += impulse * invB * nx
        b.vy += impulse * invB * ny
        hits++
      }

      // Đẩy tách phần chồng lấn, quả nhẹ bị đẩy nhiều hơn
      const overlap = minDist - dist
      const total = invA + invB
      a.x -= nx * overlap * (invA / total)
      a.y -= ny * overlap * (invA / total)
      b.x += nx * overlap * (invB / total)
      b.y += ny * overlap * (invB / total)
    }
  }
  return hits
}

/** Một bước mô phỏng: di chuyển, bật tường, va chạm giữa các quả, rồi bật tường lần nữa nếu bị đẩy ra ngoài. */
export function stepBodies(bodies: Body[], dt: number, halfW: number, halfH: number): number {
  for (const b of bodies) {
    b.x += b.vx * dt
    b.y += b.vy * dt
    bounceWalls(b, halfW, halfH)
  }
  const hits = collideBodies(bodies)
  for (const b of bodies) bounceWalls(b, halfW, halfH)
  return hits
}
