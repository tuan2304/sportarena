import { expect, test } from '@playwright/test'

// Dữ liệu ở mock-supabase.mjs: kèo sắp diễn ra (5-6 giờ nữa), đang chơi (±30 phút), đã qua giờ (2-3 giờ trước).
const IDS = {
  upcoming: '77777777-7777-4777-8777-777777777771',
  live: '77777777-7777-4777-8777-777777777772',
  ended: '77777777-7777-4777-8777-777777777773',
}

const text = {
  vi: { live: 'Đang diễn ra', ended: 'Đã kết thúc', endedButton: 'Kèo Đã Kết Thúc, Không Còn Nhận Người', loginToJoin: 'Đăng Nhập Để Tham Gia' },
  en: { live: 'In progress', ended: 'Ended', endedButton: 'Match Ended, No Longer Accepting Players', loginToJoin: 'Log In to Join' },
}

for (const lang of ['vi', 'en'] as const) {
  const t = text[lang]

  test.describe(`Kèo ghép theo khung giờ (${lang})`, () => {
    test.use({ locale: lang === 'en' ? 'en-US' : 'vi-VN' })

    test('danh sách kèo chỉ hiện kèo chưa kết thúc, kèo đang chơi có nhãn, kèo đã qua giờ biến mất', async ({ page }) => {
      await page.goto('/matches')
      await expect(page.getByRole('heading', { name: 'Kèo Sắp Diễn Ra' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Kèo Đang Chơi' })).toBeVisible()
      await expect(page.getByText('Kèo Đã Qua Giờ')).toHaveCount(0)

      // Chỉ kèo đang diễn ra mới có nhãn
      await expect(page.getByText(t.live, { exact: true })).toHaveCount(1)
      // Mỗi card hiện giờ bắt đầu - kết thúc
      await expect(page.locator('main').getByText(/\d{2}:\d{2} - \d{2}:\d{2}/).first()).toBeVisible()
    })

    test('kèo chưa tới giờ: còn nhận người, có nút tham gia', async ({ page }) => {
      await page.goto(`/matches/${IDS.upcoming}`)
      await expect(page.getByText('Kèo Sắp Diễn Ra').first()).toBeVisible()
      await expect(page.getByText(t.ended, { exact: true })).toHaveCount(0)
      await expect(page.getByRole('link', { name: t.loginToJoin })).toBeVisible()
    })

    test('kèo đang diễn ra: hiện nhãn "đang diễn ra" ở khung giờ', async ({ page }) => {
      await page.goto(`/matches/${IDS.live}`)
      await expect(page.getByText(t.live, { exact: true })).toBeVisible()
    })

    test('kèo đã qua giờ: báo đã kết thúc, nút tham gia bị khóa và không còn lối xin tham gia', async ({ page }) => {
      await page.goto(`/matches/${IDS.ended}`)
      await expect(page.getByText(t.ended, { exact: true }).first()).toBeVisible()
      await expect(page.getByRole('button', { name: t.endedButton })).toBeDisabled()
      await expect(page.getByRole('link', { name: t.loginToJoin })).toHaveCount(0)
    })
  })
}

test('kèo đang mở trang bị qua giờ kết thúc thì tự khóa nút tham gia (không cần tải lại)', async ({ page }) => {
  // Giờ trình duyệt sau giờ kết thúc của kèo "đang chơi": trang vẫn dựng bằng giờ server, rồi đồng hồ trình duyệt kéo sang "đã kết thúc"
  await page.clock.setFixedTime(new Date(Date.now() + 3 * 3_600_000))
  await page.goto(`/matches/${IDS.live}`)
  await expect(page.getByRole('button', { name: text.vi.endedButton })).toBeDisabled({ timeout: 15_000 })
})
