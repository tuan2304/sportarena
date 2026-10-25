import { expect, test, type Page } from '@playwright/test'
import { USERS } from './fixtures.mjs'

type Who = keyof typeof USERS

/** Đăng nhập bằng form thật; Supabase giả cấp phiên cho 3 tài khoản mẫu. */
async function login(page: Page, who: Who, lang: 'vi' | 'en') {
  await page.goto('/login')
  await page.getByLabel('Email').fill(USERS[who].email)
  await page.getByLabel(lang === 'en' ? 'Password' : 'Mật khẩu').fill('mat-khau-bat-ky')
  await page.getByRole('button', { name: lang === 'en' ? /^Log in/ : /^Đăng nhập/ }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

for (const lang of ['vi', 'en'] as const) {
  test.describe(`Người chơi đã đăng nhập (${lang})`, () => {
    test.use({ locale: lang === 'en' ? 'en-US' : 'vi-VN' })

    test('đăng nhập đưa về trang chủ và hiện tên người dùng', async ({ page }) => {
      await login(page, 'player', lang)
      await expect(page).toHaveURL(/\/$/)
      await expect(page.getByText(USERS.player.name).first()).toBeVisible()
    })

    test('lịch đặt của tôi hiện đơn đã cọc đúng ngôn ngữ', async ({ page }) => {
      await login(page, 'player', lang)
      await page.goto('/my-bookings')
      await expect(page.getByRole('heading', { name: lang === 'en' ? 'Bookings & Matches' : 'Lịch Đặt Sân & Kèo Giao Lưu' })).toBeVisible()
      await expect(page.getByText('Cụm sân Kiểm Thử').first()).toBeVisible()
      await expect(page.getByText(lang === 'en' ? 'Deposit Paid' : 'Đã Cọc Khóa Sân').first()).toBeVisible()
    })

    test('chuông thông báo hiện bản dịch của thông báo', async ({ page }) => {
      await login(page, 'player', lang)
      await page.goto('/clubs')
      await page.getByRole('button', { name: lang === 'en' ? 'Notifications' : 'Thông báo' }).click()
      await expect(page.getByText(lang === 'en' ? 'Deposit paid! 🎉' : 'Thanh toán cọc thành công! 🎉')).toBeVisible()
    })

    test('trang hồ sơ có form với dữ liệu của tôi', async ({ page }) => {
      await login(page, 'player', lang)
      await page.goto('/profile')
      await expect(page.getByRole('heading', { name: lang === 'en' ? 'My profile' : 'Hồ sơ của tôi' })).toBeVisible()
      await expect(page.getByLabel(lang === 'en' ? 'Full name' : 'Họ và tên')).toHaveValue(USERS.player.name)
    })
  })
}

test.describe('Phân quyền theo vai trò', () => {
  test('người chơi không vào được khu chủ sân và quản trị', async ({ page }) => {
    await login(page, 'player', 'vi')
    for (const path of ['/owner/dashboard', '/admin']) {
      await page.goto(path)
      await expect(page).not.toHaveURL(new RegExp(path))
    }
  })

  test('chủ sân vào thẳng cổng chủ sân, không vào được quản trị', async ({ page }) => {
    await login(page, 'owner', 'vi')
    await expect(page).toHaveURL(/\/owner\/dashboard/)
    await page.goto('/admin')
    await expect(page).not.toHaveURL(/\/admin/)
  })

  test('quản trị đăng nhập xong vào thẳng /admin', async ({ page }) => {
    await login(page, 'admin', 'vi')
    await expect(page).toHaveURL(/\/admin/)
  })
})

const OWNER_PAGES = [
  ['/owner/dashboard', 'Your Dashboard'],
  ['/owner/clubs', 'Manage Venues & Courts'],
  ['/owner/schedule', 'Manage Bookings'],
  ['/owner/pricing', 'Flexible Pricing by Time Slot'],
  ['/owner/payments', 'Get Paid'],
  ['/owner/refunds', 'Refunds'],
  ['/owner/billing', 'Plans'],
] as const

const ADMIN_PAGES = [
  ['/admin', 'Operations'],
  ['/admin/tickets', 'Support (tickets)'],
  ['/admin/announcements', 'Send an announcement'],
  ['/admin/finance', 'Plans'],
] as const

test.describe('Khu chủ sân và quản trị bằng tiếng Anh', () => {
  test.use({ locale: 'en-US' })

  for (const [path, heading] of OWNER_PAGES) {
    test(`chủ sân: ${path}`, async ({ page }) => {
      const problems: string[] = []
      page.on('pageerror', (e) => problems.push(e.message))
      await login(page, 'owner', 'en')
      await page.goto(path)
      await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible()
      // Thanh bên đã dịch
      await expect(page.getByRole('link', { name: 'Overview' })).toBeVisible()
      expect(problems).toEqual([])
    })
  }

  for (const [path, heading] of ADMIN_PAGES) {
    test(`quản trị: ${path}`, async ({ page }) => {
      const problems: string[] = []
      page.on('pageerror', (e) => problems.push(e.message))
      await login(page, 'admin', 'en')
      await page.goto(path)
      await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible()
      await expect(page.getByText('Platform admin', { exact: true })).toBeVisible()
      expect(problems).toEqual([])
    })
  }
})

/** API của app dành cho chủ sân: gọi bằng Bearer token lấy từ Supabase giả, giống cách app mobile gọi. */
test.describe('API chủ sân cho app mobile', () => {
  const BOOKING_ID = '55555555-5555-4555-8555-555555555551'
  const mock = 'http://127.0.0.1:54399'

  async function tokenFor(who: Who): Promise<string> {
    const res = await fetch(`${mock}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: USERS[who].email, password: 'x12345678' }),
    })
    return (await res.json()).access_token
  }

  const headers = (token: string, lang = 'vi') => ({ Authorization: `Bearer ${token}`, 'Accept-Language': lang })

  test('không có token thì 401', async ({ request }) => {
    const res = await request.post(`/api/mobile/owner/bookings/${BOOKING_ID}/status`, { data: { status: 'confirmed' } })
    expect(res.status()).toBe(401)
  })

  test('mã đơn và trạng thái sai bị từ chối, lỗi dịch theo header', async ({ request }) => {
    const token = await tokenFor('owner')
    const badId = await request.post('/api/mobile/owner/bookings/khong-phai-uuid/status', { data: { status: 'confirmed' }, headers: headers(token, 'en') })
    expect(badId.status()).toBe(400)
    expect((await badId.json()).error).toBe('Invalid booking code')

    const badStatus = await request.post(`/api/mobile/owner/bookings/${BOOKING_ID}/status`, { data: { status: 'pending' }, headers: headers(token, 'vi') })
    expect(badStatus.status()).toBe(400)
    expect((await badStatus.json()).error).toBe('Trạng thái không hợp lệ')
  })

  test('người chơi không thao tác được đơn của cụm sân khác', async ({ request }) => {
    const token = await tokenFor('player')
    const res = await request.post(`/api/mobile/owner/bookings/${BOOKING_ID}/status`, { data: { status: 'cancelled' }, headers: headers(token, 'en') })
    expect(res.status()).toBe(400)
    expect((await res.json()).error).toBe('You are not allowed to manage this booking')

    const refund = await request.post(`/api/mobile/owner/bookings/${BOOKING_ID}/refunded`, { headers: headers(token, 'en') })
    expect(refund.status()).toBe(400)
  })

  test('chủ sân chưa thể đánh dấu hoàn tất đơn ở tương lai', async ({ request }) => {
    const token = await tokenFor('owner')
    const res = await request.post(`/api/mobile/owner/bookings/${BOOKING_ID}/status`, { data: { status: 'completed' }, headers: headers(token, 'en') })
    expect(res.status()).toBe(400)
    expect((await res.json()).error).toBe('Play time has not arrived yet, so it cannot be marked as completed')
  })
})

/** Nút Duyệt / Từ chối trên thông báo đẩy gọi API này. */
test.describe('API duyệt người xin vào kèo cho app mobile', () => {
  const PARTICIPANT_ID = '77777777-7777-4777-8777-777777777771'
  const mock = 'http://127.0.0.1:54399'

  async function ownerToken(): Promise<string> {
    const res = await fetch(`${mock}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: USERS.owner.email, password: 'x12345678' }),
    })
    return (await res.json()).access_token
  }

  test('không có token thì 401', async ({ request }) => {
    const res = await request.post(`/api/mobile/matches/participants/${PARTICIPANT_ID}/respond`, { data: { status: 'accepted' } })
    expect(res.status()).toBe(401)
  })

  test('dữ liệu sai bị từ chối và lỗi dịch theo header', async ({ request }) => {
    const headers = { Authorization: `Bearer ${await ownerToken()}`, 'Accept-Language': 'en' }
    const badId = await request.post('/api/mobile/matches/participants/khong-phai-uuid/respond', { data: { status: 'accepted' }, headers })
    expect(badId.status()).toBe(400)
    expect((await badId.json()).error).toBe('Invalid request code')

    const badStatus = await request.post(`/api/mobile/matches/participants/${PARTICIPANT_ID}/respond`, { data: { status: 'left' }, headers })
    expect(badStatus.status()).toBe(400)
    expect((await badStatus.json()).error).toBe('Invalid status')
  })

  test('yêu cầu không tồn tại thì báo không tìm thấy', async ({ request }) => {
    const headers = { Authorization: `Bearer ${await ownerToken()}`, 'Accept-Language': 'en' }
    const res = await request.post(`/api/mobile/matches/participants/${PARTICIPANT_ID}/respond`, { data: { status: 'rejected' }, headers })
    expect(res.status()).toBe(400)
    expect((await res.json()).error).toBe('Participant not found')
  })
})

