import { expect, test } from '@playwright/test'

test.describe('Nền 3D của các trang đăng nhập / đăng ký', () => {
  test('vẽ canvas WebGL không lỗi và không chặn nhập liệu trong form', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto('/login')
    const canvas = page.locator('.auth-scene canvas')
    await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 15_000 })
    const box = (await canvas.boundingBox())!
    expect(box.width).toBeGreaterThan(300)
    expect(box.height).toBeGreaterThan(300)

    // Canvas nằm sau thẻ đăng nhập nên vẫn gõ và bấm được
    await page.getByLabel('Email').fill('chu-san@example.com')
    await expect(page.getByLabel('Email')).toHaveValue('chu-san@example.com')
    await page.getByRole('link', { name: 'Quên mật khẩu?' }).click()
    await expect(page).toHaveURL(/\/forgot-password/, { timeout: 20_000 })
    expect(errors).toEqual([])
  })

  test('trang đăng ký cũng có nền 3D', async ({ page }) => {
    await page.goto('/register')
    await expect(page.locator('.auth-scene canvas')).toHaveAttribute('data-ready', 'true', { timeout: 15_000 })
  })

  test('sân xoay, bóng nảy: hình trên canvas đổi theo thời gian', async ({ page }) => {
    await page.goto('/login')
    const canvas = page.locator('.auth-scene canvas')
    await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 15_000 })
    const a = await canvas.screenshot()
    await page.waitForTimeout(2000)
    const b = await canvas.screenshot()
    expect(Buffer.compare(a, b)).not.toBe(0)
  })

  test('giảm chuyển động thì chỉ vẽ một khung tĩnh', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/login')
    const canvas = page.locator('.auth-scene canvas')
    await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 15_000 })
    // Chờ hiệu ứng hiện dần (opacity) kết thúc rồi mới so sánh hai ảnh chụp
    await page.waitForTimeout(1800)
    const a = await canvas.screenshot()
    await page.waitForTimeout(1500)
    const b = await canvas.screenshot()
    expect(Buffer.compare(a, b)).toBe(0)
  })
})
