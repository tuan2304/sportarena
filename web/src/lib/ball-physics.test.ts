import { describe, expect, it } from 'vitest'
import { bounceWalls, collideBodies, stepBodies, type Body } from './ball-physics'

const ball = (x: number, y: number, vx: number, vy: number, r = 1, mass = r * r): Body => ({ x, y, vx, vy, r, mass })
const momentum = (bs: Body[]) => ({
  x: bs.reduce((s, b) => s + b.mass * b.vx, 0),
  y: bs.reduce((s, b) => s + b.mass * b.vy, 0),
})
const energy = (bs: Body[]) => bs.reduce((s, b) => s + 0.5 * b.mass * (b.vx ** 2 + b.vy ** 2), 0)

describe('bounceWalls', () => {
  it('bật lại khi tâm vượt mép (đã chừa bán kính)', () => {
    const b = ball(9.5, 0, 3, 1)
    bounceWalls(b, 10, 10)
    expect(b.x).toBe(9)
    expect(b.vx).toBe(-3)
    expect(b.vy).toBe(1)
  })

  it('bật ở cả bốn mép', () => {
    const b = ball(-20, -20, -2, -4)
    bounceWalls(b, 10, 8)
    expect(b).toMatchObject({ x: -9, y: -7, vx: 2, vy: 4 })
  })
})

describe('collideBodies', () => {
  it('hai quả cùng khối lượng đối đầu thì đổi vận tốc cho nhau', () => {
    const bs = [ball(-0.9, 0, 2, 0), ball(0.9, 0, -2, 0)]
    expect(collideBodies(bs)).toBe(1)
    expect(bs[0].vx).toBeCloseTo(-2)
    expect(bs[1].vx).toBeCloseTo(2)
  })

  it('bảo toàn động lượng và động năng, kể cả khác khối lượng và va chéo', () => {
    const bs = [ball(0, 0, 3, 1, 2), ball(2.5, 1, -1, -2, 1)]
    const p0 = momentum(bs)
    const e0 = energy(bs)
    expect(collideBodies(bs)).toBe(1)
    expect(momentum(bs).x).toBeCloseTo(p0.x)
    expect(momentum(bs).y).toBeCloseTo(p0.y)
    expect(energy(bs)).toBeCloseTo(e0)
  })

  it('quả nhỏ bị bật mạnh hơn khi đâm vào quả to đứng yên', () => {
    const bs = [ball(0, 0, 0, 0, 3), ball(3.5, 0, -4, 0, 1)]
    collideBodies(bs)
    expect(bs[1].vx).toBeGreaterThan(0) // bật ngược lại
    expect(Math.abs(bs[0].vx)).toBeLessThan(Math.abs(bs[1].vx))
  })

  it('đẩy hai quả đang chồng lên nhau ra khỏi nhau, không để dính', () => {
    const bs = [ball(0, 0, 0, 0), ball(0.5, 0, 0, 0)]
    collideBodies(bs)
    expect(Math.hypot(bs[1].x - bs[0].x, bs[1].y - bs[0].y)).toBeGreaterThanOrEqual(2 - 1e-9)
  })

  it('hai quả đã tách và đang bay ra xa thì không đổi vận tốc lại', () => {
    const bs = [ball(-0.9, 0, -2, 0), ball(0.9, 0, 2, 0)] // chồng nhẹ nhưng đang rời nhau
    collideBodies(bs)
    expect(bs[0].vx).toBe(-2)
    expect(bs[1].vx).toBe(2)
  })

  it('không va chạm khi còn cách nhau', () => {
    const bs = [ball(-5, 0, 1, 0), ball(5, 0, -1, 0)]
    expect(collideBodies(bs)).toBe(0)
  })

  it('trùng tâm không sinh NaN', () => {
    const bs = [ball(1, 1, 1, 0), ball(1, 1, -1, 0)]
    collideBodies(bs)
    for (const b of bs) expect(Number.isFinite(b.x + b.y + b.vx + b.vy)).toBe(true)
  })
})

describe('stepBodies', () => {
  it('hai quả bay vào nhau rồi bật ra, không đi xuyên qua nhau', () => {
    const a = ball(-6, 0, 4, 0)
    const b = ball(6, 0, -4, 0)
    let hits = 0
    for (let i = 0; i < 200; i++) {
      hits += stepBodies([a, b], 1 / 60, 20, 20)
      // Luôn giữ thứ tự trái → phải: quả a không bao giờ vượt qua quả b
      expect(a.x).toBeLessThan(b.x)
    }
    expect(hits).toBeGreaterThan(0)
    expect(a.vx).toBeLessThan(0)
    expect(b.vx).toBeGreaterThan(0)
  })

  it('nhiều quả trong khung hẹp vẫn nằm trong khung và không chồng nhau lâu dài', () => {
    const bodies = Array.from({ length: 8 }, (_, i) =>
      ball(-6 + i * 1.7, ((i % 3) - 1) * 2, Math.cos(i * 2.4) * 5, Math.sin(i * 2.4) * 4, 0.8)
    )
    let maxOverlap = 0
    for (let step = 0; step < 3000; step++) {
      stepBodies(bodies, 1 / 60, 8, 6)
      for (const b of bodies) {
        expect(Math.abs(b.x)).toBeLessThanOrEqual(8 - b.r + 1e-9)
        expect(Math.abs(b.y)).toBeLessThanOrEqual(6 - b.r + 1e-9)
      }
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const d = Math.hypot(bodies[i].x - bodies[j].x, bodies[i].y - bodies[j].y)
          maxOverlap = Math.max(maxOverlap, bodies[i].r + bodies[j].r - d)
        }
      }
    }
    // Chồng lấn thoáng qua trong một khung hình là chấp nhận được, nhưng không được lún sâu
    expect(maxOverlap).toBeLessThan(0.8)
  })
})
