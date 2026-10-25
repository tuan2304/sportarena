import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { ANON_KEY, createUser, PASSWORD, rest, SUPABASE_URL, TINY_PNG, vnSlot, type TestUser } from './helpers'

/**
 * Luồng ghi dữ liệu đầu-cuối trên Supabase thật (migration, RLS, trigger, ràng buộc chống trùng lịch đều thật):
 * chủ sân dựng cụm sân → khách đặt → chủ sân xác nhận/hủy/hoàn cọc → kèo ghép → ảnh. Đi qua API mobile vì đó là
 * cửa ghi duy nhất ngoài Server Action, và dùng cùng logic (lib/*) với web. Các ca chạy tuần tự, dùng chung dữ liệu.
 */
test.describe.configure({ mode: 'serial' })

const headers = (user: TestUser, lang = 'en') => ({ Authorization: `Bearer ${user.token}`, 'Accept-Language': lang })

/** Các trường API có thể trả về; mỗi ca chỉ đọc những trường nó mong đợi. */
interface ApiBody {
  error: string
  clubId: string
  courtId: string
  bookingId: string
  refundAmount: number
}

let owner: TestUser
let owner2: TestUser
let player: TestUser
let player2: TestUser
let clubId: string
let courtId: string
let ruleId: string

async function call(request: APIRequestContext, user: TestUser, method: 'post' | 'patch' | 'put' | 'delete', path: string, data?: unknown) {
  const res = await request[method](path, { headers: headers(user), ...(data === undefined ? {} : { data }) })
  return { status: res.status(), body: (await res.json()) as ApiBody }
}

test.beforeAll(async () => {
  ;[owner, owner2, player, player2] = await Promise.all([
    createUser('owner', 'owner', 'Chu San Mot'),
    createUser('owner2', 'owner', 'Chu San Hai'),
    createUser('player', 'player', 'Nguoi Choi Mot'),
    createUser('player2', 'player', 'Nguoi Choi Hai'),
  ])
})

test('khách thường không tạo được cụm sân, chủ sân dựng được cụm sân, sân con và khung giá', async ({ request }) => {
  const denied = await call(request, player, 'post', '/api/mobile/owner/clubs', { name: 'Lậu', address: '1 Phố' })
  expect(denied.status).toBe(400)
  expect(denied.body.error).toBe('Only owner accounts can create venues')

  const club = await call(request, owner, 'post', '/api/mobile/owner/clubs', { name: 'Cụm Sân E2E', address: '12 Nguyễn Văn Linh', district: 'Quận 7' })
  expect(club.status).toBe(201)
  clubId = club.body.clubId
  const [clubRow] = await rest<{ owner_id: string; open_time: string; close_time: string }>('GET', `clubs?id=eq.${clubId}&select=owner_id,open_time,close_time`)
  expect(clubRow.owner_id).toBe(owner.id)
  expect(clubRow.open_time).toBe('06:00:00')

  const court = await call(request, owner, 'post', `/api/mobile/owner/clubs/${clubId}/courts`, {
    name: 'Sân 1',
    sportType: 'pickleball',
    basePricePerHour: 150000,
    depositPercentage: 30,
  })
  expect(court.status).toBe(201)
  courtId = court.body.courtId

  const rule = await call(request, owner, 'post', `/api/mobile/owner/courts/${courtId}/pricing-rules`, { name: 'Giờ vàng', startTime: '09:00', endTime: '12:00', pricePerHour: 200000 })
  expect(rule.status).toBe(201)
  const [created] = await rest<{ id: string }>('GET', `court_pricing_rules?court_id=eq.${courtId}&select=id`)
  ruleId = created.id

  const edited = await call(request, owner, 'patch', `/api/mobile/owner/pricing-rules/${ruleId}`, { name: 'Giờ vàng', startTime: '09:00', endTime: '12:00', pricePerHour: 220000 })
  expect(edited.status).toBe(200)
  const [after] = await rest<{ price_per_hour: number }>('GET', `court_pricing_rules?id=eq.${ruleId}&select=price_per_hour`)
  expect(Number(after.price_per_hour)).toBe(220000)

  // Bật/tắt và sửa sân con
  const patched = await call(request, owner, 'patch', `/api/mobile/owner/courts/${courtId}`, { name: 'Sân VIP', depositPercentage: 30, isActive: false })
  expect(patched.status).toBe(200)
  const [off] = await rest<{ name: string; is_active: boolean }>('GET', `courts?id=eq.${courtId}&select=name,is_active`)
  expect(off).toEqual({ name: 'Sân VIP', is_active: false })
  await call(request, owner, 'patch', `/api/mobile/owner/courts/${courtId}`, { isActive: true })

  // Kênh nhận cọc: chuyển khoản thủ công (khai báo tài khoản ngân hàng cho cụm sân)
  await rest('POST', 'club_bank_accounts', { club_id: clubId, bank_bin: '970436', account_number: '0123456789', account_name: 'NGUYEN VAN A' })
})

