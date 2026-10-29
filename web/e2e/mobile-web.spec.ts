import { expect, test, type Page } from '@playwright/test'
import { CLUB_ID } from './fixtures.mjs'
import { USERS } from './fixtures.mjs'

// Khách dùng web trên điện thoại (không cài app): thanh điều hướng dưới, đầu trang gọn, thanh đặt chỗ cố định
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

async function login(page: Page, who: keyof typeof USERS) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(USERS[who].email)
  await page.getByLabel('Mật khẩu').fill('mat-khau-bat-ky')
  await page.getByRole('button', { name: /^Đăng nhập/ }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

const tabBar = (page: Page) => page.getByTestId('mobile-tab-bar')

test.describe('Thanh điều hướng dưới trên điện thoại', () => {
  test('khách chưa đăng nhập thấy Khám phá, Kèo, Đăng nhập', async ({ page }) => {
    await page.goto('/clubs')
    const bar = tabBar(page)
    await expect(bar).toBeVisible()
    await expect(bar.getByRole('link')).toHaveText(['Khám phá', 'Kèo', 'Đăng nhập'])
    await expect(bar.getByRole('link', { name: 'Khám phá' })).toHaveAttribute('aria-current', 'page')
  })

  test('người chơi có thêm Lịch đặt và Cá nhân; tab đang mở được đánh dấu', async ({ page }) => {
    await login(page, 'player')
    await page.goto('/matches')
    const bar = tabBar(page)
    await expect(bar.getByRole('link')).toHaveText(['Khám phá', 'Kèo', 'Lịch đặt', 'Cá nhân'])
    await expect(bar.getByRole('link', { name: 'Kèo' })).toHaveAttribute('aria-current', 'page')
    await bar.getByRole('link', { name: 'Cá nhân' }).click()
    await expect(page).toHaveURL(/\/profile$/)
    await expect(tabBar(page).getByRole('link', { name: 'Cá nhân' })).toHaveAttribute('aria-current', 'page')
  })

  test('chủ sân có tab Chủ sân; thanh dưới ẩn trong khu chủ sân và màn hình đăng nhập', async ({ page }) => {
    await login(page, 'owner')
    await page.goto('/clubs')
    await expect(tabBar(page).getByRole('link', { name: 'Chủ sân' })).toBeVisible()
    await page.goto('/owner/dashboard')
    await expect(tabBar(page)).toHaveCount(0)
    await page.context().clearCookies()
    await page.goto('/login')
    await expect(tabBar(page)).toHaveCount(0)
  })

  test('thanh dưới nằm sát đáy màn hình và nội dung cuối trang không bị che', async ({ page }) => {
    await page.goto('/clubs')
    const box = await tabBar(page).boundingBox()
    expect(box).not.toBeNull()
    expect(Math.round(box!.y + box!.height)).toBe(844)
    expect(box!.height).toBeGreaterThanOrEqual(56)

    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }))
    const lastBottom = await page.evaluate(() => {
      const main = document.querySelector('main')!
      return main.getBoundingClientRect().bottom
    })
    expect(lastBottom).toBeLessThanOrEqual(box!.y + 1)
  })

  test('màn hình rộng không có thanh dưới', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, baseURL: 'http://127.0.0.1:3100' })
    const page = await ctx.newPage()
    await page.goto('/clubs')
    await expect(tabBar(page)).toBeHidden()
    await ctx.close()
  })
})

test.describe('Đầu trang và bố cục trên điện thoại', () => {
  test.setTimeout(60_000)
  for (const path of ['/', '/clubs', '/matches', `/clubs/${CLUB_ID}`]) {
    test(`${path}: không tràn ngang và các nút đầu trang nằm trọn trong màn hình`, async ({ page }) => {
      await login(page, 'player')
      await page.goto(path)
      await expect(page.locator('header').first()).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow).toBeLessThanOrEqual(0)
      for (const button of await page.locator('header button, header a').all()) {
        if (!(await button.isVisible())) continue
        const box = await button.boundingBox()
        expect(box!.x + box!.width).toBeLessThanOrEqual(390)
      }
    })
  }

  test('hồ sơ có lối tới Hỗ trợ và Đăng xuất (đầu trang không còn chỗ cho nút đăng xuất)', async ({ page }) => {
    await login(page, 'player')
    await page.goto('/profile')
    await expect(page.locator('header').getByRole('button', { name: 'Đăng xuất' })).toBeHidden()
    await expect(page.getByRole('link', { name: /Hỗ trợ/ }).last()).toBeVisible()
    await page.getByRole('button', { name: /Đăng xuất/ }).last().click()
    await expect(page).toHaveURL(/\/($|login)/)
  })

  test('cỡ chữ ô nhập đủ 16px để iOS không tự phóng to trang', async ({ page }) => {
    await page.goto('/login')
    const size = await page.getByLabel('Email').evaluate((el) => getComputedStyle(el).fontSize)
    expect(parseFloat(size)).toBeGreaterThanOrEqual(16)
  })
})

