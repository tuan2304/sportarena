import { expect, test, type Page } from '@playwright/test'
import { CLUB_ID } from './fixtures.mjs'

/** Ghi lại mọi vi phạm CSP và lỗi trang trong lúc duyệt, để kiểm thử fail nếu CSP chặn nhầm thứ gì cần dùng. */
function watchViolations(page: Page) {
  const problems: string[] = []
  page.on('console', (msg) => {
    if (/content security policy/i.test(msg.text())) problems.push(`console: ${msg.text()}`)
  })
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))
  return problems
}

const PUBLIC_PAGES = ['/', '/login', '/register', '/clubs', `/clubs/${CLUB_ID}`, '/matches']

test.describe('Content-Security-Policy có nonce', () => {
  test('mỗi request có nonce riêng, khớp giữa header và thẻ script', async ({ request }) => {
    const first = await request.get('/login')
    const second = await request.get('/login')

    const nonceOf = (csp: string | undefined) => /'nonce-([^']+)'/.exec(csp ?? '')?.[1]
    const a = nonceOf(first.headers()['content-security-policy'])
    const b = nonceOf(second.headers()['content-security-policy'])
    expect(a, 'thiếu nonce trong CSP').toBeTruthy()
    expect(a).not.toBe(b)

    const html = await first.text()
    expect(html).toContain(`nonce="${a}"`)
    expect(html).not.toContain(`nonce="${b}"`)
  })

  test('script-src không cho phép unsafe-inline và có các chỉ thị chống nhúng khung', async ({ request }) => {
    const csp = (await request.get('/')).headers()['content-security-policy']
    expect(csp).toBeTruthy()
    const script = csp.split('; ').find((d) => d.startsWith('script-src')) ?? ''
    expect(script).not.toContain('unsafe-inline')
    expect(script).not.toContain('unsafe-eval')
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
  })

  test('mọi trang công khai chạy được dưới CSP: không vi phạm, không lỗi trang', async ({ page }) => {
    const problems = watchViolations(page)
    for (const path of PUBLIC_PAGES) {
      const response = await page.goto(path)
      expect(response?.status(), path).toBeLessThan(400)
      await page.waitForLoadState('networkidle')
    }
    expect(problems).toEqual([])
  })

  test('script có nonce chạy, còn mã nội tuyến do kẻ tấn công chèn vào thì bị chặn', async ({ page }) => {
    const violations: string[] = []
    page.on('console', (msg) => {
      if (/content security policy/i.test(msg.text())) violations.push(msg.text())
    })
    await page.addInitScript(() => localStorage.setItem('sa-theme', 'dark'))
    await page.goto('/login')

    // Script khởi tạo giao diện (có nonce) đã chạy trước khi vẽ
    await expect(page.locator('html')).toHaveClass(/dark/)

    // XSS điển hình: HTML chèn vào trang kèm trình xử lý sự kiện nội tuyến
    await page.evaluate(() => {
      document.body.insertAdjacentHTML('beforeend', '<img src="x:" onerror="window.__injected = true">')
    })
    await expect.poll(() => violations.length).toBeGreaterThan(0)
    expect(await page.evaluate(() => (window as unknown as { __injected?: boolean }).__injected)).toBeUndefined()
  })
})

test.describe('Header bảo mật khác', () => {
  test('có chống nhúng khung và chống đoán MIME', async ({ request }) => {
    const headers = (await request.get('/')).headers()
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['x-powered-by']).toBeUndefined()
  })
})