test('chủ sân khác không sửa, xóa hay ghim được cụm sân của người ta', async ({ request }) => {
  const edit = await call(request, owner2, 'patch', `/api/mobile/owner/courts/${courtId}`, { name: 'Bị chiếm' })
  expect(edit.status).toBe(400)
  expect(edit.body.error).toBe('You are not allowed to edit this court')

  expect((await call(request, owner2, 'delete', `/api/mobile/owner/courts/${courtId}`)).body.error).toBe('You are not allowed to delete this court')
  expect((await call(request, owner2, 'delete', `/api/mobile/owner/clubs/${clubId}`)).body.error).toBe('You are not the owner of this venue')
  expect((await call(request, owner2, 'put', `/api/mobile/owner/clubs/${clubId}/location`, { latitude: 1, longitude: 1 })).body.error).toBe('You are not the owner of this venue')
  expect((await call(request, owner2, 'put', `/api/mobile/owner/clubs/${clubId}/images`, { images: [] })).body.error).toBe('You are not the owner of this venue')
  expect((await call(request, owner2, 'patch', `/api/mobile/owner/pricing-rules/${ruleId}`, { name: 'x', startTime: '09:00', endTime: '10:00', pricePerHour: 100000 })).body.error).toBe('Price slot not found')
  expect((await call(request, owner2, 'delete', `/api/mobile/owner/pricing-rules/${ruleId}`)).body.error).toBe('Price slot not found')
  expect((await call(request, owner2, 'post', `/api/mobile/owner/clubs/${clubId}/courts`, { name: 'Lậu', sportType: 'tennis', basePricePerHour: 100000, depositPercentage: 30 })).status).toBe(400)

  const [court] = await rest<{ name: string }>('GET', `courts?id=eq.${courtId}&select=name`)
  expect(court.name).toBe('Sân VIP')
  expect(await rest('GET', `court_pricing_rules?id=eq.${ruleId}&select=id`)).toHaveLength(1)
})