test.describe('Đặt sân trên điện thoại', () => {
  test('nút "Chọn giờ & đặt sân" nhảy tới bước chọn giờ', async ({ page }) => {
    await page.goto(`/clubs/${CLUB_ID}`)
    await page.getByRole('link', { name: 'Chọn giờ & đặt sân' }).click()
    await expect(page.getByRole('heading', { name: /Chọn Giờ Đặt Sân/ })).toBeInViewport()
  })

  test('chọn giờ thì hiện thanh cố định có tiền cọc và nút Giữ chỗ, nằm trên thanh điều hướng dưới', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-26T01:00:00Z')) // 08:00 giờ VN: còn nhiều giờ trống
    await page.goto(`/clubs/${CLUB_ID}`)
    const bar = page.getByTestId('sticky-book-bar')
    await expect(bar).toHaveCount(0)

    await page.getByRole('button', { name: '19:00', exact: true }).click()
    await expect(bar).toBeVisible()
    await expect(bar).toContainText('Cọc')
    const hold = bar.getByRole('button', { name: 'Giữ chỗ' })
    await expect(hold).toBeInViewport()

    const [barBox, tabBox] = [await bar.boundingBox(), await tabBar(page).boundingBox()]
    expect(barBox!.y + barBox!.height).toBeLessThanOrEqual(tabBox!.y + 1)
    expect((await hold.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  })
})

test.describe('Thêm vào màn hình chính (không bắt buộc)', () => {
  test('có manifest và viewport phủ kín màn hình', async ({ page, request }) => {
    const res = await request.get('/manifest.webmanifest')
    expect(res.ok()).toBe(true)
    const manifest = await res.json()
    expect(manifest.display).toBe('standalone')
    expect(manifest.icons.length).toBeGreaterThan(0)

    await page.goto('/')
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/)
  })
})

test.describe('Khu chủ sân và quản trị trên điện thoại', () => {
  test.setTimeout(90_000)

  // Giả lập di động tự nới viewport theo nội dung, nên so với bề rộng khai báo (390) thay vì innerWidth
  const widthOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - 390)

  for (const [who, paths] of [
    ['owner', ['/owner/dashboard', '/owner/clubs', '/owner/schedule', '/owner/pricing', '/owner/payments', '/owner/analytics']],
    ['admin', ['/admin', '/admin/payments', '/admin/finance', '/admin/announcements']],
  ] as const) {
    for (const path of paths) {
      test(`${who} ${path}: thanh bên ẩn, không tràn ngang`, async ({ page }) => {
        await login(page, who)
        await page.goto(path)
        await expect(page.locator('aside')).toBeHidden()
        expect(await widthOverflow(page)).toBeLessThanOrEqual(0)
      })
    }
  }

  test('nút menu mở ngăn kéo, bấm mục thì chuyển trang và ngăn kéo tự đóng', async ({ page }) => {
    await login(page, 'owner')
    await page.goto('/owner/dashboard')
    await page.getByRole('button', { name: 'Mở menu' }).tap()
    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()
    await drawer.getByRole('link', { name: /Cụm sân/ }).tap()
    await expect(page).toHaveURL(/\/owner\/clubs$/)
    await expect(drawer).toBeHidden()
  })

  test('màn hình rộng giữ thanh bên cố định, không có nút menu', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, baseURL: 'http://127.0.0.1:3100' })
    const page = await ctx.newPage()
    await login(page, 'owner')
    await page.goto('/owner/dashboard')
    await expect(page.locator('aside')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mở menu' })).toBeHidden()
    await ctx.close()
  })
})
