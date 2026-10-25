import { expect, test } from '@playwright/test'
import { CLUB_ID } from './fixtures.mjs'

test.describe('Đa ngôn ngữ Việt - Anh', () => {
  test('trình duyệt tiếng Việt thấy giao diện tiếng Việt', async ({ page }) => {
    await page.goto('/clubs')
    await expect(page.locator('html')).toHaveAttribute('lang', 'vi')
    await expect(page.getByRole('heading', { name: 'Khám Phá Sân Thể Thao' })).toBeVisible()
  })

  test.describe('trình duyệt tiếng Anh', () => {
    test.use({ locale: 'en-US' })

    test('tự hiện tiếng Anh theo Accept-Language', async ({ page }) => {
      await page.goto('/clubs')
      await expect(page.locator('html')).toHaveAttribute('lang', 'en')
      await expect(page.getByRole('heading', { name: 'Explore Sports Courts' })).toBeVisible()
      await expect(page.getByText('1 venues found')).toBeVisible()
    })

    test('trang chi tiết sân, đăng nhập và đăng ký đều có tiếng Anh', async ({ page }) => {
      await page.goto(`/clubs/${CLUB_ID}`)
      await expect(page.getByRole('heading', { name: 'Book a Time Slot Online' })).toBeVisible()
      await page.goto('/login')
      await expect(page.getByRole('button', { name: /^Log in/ })).toBeVisible()
      await page.goto('/register')
      await expect(page.getByText('How will you use SportArena?')).toBeVisible()
    })

    test('lỗi đăng nhập từ server cũng được dịch', async ({ page }) => {
      await page.goto('/login')
      await page.getByLabel('Email').fill('khong-ton-tai@example.com')
      await page.getByLabel('Password').fill('wrong-password')
      await page.getByRole('button', { name: /^Log in/ }).click()
      await expect(page.locator('form [role=alert]')).toContainText('Incorrect email or password')
    })
  })

  test('nút chuyển ngôn ngữ đổi sang tiếng Anh, nhớ lựa chọn và đổi lại được', async ({ page }) => {
    await page.goto('/clubs')
    await page.getByRole('button', { name: /Chuyển sang tiếng Anh/ }).click()
    await expect(page.getByRole('heading', { name: 'Explore Sports Courts' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    // Cookie giữ lựa chọn khi tải lại và khi sang trang khác
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await page.goto('/matches')
    await expect(page.getByRole('heading', { name: /Play Sports, Find Partners/ })).toBeVisible()

    await page.getByRole('button', { name: /Switch to Vietnamese/ }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'vi')
  })

  test('cookie ngôn ngữ sai bị bỏ qua', async ({ page, context }) => {
    await context.addCookies([{ name: 'sa-lang', value: 'fr', url: 'http://127.0.0.1:3100' }])
    await page.goto('/clubs')
    await expect(page.locator('html')).toHaveAttribute('lang', 'vi')
  })

  test('CSP vẫn đúng và không vi phạm khi dùng tiếng Anh', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'en-US' })
    const page = await context.newPage()
    const problems: string[] = []
    page.on('console', (msg) => {
      if (/content security policy/i.test(msg.text())) problems.push(msg.text())
    })
    page.on('pageerror', (err) => problems.push(err.message))
    for (const path of ['/', '/login', '/clubs', `/clubs/${CLUB_ID}`, '/matches']) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
    }
    expect(problems).toEqual([])
    await context.close()
  })
})
