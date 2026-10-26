import { expect, test } from '@playwright/test'
import { CLUB_ID } from './fixtures.mjs'

const text = {
  vi: { button: 'Chi tiết', base: 'Giá cơ bản', pricing: 'Bảng giá', selected: 'Đang chọn', close: 'Đóng', policy: 'Chính sách hủy:', perHour: (p: string) => `${p} đ/giờ` },
  en: { button: 'Details', base: 'Base price', pricing: 'Prices', selected: 'Selected', close: 'Close', policy: 'Cancellation policy:', perHour: (p: string) => `${p} đ/hour` },
}

for (const lang of ['vi', 'en'] as const) {
  const t = text[lang]

  test.describe(`Chi tiết sân dạng hộp thoại (${lang})`, () => {
    test.use({ locale: lang === 'en' ? 'en-US' : 'vi-VN' })

    test('bấm "Chi tiết" mở hộp thoại có thông tin, bảng giá theo khung giờ và chính sách hủy', async ({ page }) => {
      await page.goto(`/clubs/${CLUB_ID}`)
      const open = page.getByRole('button', { name: /Sân số 1/ }).filter({ hasText: t.button })
      await open.click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await expect(dialog.getByText('Sân số 1', { exact: true })).toBeVisible()
      await expect(dialog.getByText('Sân cứng').first()).toBeVisible()

      // Tiền cọc 30% của 120.000 đ = 36.000 đ
      await expect(dialog.getByText(/30%/)).toContainText('36.000')

      // Bảng giá: giá cơ bản và một khung giá riêng áp dụng các ngày trong tuần
      await expect(dialog.getByText(t.pricing, { exact: true })).toBeVisible()
      await expect(dialog.getByText(t.base, { exact: true })).toBeVisible()
      await expect(dialog.getByText(t.perHour('120.000'))).toBeVisible()
      await expect(dialog.getByText('Giờ vàng')).toBeVisible()
      await expect(dialog.getByText(t.perHour('180.000'))).toBeVisible()
      await expect(dialog.getByText(/17:00 - 21:00/)).toBeVisible()
      await expect(dialog.getByText(t.policy)).toBeVisible()

      // Cụm sân chỉ có một sân và nó đang được chọn sẵn
      await expect(dialog.getByRole('button', { name: t.selected })).toBeDisabled()
    })

    test('đóng bằng nút Đóng hoặc phím Esc, và bấm thẻ sân vẫn chỉ là chọn sân', async ({ page }) => {
      await page.goto(`/clubs/${CLUB_ID}`)
      const card = page.getByRole('button', { name: /Sân số 1/ }).filter({ hasNotText: t.button })
      await expect(card.first()).toHaveAttribute('aria-pressed', 'true')

      await page.getByRole('button', { name: /Sân số 1/ }).filter({ hasText: t.button }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.getByRole('dialog').getByRole('button', { name: t.close, exact: true }).first().click()
      await expect(page.getByRole('dialog')).toHaveCount(0)

      await page.getByRole('button', { name: /Sân số 1/ }).filter({ hasText: t.button }).click()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)

      await card.first().click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
    })
  })
}
