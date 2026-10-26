import { expect, test } from '@playwright/test'

test.describe('Nền hero tự chuyển động khi mở trang', () => {
  test('không cần di chuột: biến --mx/--my tự đổi theo thời gian và đốm sáng dịch chỗ', async ({ page }) => {
    await page.goto('/')
    const bg = page.locator('.hero-bg')
    const mx = async () => Number(await bg.evaluate((el) => el.style.getPropertyValue('--mx') || '0'))
    const blob = page.locator('.hero-bg-blob-a')

    await expect.poll(async () => (await bg.evaluate((el) => el.style.getPropertyValue('--mx'))) !== '', { timeout: 20_000 }).toBe(true)
    const first = await mx()
    const firstX = (await blob.boundingBox())!.x
    // Chu kỳ ~18 giây nên sau vài giây giá trị phải khác rõ rệt
    await expect.poll(async () => Math.abs((await mx()) - first), { timeout: 20_000 }).toBeGreaterThan(0.15)
    expect(Math.abs((await blob.boundingBox())!.x - firstX)).toBeGreaterThan(10)
  })

  test('người dùng giảm chuyển động thì nền đứng yên', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    const bg = page.locator('.hero-bg')
    await page.waitForTimeout(1500)
    expect(await bg.evaluate((el) => el.style.getPropertyValue('--mx'))).toBe('')
  })
})

test.describe('Cảnh 3D các quả bóng ở hero', () => {
  test('vẽ canvas WebGL không lỗi và không chặn bấm vào nút bên trên', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto('/')
    const canvas = page.locator('.hero-scene canvas')
    await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 15_000 })
    const box = (await canvas.boundingBox())!
    expect(box.width).toBeGreaterThan(300)
    expect(box.height).toBeGreaterThan(300)

    // Canvas nằm sau nội dung nên nút CTA vẫn bấm được
    await page.getByRole('link', { name: /Khám phá sân thể thao/ }).click()
    await expect(page).toHaveURL(/\/clubs/)
    expect(errors).toEqual([])
  })

  test('các quả bóng tự nảy qua lại: hình trên canvas đổi theo thời gian, không cần chuột', async ({ page }) => {
    await page.goto('/')
    const canvas = page.locator('.hero-scene canvas')
    await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 15_000 })
    // Nếu bóng đứng yên thì hai ảnh chụp canvas giống hệt nhau
    const a = await canvas.screenshot()
    await page.waitForTimeout(2500)
    const b = await canvas.screenshot()
    expect(Buffer.compare(a, b)).not.toBe(0)
  })

  test('các quả bóng va vào nhau và bật ra (đếm va chạm tăng dần, không đi xuyên qua)', async ({ page }) => {
    test.setTimeout(90_000)
    await page.goto('/')
    const canvas = page.locator('.hero-scene canvas')
    await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 15_000 })
    await expect
      .poll(async () => Number(await canvas.getAttribute('data-hits')), { timeout: 60_000, intervals: [1000] })
      .toBeGreaterThan(0)
  })

  test('giảm chuyển động thì chỉ vẽ một khung tĩnh', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    const canvas = page.locator('.hero-scene canvas')
    await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 15_000 })
    const a = await canvas.screenshot()
    await page.waitForTimeout(1500)
    const b = await canvas.screenshot()
    expect(Buffer.compare(a, b)).toBe(0)
  })
})
