import { expect, test, type Page } from '@playwright/test'
import { USERS } from './fixtures.mjs'

async function login(page: Page, who: keyof typeof USERS) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(USERS[who].email)
  await page.getByLabel('Mật khẩu').fill('mat-khau-bat-ky')
  await page.getByRole('button', { name: /^Đăng nhập/ }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

test.describe('Trang pháp lý công khai (không cần đăng nhập)', () => {
  test('chính sách quyền riêng tư và hướng dẫn xóa tài khoản xem được', async ({ page }) => {
    const privacy = await page.goto('/privacy')
    expect(privacy?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Chính sách quyền riêng tư', level: 1 })).toBeVisible()
    await expect(page.getByText('Quyền của bạn')).toBeVisible()

    const del = await page.goto('/delete-account')
    expect(del?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Xóa tài khoản và dữ liệu', level: 1 })).toBeVisible()
    await expect(page.getByText('Dữ liệu được giữ lại')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Đăng nhập để xóa tài khoản' })).toBeVisible()
  })

  test('bản tiếng Anh', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'en-US' })
    const page = await context.newPage()
    await page.goto('/delete-account')
    await expect(page.getByRole('heading', { name: 'Delete your account and data', level: 1 })).toBeVisible()
    await context.close()
  })

  test('chân trang chủ có liên kết tới hai trang này', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Chính sách quyền riêng tư' }).click()
    await expect(page).toHaveURL(/\/privacy$/)
    await page.goto('/')
    await page.getByRole('link', { name: 'Xóa tài khoản' }).click()
    await expect(page).toHaveURL(/\/delete-account$/)
  })
})

test.describe('Xóa tài khoản và xuất dữ liệu (người chơi)', () => {
  test('hộp thoại xóa đòi mật khẩu và câu xác nhận, và hiện lý do khi còn đơn sắp tới', async ({ page }) => {
    await login(page, 'player')
    await page.goto('/profile')

    await page.getByRole('button', { name: 'Xóa tài khoản' }).click()
    const dialog = page.getByRole('dialog')
    const confirm = dialog.getByRole('button', { name: 'Xóa vĩnh viễn' })
    await expect(confirm).toBeDisabled()

    await dialog.getByLabel('Mật khẩu hiện tại').fill('mat-khau-bat-ky')
    await expect(confirm).toBeDisabled() // còn thiếu câu xác nhận
    await dialog.getByLabel('Gõ XÓA để xác nhận').fill('XÓA')
    await expect(confirm).toBeEnabled()

    await confirm.click()
    // Supabase giả báo người này còn đơn sắp tới: tài khoản không bị xóa, lý do hiện trong hộp thoại
    await expect(dialog.getByRole('alert')).toContainText('đơn đặt sân sắp tới')
    await expect(page).toHaveURL(/\/profile$/)
  })

  test('đóng hộp thoại thì xóa sạch mật khẩu đã gõ', async ({ page }) => {
    await login(page, 'player')
    await page.goto('/profile')
    await page.getByRole('button', { name: 'Xóa tài khoản' }).click()
    await page.getByRole('dialog').getByLabel('Mật khẩu hiện tại').fill('bi-mat')
    await page.getByRole('dialog').getByRole('button', { name: 'Hủy' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    await page.getByRole('button', { name: 'Xóa tài khoản' }).click()
    await expect(page.getByRole('dialog').getByLabel('Mật khẩu hiện tại')).toHaveValue('')
  })

  test('tải dữ liệu cá nhân về dạng tệp JSON', async ({ page }) => {
    await login(page, 'player')
    await page.goto('/profile')
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Tải về' }).click()])
    expect(download.suggestedFilename()).toMatch(/^sportarena-du-lieu-\d{4}-\d{2}-\d{2}\.json$/)

    const path = await download.path()
    const { readFileSync } = await import('node:fs')
    const data = JSON.parse(readFileSync(path, 'utf8'))
    expect(data.account.email).toBe(USERS.player.email)
    expect(data.profile.full_name).toBe('Người dùng thử')
  })

  test('khách chưa đăng nhập không tải được dữ liệu', async ({ request }) => {
    const res = await request.get('/api/account/export')
    expect(res.status()).toBe(401)
    expect(res.headers()['content-disposition']).toBeUndefined()
  })
})

test.describe('Đối soát thanh toán (quản trị)', () => {
  test('người chơi không vào được trang đối soát', async ({ page }) => {
    await login(page, 'player')
    await page.goto('/admin/payments')
    await expect(page).not.toHaveURL(/\/admin/)
  })

  test('hiện khoản cần hoàn tiền và đơn kẹt, kèm số đếm ở thanh bên', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/admin/payments')
    await expect(page.getByRole('heading', { name: 'Đối soát thanh toán', level: 1 })).toBeVisible()

    await expect(page.getByText('Cần hoàn tiền cho khách (1)')).toBeVisible()
    await expect(page.getByText('#7001')).toBeVisible()
    await expect(page.getByText('Khách: Khách Cần Hoàn')).toBeVisible()

    await expect(page.getByText('Đã trả cọc nhưng đơn chưa xác nhận (1)')).toBeVisible()
    await expect(page.getByText('#7002')).toBeVisible()

    // 1 khoản cần hoàn + 1 đơn kẹt; khoản cần hoàn không được đếm lại ở nhóm đơn kẹt
    await expect(page.getByRole('link', { name: /Đối soát thanh toán/ })).toHaveAccessibleName(/2 khoản cần xử lý/)
  })

  test('đóng khoản hoàn tiền: hỏi xác nhận rồi báo thành công', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/admin/payments')

    await page.getByPlaceholder('Ghi chú (vd. mã chuyển khoản)').fill('CK 123456')
    await page.getByRole('button', { name: 'Đã hoàn tiền' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Khách Cần Hoàn')
    await dialog.getByRole('button', { name: 'Đã hoàn tiền' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Đã đóng khoản hoàn tiền' })).toBeVisible()
  })

  test('xác nhận lại đơn kẹt', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/admin/payments')

    await page.getByRole('button', { name: 'Xác nhận đơn' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận đơn' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Đã xác nhận đơn' })).toBeVisible()
  })
})

test.describe('Báo lỗi từ trình duyệt và app', () => {
  test('endpoint nhận báo cáo luôn trả 204, kể cả khi báo cáo sai dạng', async ({ request }) => {
    const ok = await request.post('/api/monitoring/client-error', { data: { source: 'web', message: 'Boom', path: '/profile?x=1' } })
    expect(ok.status()).toBe(204)
    const bad = await request.post('/api/monitoring/client-error', { data: 'khong phai json', headers: { 'content-type': 'text/plain' } })
    expect(bad.status()).toBe(204)
    const wrong = await request.post('/api/monitoring/client-error', { data: { source: 'bot', message: 'x' } })
    expect(wrong.status()).toBe(204)
  })
})
