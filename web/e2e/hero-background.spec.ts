import { expect, test } from '@playwright/test'

test.describe('Nền hero chạy theo con trỏ', () => {
  test('di chuột sang phải/xuống dưới thì biến --mx, --my dương, đốm sáng dịch chỗ theo', async ({ page }) => {
    await page.goto('/')
    const bg = page.locator('.hero-bg')
    const hero = page.locator('section').filter({ has: bg }).first()
    const box = (await hero.boundingBox())!

    await page.mouse.move(box.x + box.width * 0.9, 650)
    await expect.poll(async () => Number(await bg.evaluate((el) => el.style.getPropertyValue('--mx') || '0'))).toBeGreaterThan(0.3)
    expect(Number(await bg.evaluate((el) => el.style.getPropertyValue('--my')))).toBeGreaterThan(0.2)
    await expect(bg).toHaveAttribute('data-active', 'true')

    // Đốm sáng thật sự bị dịch chỗ so với lúc con trỏ ở giữa
    const blob = page.locator('.hero-bg-blob-a')
    const mx = async () => Number(await bg.evaluate((el) => el.style.getPropertyValue('--mx') || '0'))
    await expect.poll(mx).toBeGreaterThan(0.75) // chờ trượt xong (đích là 0,8)
    const right = (await blob.boundingBox())!.x

    await page.mouse.move(box.x + box.width * 0.1, box.y + 40)
    await expect.poll(mx).toBeLessThan(-0.75)
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