test.describe('API sân và giá của chủ sân cho app mobile', () => {
  const ID = '88888888-8888-4888-8888-888888888881'
  const mock = 'http://127.0.0.1:54399'

  async function ownerToken(): Promise<string> {
    const res = await fetch(`${mock}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: USERS.owner.email, password: 'x12345678' }),
    })
    return (await res.json()).access_token
  }

  test('không có token thì 401 ở cả bốn đường dẫn', async ({ request }) => {
    expect((await request.post('/api/mobile/owner/clubs', { data: {} })).status()).toBe(401)
    expect((await request.post(`/api/mobile/owner/clubs/${ID}/courts`, { data: {} })).status()).toBe(401)
    expect((await request.post(`/api/mobile/owner/courts/${ID}/pricing-rules`, { data: {} })).status()).toBe(401)
    expect((await request.delete(`/api/mobile/owner/pricing-rules/${ID}`)).status()).toBe(401)
  })

  test('dữ liệu sai bị từ chối và lỗi dịch theo header', async ({ request }) => {
    const headers = { Authorization: `Bearer ${await ownerToken()}`, 'Accept-Language': 'en' }

    const club = await request.post('/api/mobile/owner/clubs', { data: { name: '', address: 'x' }, headers })
    expect(club.status()).toBe(400)
    expect((await club.json()).error).toBe('The venue name must be 1 to 100 characters')

    const badClubId = await request.post('/api/mobile/owner/clubs/khong-phai-uuid/courts', { data: {}, headers })
    expect(badClubId.status()).toBe(400)
    expect((await badClubId.json()).error).toBe('Invalid venue code')

    const court = await request.post(`/api/mobile/owner/clubs/${ID}/courts`, { data: { name: 'S1', sportType: 'chess', basePricePerHour: 150000, depositPercentage: 30 }, headers })
    expect(court.status()).toBe(400)
    expect((await court.json()).error).toBe('Invalid sport')

    const rule = await request.post(`/api/mobile/owner/courts/${ID}/pricing-rules`, { data: { name: 'Vàng', startTime: '21:00', endTime: '17:00', pricePerHour: 250000 }, headers })
    expect(rule.status()).toBe(400)
    expect((await rule.json()).error).toBe('The end time must be after the start time')

    const badRuleId = await request.delete('/api/mobile/owner/pricing-rules/khong-phai-uuid', { headers })
    expect(badRuleId.status()).toBe(400)
    expect((await badRuleId.json()).error).toBe('Invalid price slot code')
  })

  test('sửa, xóa sân con, vị trí và ảnh: không token thì 401, dữ liệu sai bị từ chối', async ({ request }) => {
    expect((await request.patch(`/api/mobile/owner/courts/${ID}`, { data: { name: 'x' } })).status()).toBe(401)
    expect((await request.delete(`/api/mobile/owner/courts/${ID}`)).status()).toBe(401)
    expect((await request.delete(`/api/mobile/owner/clubs/${ID}`)).status()).toBe(401)
    expect((await request.put(`/api/mobile/owner/clubs/${ID}/location`, { data: { latitude: null, longitude: null } })).status()).toBe(401)
    expect((await request.put(`/api/mobile/owner/clubs/${ID}/images`, { data: { images: [] } })).status()).toBe(401)
    expect((await request.patch(`/api/mobile/owner/pricing-rules/${ID}`, { data: {} })).status()).toBe(401)

    const headers = { Authorization: `Bearer ${await ownerToken()}`, 'Accept-Language': 'en' }
    const error = async (res: Awaited<ReturnType<typeof request.get>>) => {
      expect(res.status()).toBe(400)
      return (await res.json()).error as string
    }

    expect(await error(await request.patch(`/api/mobile/owner/courts/${ID}`, { data: {}, headers }))).toBe('There is nothing to update')
    expect(await error(await request.patch(`/api/mobile/owner/courts/${ID}`, { data: { depositPercentage: 500 }, headers }))).toBe('The deposit percentage must be between 1 and 100')
    expect(await error(await request.delete('/api/mobile/owner/courts/khong-phai-uuid', { headers }))).toBe('Invalid court code')
    expect(await error(await request.delete('/api/mobile/owner/clubs/khong-phai-uuid', { headers }))).toBe('Invalid venue code')
    expect(await error(await request.put(`/api/mobile/owner/clubs/${ID}/location`, { data: { latitude: 10 }, headers }))).toBe('The location coordinates are not valid')
    expect(await error(await request.put(`/api/mobile/owner/clubs/${ID}/images`, { data: { images: 'x' }, headers }))).toBe('Invalid image list')
    expect(await error(await request.patch(`/api/mobile/owner/pricing-rules/${ID}`, { data: { name: 'a', startTime: '21:00', endTime: '17:00', pricePerHour: 250000 }, headers }))).toBe(
      'The end time must be after the start time'
    )
  })
})
