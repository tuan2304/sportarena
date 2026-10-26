import { expect, test, type Page } from '@playwright/test'
import { ANON_KEY, createUser, PASSWORD, SERVICE_KEY, SUPABASE_URL, type TestUser } from './helpers'

/**
 * Quên mật khẩu với GoTrue thật: liên kết khôi phục, phiên có amr "recovery", đổi mật khẩu và thu hồi các phiên khác.
 * Không đọc hộp thư: dùng API quản trị tạo đúng loại liên kết mà thư sẽ chứa, rồi mở nó như người dùng bấm vào.
 */
const APP = 'http://127.0.0.1:3200'

async function recoveryLink(email: string): Promise<string> {
  const generated = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'recovery', email, redirect_to: `${APP}/reset-password` }),
  })
  expect(generated.ok).toBe(true)
  const { action_link } = (await generated.json()) as { action_link: string }

  // Bấm liên kết: GoTrue xác minh rồi chuyển về trang đặt lại, mang phiên khôi phục ở phần sau dấu #
  const verified = await fetch(action_link, { redirect: 'manual' })
  const location = verified.headers.get('location')
  expect(location, 'GoTrue phải chuyển về trang đặt lại (kiểm tra additional_redirect_urls trong supabase/config.toml)').toMatch(/\/reset-password#access_token=/)
  return location!
}

async function signIn(email: string, password: string) {
  return fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

async function fillAndSubmit(page: Page, password: string, confirm = password) {
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill(password)
  await page.getByLabel('Nhập lại mật khẩu mới').fill(confirm)
  await page.getByRole('button', { name: 'Đổi mật khẩu' }).click()
}

test.describe.configure({ mode: 'serial' })

let user: TestUser

test.beforeAll(async () => {
  user = await createUser('quen-mk', 'player', 'Nguoi Quen Mat Khau')
})

test('gửi thư đặt lại qua API mobile: nhận email bất kỳ mà không lộ tài khoản nào đã tồn tại', async ({ request }) => {
  const known = await request.post('/api/mobile/auth/forgot-password', { data: { email: user.email } })
  expect(known.status()).toBe(200)
  const unknown = await request.post('/api/mobile/auth/forgot-password', { data: { email: `khong-ton-tai-${Date.now()}@e2e.test` } })
  expect(unknown.status()).toBe(200)
  expect(await unknown.json()).toEqual(await known.json())
})

test('liên kết khôi phục thật: đổi mật khẩu, mật khẩu cũ hết hiệu lực, phiên ở thiết bị khác bị thu hồi', async ({ page }) => {
  const link = await recoveryLink(user.email)
  await page.goto(link)
  await expect(page.getByText('Đặt mật khẩu mới', { exact: true })).toBeVisible()
  await expect.poll(() => page.url()).not.toContain('access_token')

  await fillAndSubmit(page, 'mat-khau-moi-123', 'mat-khau-khac-999')
  await expect(page.locator('form [role=alert]')).toContainText('Mật khẩu nhập lại không khớp')

  await fillAndSubmit(page, 'mat-khau-moi-123')
  await page.waitForURL((url) => url.pathname === '/')

  expect((await signIn(user.email, 'mat-khau-moi-123')).status).toBe(200)
  expect((await signIn(user.email, PASSWORD)).status).toBe(400)

  // Phiên đã đăng nhập ở nơi khác trước khi đổi mật khẩu không làm mới được nữa
  const refreshed = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: user.refreshToken }),
  })
  expect(refreshed.ok).toBe(false)
})

test('trang đặt lại từ chối token giả và phiên đăng nhập thường không đổi được mật khẩu', async ({ page }) => {
  await page.goto('/reset-password#access_token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.sig-gia&refresh_token=refresh-gia&type=recovery')
  await expect(page.getByText('Liên kết không dùng được', { exact: true })).toBeVisible()

  // Đăng nhập bình thường (mật khẩu mới) rồi vào trang đặt lại: không có phiên khôi phục nên không hiện form
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Mật khẩu').fill('mat-khau-moi-123')
  await page.getByRole('button', { name: /^Đăng nhập/ }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
  await page.goto('/reset-password')
  await expect(page.getByText('Liên kết không dùng được', { exact: true })).toBeVisible()
})