test('khách đặt sân: giá do server tính, không trùng lịch, đúng giờ mở cửa', async ({ request }) => {
  const slot = vnSlot(2, 10)
  const booked = await call(request, player, 'post', '/api/mobile/bookings', { courtId, ...slot })
  expect(booked.status).toBe(201)

  // 10:00-11:00 rơi vào khung "Giờ vàng" 220.000 đ/giờ, cọc 30%
  const [row] = await rest<{ total_price: number; deposit_amount: number; status: string }>('GET', `bookings?id=eq.${booked.body.bookingId}&select=total_price,deposit_amount,status`)
  expect(Number(row.total_price)).toBe(220000)
  expect(Number(row.deposit_amount)).toBe(66000)
  expect(row.status).toBe('pending')
  const [payment] = await rest<{ payment_method: string; amount: number }>('GET', `payments?booking_id=eq.${booked.body.bookingId}&select=payment_method,amount`)
  expect(payment.payment_method).toBe('bank_transfer_manual')
  expect(Number(payment.amount)).toBe(66000)

  const clash = await call(request, player2, 'post', '/api/mobile/bookings', { courtId, ...slot })
  expect(clash.status).toBe(400)
  expect(clash.body.error).toMatch(/was just booked or is being held/)

  const closed = await call(request, player2, 'post', '/api/mobile/bookings', { courtId, ...vnSlot(2, 3) })
  expect(closed.status).toBe(400)
  expect(closed.body.error).toMatch(/outside opening hours/)

  // Sân đang tắt thì không nhận đặt (RLS còn ẩn sân đang tắt khỏi người ngoài nên khách thấy "không tìm thấy")
  await call(request, owner, 'patch', `/api/mobile/owner/courts/${courtId}`, { isActive: false })
  const inactive = await call(request, player2, 'post', '/api/mobile/bookings', { courtId, ...vnSlot(2, 14) })
  expect(inactive.status).toBe(400)
  await call(request, owner, 'patch', `/api/mobile/owner/courts/${courtId}`, { isActive: true })

  process.env.E2E_BOOKING_1 = booked.body.bookingId
})

test('chủ sân xác nhận cọc: đơn thành đã xác nhận, khoản cọc thành đã trả, khách nhận thông báo', async ({ request }) => {
  const bookingId = process.env.E2E_BOOKING_1!
  const stranger = await call(request, owner2, 'post', `/api/mobile/owner/bookings/${bookingId}/status`, { status: 'confirmed' })
  expect(stranger.status).toBe(400)

  const confirmed = await call(request, owner, 'post', `/api/mobile/owner/bookings/${bookingId}/status`, { status: 'confirmed' })
  expect(confirmed.status).toBe(200)

  const [booking] = await rest<{ status: string }>('GET', `bookings?id=eq.${bookingId}&select=status`)
  expect(booking.status).toBe('confirmed')
  const [payment] = await rest<{ status: string }>('GET', `payments?booking_id=eq.${bookingId}&select=status`)
  expect(payment.status).toBe('paid')
  expect((await rest('GET', `notifications?user_id=eq.${player.id}&select=id`)).length).toBeGreaterThan(0)
})

test('đã có đơn thì không xóa được sân con và cụm sân', async ({ request }) => {
  const court = await call(request, owner, 'delete', `/api/mobile/owner/courts/${courtId}`)
  expect(court.status).toBe(400)
  expect(court.body.error).toMatch(/^It cannot be deleted/)
  const club = await call(request, owner, 'delete', `/api/mobile/owner/clubs/${clubId}`)
  expect(club.status).toBe(400)
  expect(await rest('GET', `courts?id=eq.${courtId}&select=id`)).toHaveLength(1)
})

test('chủ sân hủy đơn đã cọc thì phải hoàn đủ, rồi đánh dấu đã hoàn', async ({ request }) => {
  const booked = await call(request, player, 'post', '/api/mobile/bookings', { courtId, ...vnSlot(2, 14) })
  expect(booked.status).toBe(201)
  const id = booked.body.bookingId
  expect((await call(request, owner, 'post', `/api/mobile/owner/bookings/${id}/status`, { status: 'confirmed' })).status).toBe(200)

  const cancelled = await call(request, owner, 'post', `/api/mobile/owner/bookings/${id}/status`, { status: 'cancelled' })
  expect(cancelled.status).toBe(200)
  expect(cancelled.body.refundAmount).toBe(45000) // 150.000 đ × 30%

  const [due] = await rest<{ status: string; refund_status: string; refund_amount: number }>('GET', `bookings?id=eq.${id}&select=status,refund_status,refund_amount`)
  expect(due.status).toBe('cancelled')
  expect(due.refund_status).toBe('pending')
  expect(Number(due.refund_amount)).toBe(45000)

  expect((await call(request, owner2, 'post', `/api/mobile/owner/bookings/${id}/refunded`)).status).toBe(400)
  expect((await call(request, owner, 'post', `/api/mobile/owner/bookings/${id}/refunded`)).status).toBe(200)
  const [done] = await rest<{ refund_status: string }>('GET', `bookings?id=eq.${id}&select=refund_status`)
  expect(done.refund_status).toBe('refunded')

  // Khung giờ đã nhả: đặt lại được
  expect((await call(request, player2, 'post', '/api/mobile/bookings', { courtId, ...vnSlot(2, 14) })).status).toBe(201)
})

