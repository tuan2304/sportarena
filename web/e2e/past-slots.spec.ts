import { expect, test } from '@playwright/test'
import { CLUB_ID } from './fixtures.mjs'

// 14:30 giờ Việt Nam (UTC+7) = 07:30 UTC
const NOW = new Date('2026-10-26T07:30:00Z')

test.describe('Khung giờ đã qua bị gạch', () => {
  test('qua 14:00 thì ô 14:00 và các ô trước đó bị khóa dù chưa ai đặt, ô sau vẫn đặt được', async ({ page }) => {
    await page.clock.setFixedTime(NOW)
    await page.goto(`/clubs/${CLUB_ID}`)

    for (const hour of ['06:00', '13:00', '14:00']) {
      await expect(page.getByRole('button', { name: hour, exact: true })).toBeDisabled()
    }
    for (const hour of ['15:00', '16:00']) {
      await expect(page.getByRole('button', { name: hour, exact: true })).toBeEnabled()
    }
  })

  // Hồi quy: server dựng HTML bằng giờ thật của nó, trình duyệt có đồng hồ khác. Trước đây `disabled` của ô giờ bị kẹt
  // theo HTML của server (React không sửa thuộc tính lệch khi hydrate) nên CI chạy sau 15:00 giờ VN thì fail.
  test('đồng hồ trình duyệt khác giờ server thì ô giờ vẫn đúng theo đồng hồ trình duyệt', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-12-25T07:30:00Z')) // 14:30 giờ VN, khác hẳn ngày của server
    await page.goto(`/clubs/${CLUB_ID}`)

    for (const hour of ['06:00', '13:00', '14:00']) {
      await expect(page.getByRole('button', { name: hour, exact: true })).toBeDisabled()
    }
    for (const hour of ['15:00', '16:00']) {
      await expect(page.getByRole('button', { name: hour, exact: true })).toBeEnabled()
    }
  })

  test('ngày mai thì mọi giờ vẫn còn trống', async ({ page }) => {
    await page.clock.setFixedTime(NOW)
    await page.goto(`/clubs/${CLUB_ID}`)
    await page.getByRole('button', { name: 'Ngày mai' }).click()
    await expect(page.getByRole('button', { name: '06:00', exact: true })).toBeEnabled()
    await expect(page.getByRole('button', { name: '14:00', exact: true })).toBeEnabled()
  })
})
