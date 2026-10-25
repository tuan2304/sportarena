// Chạy bộ kiểm thử Supabase thật: lấy địa chỉ và khóa từ `supabase status` của Supabase cục bộ rồi gọi Playwright.
// Cần Docker và Supabase CLI; chạy `supabase start` (ở thư mục gốc dự án) trước. CI cũng dùng đúng script này.
import { execFileSync, spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// E2E_SUPABASE_WORKDIR: thư mục chứa supabase/config.toml riêng (cổng khác) khi máy đang chạy một Supabase cục bộ khác
const root = process.env.E2E_SUPABASE_WORKDIR ? resolve(process.env.E2E_SUPABASE_WORKDIR) : resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const windows = process.platform === 'win32'

let status
try {
  status = execFileSync('supabase', ['status', '-o', 'env'], { cwd: root, encoding: 'utf8', shell: windows })
} catch {
  console.error('Không đọc được `supabase status`. Hãy cài Supabase CLI, bật Docker và chạy `supabase start` ở thư mục gốc dự án.')
  process.exit(1)
}

const values = Object.fromEntries(
  status
    .split(/\r?\n/)
    .map((line) => /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim()))
    .filter(Boolean)
    .map((m) => [m[1], m[2]])
)

for (const key of ['API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY']) {
  if (!values[key]) {
    console.error(`\`supabase status\` không trả về ${key}. Supabase cục bộ đã chạy chưa?`)
    process.exit(1)
  }
}

const result = spawnSync('npx', ['playwright', 'test', '-c', 'playwright.real.config.ts', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: windows,
  env: {
    ...process.env,
    E2E_SUPABASE_URL: values.API_URL,
    E2E_SUPABASE_ANON_KEY: values.ANON_KEY,
    E2E_SUPABASE_SERVICE_ROLE_KEY: values.SERVICE_ROLE_KEY,
  },
})
process.exit(result.status ?? 1)