test('khách hủy đơn của mình, không hủy được đơn của người khác', async ({ request }) => {
  const booked = await call(request, player, 'post', '/api/mobile/bookings', { courtId, ...vnSlot(3, 16) })
  expect(booked.status).toBe(201)
  const id = booked.body.bookingId

  expect((await call(request, player2, 'post', `/api/mobile/bookings/${id}/cancel`)).status).toBe(400)
  const own = await call(request, player, 'post', `/api/mobile/bookings/${id}/cancel`)
  expect(own.status).toBe(200)
  expect(own.body.refundAmount).toBe(0) // chưa cọc nên không có gì để hoàn
  const [row] = await rest<{ status: string }>('GET', `bookings?id=eq.${id}&select=status`)
  expect(row.status).toBe('cancelled')
})

test('đặt kèo ghép: tạo kèo, chỉ chủ kèo mới duyệt được người xin vào', async ({ request }) => {
  const booked = await call(request, player, 'post', '/api/mobile/bookings', {
    courtId,
    ...vnSlot(3, 18),
    match: { isOpenMatch: true, title: 'Kèo tối', skillLevel: 'all', requiredPlayers: 4, costSharingType: 'split' },
  })
  expect(booked.status).toBe(201)
  const [match] = await rest<{ id: string; creator_id: string; required_players: number; cost_per_person: number }>(
    'GET',
    `matches?booking_id=eq.${booked.body.bookingId}&select=id,creator_id,required_players,cost_per_person`
  )
  expect(match.creator_id).toBe(player.id)
  expect(match.required_players).toBe(4)
  expect(Number(match.cost_per_person)).toBe(37500) // 150.000 đ chia 4 người

  const [participant] = await rest<{ id: string }>('POST', 'match_participants', { match_id: match.id, user_id: player2.id, status: 'pending' })

  // Người xin vào không tự duyệt mình được
  const self = await call(request, player2, 'post', `/api/mobile/matches/participants/${participant.id}/respond`, { status: 'accepted' })
  expect(self.status).toBe(400)
  expect((await rest<{ status: string }>('GET', `match_participants?id=eq.${participant.id}&select=status`))[0].status).toBe('pending')

  const accepted = await call(request, player, 'post', `/api/mobile/matches/participants/${participant.id}/respond`, { status: 'accepted' })
  expect(accepted.status).toBe(200)
  expect((await rest<{ status: string }>('GET', `match_participants?id=eq.${participant.id}&select=status`))[0].status).toBe('accepted')
  const [updated] = await rest<{ current_players: number }>('GET', `matches?id=eq.${match.id}&select=current_players`)
  expect(updated.current_players).toBe(2)
})

