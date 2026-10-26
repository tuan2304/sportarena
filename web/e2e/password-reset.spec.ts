import { expect, test, type Page } from '@playwright/test'
import { USERS } from './fixtures.mjs'

const mock = 'http://127.0.0.1:54399'

const text = {
  vi: {
    forgotLink: 'Quên mật khẩu?',
    forgotTitle: 'Quên mật khẩu',
    submit: 'Gửi liên kết đặt lại',
    sentTitle: 'Kiểm tra email của bạn',
    invalidTitle: 'Liên kết không dùng được',
    resetTitle: 'Đặt mật khẩu mới',
    newPassword: 'Mật khẩu mới',
    confirm: 'Nhập lại mật khẩu mới',
    change: 'Đổi mật khẩu',
    mismatch: 'Mật khẩu nhập lại không khớp',
  },
  en: {
    forgotLink: 'Forgot password?',
    forgotTitle: 'Forgot password',
    submit: 'Send reset link',
    sentTitle: 'Check your email',
    invalidTitle: 'This link cannot be used',
    resetTitle: 'Set a new password',
    newPassword: 'New password',
    confirm: 'Repeat the new password',
    change: 'Change password',
    mismatch: 'The passwords do not match',
  },
}

/** Phiên khôi phục giả như Supabase cấp khi bấm liên kết trong thư; trả về phần # của liên kết. */
async function recoveryHash(email: string): Promise<string> {
  const res = await fetch(`${mock}/__recovery-session?email=${encodeURIComponent(email)}`)
  const { access_token, refresh_token } = (await res.json()) as { access_token: string; refresh_token: string }
  return `#access_token=${access_token}&expires_in=3600&refresh_token=${refresh_token}&token_type=bearer&type=recovery`
}

async function loginNormally(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mật khẩu').fill('mat-khau-bat-ky')
  await page.getByRole('button', { name: /^Đăng nhập/ }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

for (const lang of ['vi', 'en'] as const) {
  const t = text[lang]

  test.describe(`Quên mật khẩu (${lang})`, () => {
    test.use({ locale: lang === 'en' ? 'en-US' : 'vi-VN' })

    test('trang đăng nhập có liên kết tới trang quên mật khẩu', async ({ page }) => {
      await page.goto('/login')
      await page.getByRole('link', { name: t.forgotLink }).click()
      await expect(page).toHaveURL(/\/forgot-password$/)
      await expect(page.getByText(t.forgotTitle, { exact: true })).toBeVisible()
    })

    test('gửi email thì báo đã gửi và server chỉ gửi một yêu cầu tới Supabase, kèm địa chỉ trang đặt lại', async ({ page }) => {
      const email = `Quen.Mat.Khau.${lang}@Example.com`
      await page.goto('/forgot-password')
      await page.getByLabel('Email').fill(email)
      await page.getByRole('button', { name: t.submit }).click()
      await expect(page.getByText(t.sentTitle, { exact: true })).toBeVisible()
      await expect(page.getByText(email)).toBeVisible() // giao diện nhắc lại đúng thứ người dùng gõ, server mới chuẩn hóa

      const requests = (await (await fetch(`${mock}/__recover-requests`)).json()) as Array<{ email: string; redirectTo: string | null }>
      const mine = requests.filter((r) => r.email === email.toLowerCase())
      expect(mine).toHaveLength(1)
      expect(mine[0].redirectTo).toMatch(/\/reset-password$/)
    })

    test('trang đặt lại không có token hoặc liên kết hết hạn thì báo không dùng được', async ({ page }) => {
      await page.goto('/reset-password')
      await expect(page.getByText(t.invalidTitle, { exact: true })).toBeVisible()
      await expect(page.getByRole('link', { name: lang === 'en' ? 'Request a new link' : 'Yêu cầu liên kết mới' })).toHaveAttribute('href', '/forgot-password')

      // Đổi mỗi phần # trên cùng trang không tải lại, nên phải rời trang trước
      await page.goto('about:blank')
      await page.goto('/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')
      await expect(page.getByText(t.invalidTitle, { exact: true })).toBeVisible()
      await expect.poll(() => page.url(), { timeout: 5000 }).not.toContain('error_code') // phần # đã bị xóa khỏi thanh địa chỉ
    })

    test('liên kết hợp lệ: xóa token khỏi URL, kiểm tra mật khẩu nhập lại, đổi xong về trang chủ', async ({ page }) => {
      const hash = await recoveryHash(USERS.player.email)
      await page.goto(`/reset-password${hash}`)
      await expect(page.getByText(t.resetTitle, { exact: true })).toBeVisible()
      await expect.poll(() => page.url(), { timeout: 5000 }).not.toContain('access_token')

      await page.getByLabel(t.newPassword, { exact: true }).fill('mat-khau-moi-123')
      await page.getByLabel(t.confirm).fill('mat-khau-khac-456')
      await page.getByRole('button', { name: t.change }).click()
      await expect(page.locator('form [role=alert]')).toContainText(t.mismatch)

      await page.getByLabel(t.confirm).fill('mat-khau-moi-123')
      await page.getByRole('button', { name: t.change }).click()
      await page.waitForURL((url) => url.pathname === '/')

      const updates = (await (await fetch(`${mock}/__password-updates`)).json()) as Array<{ userId: string; password: string }>
      expect(updates.some((u) => u.userId === USERS.player.id && u.password === 'mat-khau-moi-123')).toBe(true)
    })
  })
}

test('phiên đăng nhập thường không đổi được mật khẩu bằng trang đặt lại (phải qua liên kết trong thư)', async ({ page }) => {
  await loginNormally(page, USERS.player.email)
  await page.goto('/reset-password')
  await expect(page.getByText(text.vi.invalidTitle, { exact: true })).toBeVisible()
})

test('API mobile gửi thư đặt lại: dữ liệu sai bị từ chối, email hợp lệ được nhận không cần đăng nhập', async ({ request }) => {
  const bad = await request.post('/api/mobile/auth/forgot-password', { data: { email: 'khong-phai-email' }, headers: { 'Accept-Language': 'en' } })
  expect(bad.status()).toBe(400)
  expect((await bad.json()).error).toBe('Please enter a valid email')

  const email = `mobile.${Date.now()}@example.com`
  const ok = await request.post('/api/mobile/auth/forgot-password', { data: { email } })
  expect(ok.status()).toBe(200)
  expect(await ok.json()).toEqual({ success: true })
  const requests = (await (await fetch(`${mock}/__recover-requests`)).json()) as Array<{ email: string }>
  expect(requests.filter((r) => r.email === email)).toHaveLength(1)
})
