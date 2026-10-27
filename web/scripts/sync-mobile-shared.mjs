// Sao chép các file logic thuần (không phụ thuộc Next.js) từ web sang mobile để hai nơi luôn tính giá, giờ và
// chính sách hủy giống hệt nhau. Chạy: npm run sync:mobile (trong web/). Test shared-sync.test.ts sẽ fail nếu hai bản lệch.
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SHARED_FILES = ['datetime.ts', 'pricing.ts', 'booking-slots.ts', 'cancellation.ts', 'profile.ts', 'image-upload.ts', 'banks.ts']

const here = dirname(fileURLToPath(import.meta.url))
const from = join(here, '..', 'src', 'lib')
const to = join(here, '..', '..', 'mobile', 'src', 'shared')

mkdirSync(to, { recursive: true })
for (const file of SHARED_FILES) {
  copyFileSync(join(from, file), join(to, file))
  console.log(`web/src/lib/${file} -> mobile/src/shared/${file}`)
}