test('vị trí và ảnh của cụm sân: chỉ nhận ảnh trong kho của cụm sân, gỡ ảnh thì file bị xóa', async ({ request }) => {
  const pinned = await call(request, owner, 'put', `/api/mobile/owner/clubs/${clubId}/location`, { latitude: 10.7325, longitude: 106.7195 })
  expect(pinned.status).toBe(200)
  const [loc] = await rest<{ latitude: number; longitude: number }>('GET', `clubs?id=eq.${clubId}&select=latitude,longitude`)
  expect([Number(loc.latitude), Number(loc.longitude)]).toEqual([10.7325, 106.7195])
  expect((await call(request, owner, 'put', `/api/mobile/owner/clubs/${clubId}/location`, { latitude: 200, longitude: 10 })).status).toBe(400)
  expect((await call(request, owner, 'put', `/api/mobile/owner/clubs/${clubId}/location`, { latitude: null, longitude: null })).status).toBe(200)

  // Tải ảnh lên Storage bằng phiên của chủ sân (chính sách bucket cho phép đúng thư mục của cụm sân)
  const path = `${clubId}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png`
  const upload = await fetch(`${SUPABASE_URL}/storage/v1/object/club-images/${path}`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${owner.token}`, 'Content-Type': 'image/png' },
    body: TINY_PNG,
  })
  expect(upload.status).toBe(200)

  const foreign = await fetch(`${SUPABASE_URL}/storage/v1/object/club-images/${clubId}-khac/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${owner2.token}`, 'Content-Type': 'image/png' },
    body: TINY_PNG,
  })
  expect(foreign.ok).toBe(false) // chủ sân khác không ghi được vào kho của cụm sân này

  const url = `${SUPABASE_URL}/storage/v1/object/public/club-images/${path}`
  const saved = await call(request, owner, 'put', `/api/mobile/owner/clubs/${clubId}/images`, { images: [url] })
  expect(saved.status).toBe(200)
  expect((await rest<{ images: string[] }>('GET', `clubs?id=eq.${clubId}&select=images`))[0].images).toEqual([url])
  expect((await fetch(url)).status).toBe(200)

  const stolen = await call(request, owner, 'put', `/api/mobile/owner/clubs/${clubId}/images`, { images: [`${SUPABASE_URL}/storage/v1/object/public/club-images/${owner2.id}/x.png`] })
  expect(stolen.status).toBe(400)
  expect(stolen.body.error).toBe("Some images do not belong to this venue's gallery")

  expect((await call(request, owner, 'put', `/api/mobile/owner/clubs/${clubId}/images`, { images: [] })).status).toBe(200)
  expect((await fetch(url)).ok).toBe(false) // file đã được dọn khỏi Storage
})

test('xóa khung giá, sân con và cụm sân khi chưa có đơn nào', async ({ request }) => {
  expect((await call(request, owner, 'delete', `/api/mobile/owner/pricing-rules/${ruleId}`)).status).toBe(200)
  expect(await rest('GET', `court_pricing_rules?id=eq.${ruleId}&select=id`)).toHaveLength(0)
  expect((await call(request, owner, 'delete', `/api/mobile/owner/pricing-rules/${ruleId}`)).body.error).toBe('Price slot not found')

  const spare = await call(request, owner, 'post', `/api/mobile/owner/clubs/${clubId}/courts`, { name: 'Sân phụ', sportType: 'tennis', basePricePerHour: 100000, depositPercentage: 20 })
  expect(spare.status).toBe(201)
  expect((await call(request, owner, 'delete', `/api/mobile/owner/courts/${spare.body.courtId}`)).status).toBe(200)
  expect(await rest('GET', `courts?id=eq.${spare.body.courtId}&select=id`)).toHaveLength(0)

  const empty = await call(request, owner, 'post', '/api/mobile/owner/clubs', { name: 'Cụm trống', address: '1 Phố' })
  expect((await call(request, owner, 'delete', `/api/mobile/owner/clubs/${empty.body.clubId}`)).status).toBe(200)
  expect(await rest('GET', `clubs?id=eq.${empty.body.clubId}&select=id`)).toHaveLength(0)
})

async function login(page: Page, user: TestUser) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Mật khẩu').fill(PASSWORD)
  await page.getByRole('button', { name: /^Đăng nhập/ }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

test('giao diện web thấy dữ liệu vừa tạo: khách xem lịch đặt, chủ sân xem lịch sân', async ({ page }) => {
  await login(page, player)
  await page.goto('/my-bookings')
  await expect(page.getByText('Cụm Sân E2E').first()).toBeVisible()

  await page.context().clearCookies()
  await login(page, owner)
  await page.goto('/owner/clubs')
  await expect(page.getByText('Cụm Sân E2E').first()).toBeVisible()
})
