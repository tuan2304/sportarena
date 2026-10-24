import { expect, test } from '@playwright/test'
import { CLUB_ID } from './fixtures.mjs'

test.describe('Trang công khai', () => {
  test('trang chủ hiển thị thương hiệu và lối vào đăng nhập', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/SportArena/)
    await expect(page.getByRole('link', { name: /đăng nhập/i }).first()).toBeVisible()
  })

  test('danh sách sân hiện cụm sân và mở được trang chi tiết', async ({ page }) => {
    await page.goto('/clubs')
    await expect(page.getByRole('heading', { name: 'Cụm sân Kiểm Thử' })).toBeVisible()
    await page.getByRole('link', { name: /Đặt Sân Ngay/ }).first().click()
    await expect(page).toHaveURL(new RegExp(`/clubs/${CLUB_ID}`))
    await expect(page.getByRole('heading', { name: /Cụm sân Kiểm Thử/ }).first()).toBeVisible()
  })

  test('cụm sân không tồn tại hiện trang không tìm thấy', async ({ page }) => {
    // Trang có loading.tsx nên phản hồi được stream (HTTP 200) trước khi notFound() chạy; kiểm tra nội dung thay vì mã
    await page.goto('/clubs/99999999-9999-4999-8999-999999999999')
    await expect(page.getByText(/not found|không tìm thấy|404/i).first()).toBeVisible()
    await expect(page.getByText('Cụm sân Kiểm Thử')).toHaveCount(0)
  })

  test('từ khóa tìm kiếm chứa HTML không được thực thi', async ({ page }) => {
    let dialog = false
    page.on('dialog', async (d) => {
      dialog = true
      await d.dismiss()
    })
    await page.goto('/clubs?q=' + encodeURIComponent('<img src=x onerror=alert(1)>'))
    await page.waitForLoadState('networkidle')
    expect(dialog).toBe(false)
  })
})

test.describe('Đăng nhập', () => {
  test('sai thông tin hiện thông báo lỗi (form chạy bằng JavaScript phía client)', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('khong-ton-tai@example.com')
    await page.getByLabel('Mật khẩu').fill('sai-mat-khau')
    await page.getByRole('button', { name: /đăng nhập/i }).click()
    await expect(page.locator('form [role=alert]')).toContainText('Email hoặc mật khẩu không chính xác')
  })

  test('nút chuyển giao diện sáng/tối đổi class', async ({ page }) => {
    await page.goto('/login')
    const html = page.locator('html')
    const before = await html.evaluate((el) => el.classList.contains('dark'))
    await page.getByRole('button', { name: /giao diện|sáng|tối/i }).first().click()
    await expect.poll(() => html.evaluate((el) => el.classList.contains('dark'))).toBe(!before)
  })
})

test.describe('Trang cần đăng nhập', () => {
  for (const path of ['/my-bookings', '/profile', '/owner/dashboard', '/admin']) {
    test(`${path} chuyển khách về trang đăng nhập`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login/)
    })
  }

  test('API mobile từ chối yêu cầu không có token', async ({ request }) => {
    const res = await request.post('/api/mobile/bookings', { data: {} })
    expect(res.status()).toBe(401)
  })

  test('webhook PayOS không xác nhận đơn nào khi mã đơn không tồn tại', async ({ request }) => {
    const res = await request.post('/api/payos/webhook', { data: { code: '00', data: { orderCode: 1 }, signature: 'x' } })
    // 200 có chủ ý: PayOS cần phản hồi 200 khi đăng ký webhook; không có đơn tương ứng thì bỏ qua
    expect(res.status()).toBe(200)
    expect((await res.json()).message).toMatch(/Bỏ qua/)
  })

  test('webhook PayOS từ chối thân không phải JSON', async ({ request }) => {
    const res = await request.post('/api/payos/webhook', { headers: { 'Content-Type': 'text/plain' }, data: 'không phải json' })
    expect(res.status()).toBe(400)
  })
})
