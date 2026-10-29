import { defineConfig, devices } from '@playwright/test'

/**
 * Kiểm thử đầu-cuối chạy trên bản build production thật của Next, nối với Supabase giả (e2e/mock-supabase.mjs).
 * Biến môi trường đặt ở đây ghi đè .env.local nên kiểm thử không bao giờ chạm tới database thật.
 * NEXT_PUBLIC_* được nhúng vào bundle lúc build, vì vậy bước build cũng phải chạy với đúng các giá trị này.
 */
const APP_PORT = 3100
const MOCK_PORT = 54399
const appUrl = `http://127.0.0.1:${APP_PORT}`
const mockUrl = `http://127.0.0.1:${MOCK_PORT}`

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  // Đăng nhập + điều hướng khi nhiều worker cùng chạy trên một máy có thể vượt 30s mặc định (chạy riêng thì mỗi test chỉ ~3s)
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: appUrl,
    // Trình duyệt giả lập dùng tiếng Việt (ngôn ngữ mặc định của web); kiểm thử tiếng Anh tự đặt cookie/locale riêng
    locale: 'vi-VN',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/mock-supabase.mjs',
      url: `${mockUrl}/__health`,
      reuseExistingServer: !process.env.CI,
      env: { MOCK_SUPABASE_PORT: String(MOCK_PORT) },
    },
    {
      command: `npm run build && npx next start -H 127.0.0.1 -p ${APP_PORT}`,
      url: appUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: mockUrl,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'e2e-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'e2e-service-role-key',
        NEXT_PUBLIC_APP_URL: appUrl,
      },
    },
  ],
})
