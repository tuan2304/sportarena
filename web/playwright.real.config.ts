import { defineConfig, devices } from '@playwright/test'

/**
 * Kiểm thử luồng ghi dữ liệu trên Supabase thật chạy cục bộ (`supabase start`, cần Docker). Khác playwright.config.ts
 * (Supabase giả, không có RLS), ở đây migration, RLS, trigger và ràng buộc chống trùng lịch đều là thật.
 * Chạy bằng `npm run e2e:real` để khóa được lấy từ `supabase status`; cấu hình này chỉ đọc biến E2E_SUPABASE_*.
 */
const APP_PORT = 3200
const appUrl = `http://127.0.0.1:${APP_PORT}`
const supabaseUrl = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321'

export default defineConfig({
  testDir: './e2e-real',
  testMatch: '**/*.spec.ts',
  // Các ca dùng chung dữ liệu và chạy tuần tự trong một file
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: appUrl,
    locale: 'vi-VN',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npx next start -H 127.0.0.1 -p ${APP_PORT}`,
    url: appUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.E2E_SUPABASE_ANON_KEY ?? '',
      SUPABASE_SERVICE_ROLE_KEY: process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? '',
      NEXT_PUBLIC_APP_URL: appUrl,
    },
  },
})
