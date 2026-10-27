import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Phải khớp SHARED_FILES trong scripts/sync-mobile-shared.mjs
const SHARED_FILES = ['datetime.ts', 'pricing.ts', 'booking-slots.ts', 'cancellation.ts', 'profile.ts', 'image-upload.ts', 'banks.ts']

const read = (path: string) => readFileSync(path, 'utf-8').replace(/\r\n/g, '\n')

describe('logic dùng chung giữa web và mobile', () => {
  for (const file of SHARED_FILES) {
    it(`${file} ở mobile trùng khớp bản ở web`, () => {
      const web = read(join(process.cwd(), 'src', 'lib', file))
      const mobile = read(join(process.cwd(), '..', 'mobile', 'src', 'shared', file))
      // Nếu fail: chạy `npm run sync:mobile` trong web/ rồi commit cả hai nơi
      expect(mobile).toBe(web)
    })
  }

  it('các file dùng chung không import thứ gì của Next.js hay alias @/', () => {
    for (const file of SHARED_FILES) {
      const src = read(join(process.cwd(), 'src', 'lib', file))
      expect(src, file).not.toMatch(/from ['"]@\//)
      expect(src, file).not.toMatch(/from ['"]next/)
    }
  })
})
