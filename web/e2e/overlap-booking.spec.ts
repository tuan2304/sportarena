import { expect, test, type Page } from '@playwright/test'
import { CLUB_ID } from './fixtures.mjs'

// Khách 1 đã đặt sân 14:00-15:00 ngày 15/03/2027 (xem get_busy_slots trong mock-supabase). Khách 2 muốn 13:00 trong 3 tiếng.
const text = {
  vi: { hours: (n: string) => `${n} tiếng`, booked: '14:00, đã kín' },
  en: { hours: (n: string) => `${n} h`, booked: '14:00, booked' },
}

async function openDay(page: Page) {
  await page.clock.setFixedTime(new Date('2027-03-14T17:00:00Z')) // 00:00 ngày 15/03 giờ VN, mọi ô giờ trong ngày còn ở tương lai
  await page.goto(`/clubs/${CLUB_ID}`)
}

for (const lang of ['vi', 'en'] as const) {
  const t = text[lang]

  test.describe(`Đặt chồng giờ với khách đã đặt trước (${lang})`, () => {
    test.use({ locale: lang === 'en' ? 'en-US' : 'vi-VN' })

    test('khách 2 chọn 13:00: chỉ còn 1 tiếng, 1.5/2/2.5/3 tiếng bị khóa vì đè lên đơn 14:00 của khách 1', async ({ page }) => {
      await openDay(page)
      await page.getByRole('button', { name: '13:00', exact: true }).click()

      await expect(page.getByRole('button', { name: t.hours('1'), exact: true })).toBeEnabled()
      for (const n of ['1.5', '2', '2.5', '3']) {
        await expect(page.getByRole('button', { name: t.hours(n), exact: true })).toBeDisabled()
      }
    })

    test('ô 14:00 của khách 1 hiện là đã kín và không bấm được', async ({ page }) => {
      await openDay(page)
      const taken = page.getByRole('button', { name: t.booked, exact: true })
      await expect(taken).toBeDisabled()
      await expect(page.getByRole('button', { name: '13:00', exact: true })).toBeEnabled()
      await expect(page.getByRole('button', { name: '15:00', exact: true })).toBeEnabled()
    })

    test('dời sang 15:00 thì đặt được đủ 3 tiếng', async ({ page }) => {
      await openDay(page)
      await page.getByRole('button', { name: '15:00', exact: true }).click()
      await expect(page.getByRole('button', { name: t.hours('3'), exact: true })).toBeEnabled()
    })
  })
}
