import { expect, test } from '@playwright/test'
import { CLUB_ID } from './fixtures.mjs'

const text = {
  vi: { courts: 'Các sân con (1)', book: 'Xem lịch & đặt sân', close: 'Đóng', perHour: '120.000 đ/giờ' },
  en: { courts: 'Courts (1)', book: 'View schedule & book', close: 'Close', perHour: '120.000 VND/hour' },
}

for (const lang of ['vi', 'en'] as const) {
  const t = text[lang]

  test.describe(`Overlay chi tiết cụm sân ở danh sách (${lang})`, () => {
    test.use({ locale: lang === 'en' ? 'en-US' : 'vi-VN' })

    test('bấm vào thẻ cụm sân mở overlay có địa chỉ, giờ mở cửa, sân con và nút đặt sân', async ({ page }) => {
      await page.goto('/clubs')
      await page.getByRole('heading', { name: 'Cụm sân Kiểm Thử' }).click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('heading', { name: 'Cụm sân Kiểm Thử' })).toBeVisible()
      await expect(dialog.getByRole('heading', { name: t.courts })).toBeVisible()
      await expect(dialog.getByText('Sân số 1')).toBeVisible()
      await expect(dialog.getByText(t.perHour)).toBeVisible()
      await expect(dialog.getByRole('link', { name: t.book })).toHaveAttribute('href', `/clubs/${CLUB_ID}`)
    })

    test('đóng được bằng nút Đóng và phím Esc, không bị mở lại', async ({ page }) => {
      await page.goto('/clubs')
      await page.getByRole('heading', { name: 'Cụm sân Kiểm Thử' }).click()
      await page.getByRole('dialog').getByRole('button', { name: t.close, exact: true }).first().click()
      await expect(page.getByRole('dialog')).toHaveCount(0)

      await page.getByRole('heading', { name: 'Cụm sân Kiểm Thử' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)
    })

    test('bấm nút đặt sân trong thẻ vẫn đi thẳng tới trang cụm sân, không mở overlay', async ({ page }) => {
      await page.goto('/clubs')
      await page.getByRole('link', { name: /Đặt Sân Ngay|Book Now/ }).first().click()
      await expect(page).toHaveURL(new RegExp(`/clubs/${CLUB_ID}`))
    })
  })
}
