import { expect, test } from '@playwright/test'

test.describe('Nền hero chạy theo con trỏ', () => {
  test('di chuột sang phải/xuống dưới thì biến --mx, --my dương, đốm sáng dịch chỗ theo', async ({ page }) => {
    await page.goto('/')
    const bg = page.locator('.hero-bg')
    const hero = page.locator('section').filter({ has: bg }).first()
    const box = (await hero.boundingBox())!

    await page.mouse.move(box.x + box.width * 0.9, 650)
    await expect.poll(async () => Number(await bg.evaluate((el) => el.style.getPropertyValue('--mx') || '0')), { timeout: 20_000 }).toBeGreaterThan(0.3)
    expect(Number(await bg.evaluate((el) => el.style.getPropertyValue('--my')))).toBeGreaterThan(0.2)
    await expect(bg).toHaveAttribute('data-active', 'true')

    // Đốm sáng thật sự bị dịch chỗ so với lúc con trỏ ở giữa
    const blob = page.locator('.hero-bg-blob-a')
    const mx = async () => Number(await bg.evaluate((el) => el.style.getPropertyValue('--mx') || '0'))
    await expect.poll(mx, { timeout: 20_000 }).toBeGreaterThan(0.75) // chờ trượt xong (đích là 0,8)
    const right = (await blob.boundingBox())!.x

    await page.mouse.move(box.x + box.width * 0.1, box.y + 40)
    await expect.poll(mx, { timeout: 20_000 }).toBeLessThan(-0.75)
    expect((await blob.boundingBox())!.x).toBeLessThan(right - 100)
  })

  test('người dùng giảm chuyển động thì nền đứng yên', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    const bg = page.locator('.hero-bg')
    const box = (await page.locator('section').filter({ has: bg }).first().boundingBox())!
    await page.mouse.move(box.x + box.width * 0.9, 650)
    await page.waitForTimeout(400)
    await expect(bg).toHaveAttribute('data-active', 'false')
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

  test('giảm chuyển động thì chỉ vẽ một khung tĩnh', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await expect(page.locator('.hero-scene canvas')).toHaveAttribute('data-ready', 'true', { timeout: 15_000 })
  })
})
