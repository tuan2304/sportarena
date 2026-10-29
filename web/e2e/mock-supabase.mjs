// Supabase giả cho kiểm thử đầu-cuối: trả dữ liệu mẫu cho các bảng và cho phép đăng nhập bằng 3 tài khoản giả
// (người chơi, chủ sân, quản trị). Không kiểm tra mật khẩu và không áp RLS: chỉ đủ để kiểm tra giao diện và luồng đăng nhập.
// Chạy bằng Node thuần, không cần Docker hay tài khoản Supabase thật nên chạy được trên máy dev lẫn CI.
// Server của Next gọi vào đây (SSR), vì vậy Playwright không chặn được các lời gọi này; phải là một server thật.
import { createServer } from 'node:http'
import { CLUB_ID, COURT_ID, USERS } from './fixtures.mjs'

const PORT = Number(process.env.MOCK_SUPABASE_PORT ?? 54399)

const court = {
  id: COURT_ID,
  club_id: CLUB_ID,
  name: 'Sân số 1',
  sport_type: 'pickleball',
  surface_type: 'Sân cứng',
  base_price_per_hour: 120000,
  deposit_percentage: 30,
  is_active: true,
  court_pricing_rules: [
    { id: '33333333-3333-4333-8333-333333333331', name: 'Giờ vàng', start_time: '17:00:00', end_time: '21:00:00', price_per_hour: 180000, days_of_week: [1, 2, 3, 4, 5] },
  ],
}

const club = {
  id: CLUB_ID,
  owner_id: USERS.owner.id,
  name: 'Cụm sân Kiểm Thử',
  description: 'Cụm sân dùng cho kiểm thử đầu-cuối.',
  address: '1 Đường Thử Nghiệm',
  ward: 'Phường 1',
  district: 'Quận 1',
  city: 'TP. Hồ Chí Minh',
  latitude: null,
  longitude: null,
  open_time: '06:00:00',
  close_time: '22:00:00',
  amenities: ['Bãi giữ xe', 'Nước uống'],
  images: [],
  is_active: true,
  free_cancel_hours: 24,
  accepts_online_payment: false,
  accepts_manual_transfer: true,
  plan: 'free',
  plan_until: null,
  created_at: '2026-01-01T00:00:00Z',
  courts: [court],
}

const inDays = (d, hour) => {
  const t = new Date(Date.now() + d * 86_400_000)
  t.setUTCHours(hour, 0, 0, 0)
  return t.toISOString()
}

// Đơn đặt sân mẫu của người chơi, kèm các quan hệ mà các trang đọc (mock không áp select nên trả sẵn bản đầy đủ)
const booking = {
  id: '55555555-5555-4555-8555-555555555551',
  court_id: COURT_ID,
  user_id: USERS.player.id,
  start_time: inDays(2, 11),
  end_time: inDays(2, 12),
  total_price: 120000,
  deposit_amount: 36000,
  status: 'confirmed',
  is_open_match: false,
  refund_status: 'none',
  refund_amount: 0,
  expires_at: inDays(2, 10),
  created_at: inDays(-1, 3),
  court: { ...court, club: { id: CLUB_ID, name: club.name, address: club.address, free_cancel_hours: 24, owner_id: USERS.owner.id } },
  profile: { full_name: USERS.player.name },
  matches: null,
  payments: [],
}

const notifications = [
  {
    id: '66666666-6666-4666-8666-666666666661',
    user_id: USERS.player.id,
    title: 'Thanh toán cọc thành công! 🎉',
    message: 'Bạn đã cọc 36.000 đ cho sân Sân số 1 (Cụm sân Kiểm Thử). Sân đã được khóa lịch cho bạn!',
    title_en: 'Deposit paid! 🎉',
    message_en: 'You paid a deposit of 36.000 đ for Sân số 1 (Cụm sân Kiểm Thử). The court is now reserved for you!',
    type: 'payment',
    link: '/my-bookings',
    is_read: false,
    created_at: inDays(0, 1),
  },
]

const platformStats = {
  users: { total: 120, new: 12, owners: 15, players: 105 },
  clubs: { total: 14, new: 2, pro: 3, own_payos: 9 },
  courts_active: 40,
  bookings: { created: 80, confirmed: 60, cancelled: 10, pending: 10, gmv: 9600000 },
  deposits: { collected: 2880000 },
  subscriptions: { revenue: 597000, count: 3 },
  matches: { created: 25, open: 7 },
  open_tickets: 2,
  daily: [{ day: '2026-10-24', bookings: 5, deposits: 180000 }],
  top_clubs: [{ id: CLUB_ID, name: club.name, bookings: 12, gmv: 1440000 }],
}

// Kèo ghép gắn với đơn đặt sân (giờ kèo = giờ đơn). Mock không lọc theo điều kiện truy vấn nên trả cả kèo đã kết thúc:
// trang danh sách phải tự ẩn kèo đã qua giờ, trang chi tiết phải báo "đã kết thúc" và không cho xin tham gia.
const hoursFromNow = (h) => new Date(Date.now() + h * 3_600_000).toISOString()
const makeMatch = (n, title, startH, endH) => ({
  id: `77777777-7777-4777-8777-77777777777${n}`,
  booking_id: `88888888-8888-4888-8888-88888888888${n}`,
  creator_id: USERS.owner.id,
  title,
  description: null,
  sport_type: 'pickleball',
  skill_level: 'all',
  required_players: 4,
  current_players: 1,
  cost_sharing_type: 'split',
  cost_per_person: 30000,
  status: 'open',
  created_at: hoursFromNow(-48 + n),
  creator: { id: USERS.owner.id, full_name: USERS.owner.name, avatar_url: null, rating: 4.5 },
  // Giờ và sân nằm ngay trên kèo (bản sao công khai từ đơn đặt sân; người chơi khác không đọc được bảng bookings)
  court_id: COURT_ID,
  start_time: hoursFromNow(startH),
  end_time: hoursFromNow(endH),
  court: { id: COURT_ID, name: court.name, sport_type: 'pickleball', club: { id: CLUB_ID, name: club.name, address: club.address, district: club.district, city: club.city, latitude: null, longitude: null } },
})
const matchUpcoming = makeMatch(1, 'Kèo Sắp Diễn Ra', 5, 6)
const matchLive = makeMatch(2, 'Kèo Đang Chơi', -0.5, 0.5)
const matchEnded = makeMatch(3, 'Kèo Đã Qua Giờ', -3, -2)

// Khoản cần đối soát cho trang /admin/payments. user_id là một khách khác, không trùng người chơi mẫu để các trang cá nhân không thấy chúng.
const reconBooking = (id, status) => ({
  id,
  status,
  start_time: inDays(5, 11),
  cancelled_by: null,
  court: { name: court.name, club: { name: club.name } },
})
const payments = [
  {
    id: '99999999-9999-4999-8999-9999999999a1',
    user_id: '99999999-9999-4999-8999-999999999991',
    order_code: 7001,
    amount: 36000,
    status: 'paid',
    paid_at: inDays(-1, 3),
    created_at: inDays(-1, 3),
    metadata: { channel: 'club', needs_refund: true, reason: 'slot_taken_after_expiry' },
    customer: { full_name: 'Khách Cần Hoàn' },
    booking: reconBooking('99999999-9999-4999-8999-9999999999b1', 'cancelled'),
  },
  {
    id: '99999999-9999-4999-8999-9999999999a2',
    user_id: '99999999-9999-4999-8999-999999999992',
    order_code: 7002,
    amount: 54000,
    status: 'paid',
    paid_at: inDays(-2, 3),
    created_at: inDays(-2, 3),
    metadata: { channel: 'platform' },
    customer: { full_name: 'Khách Đơn Kẹt' },
    booking: reconBooking('99999999-9999-4999-8999-9999999999b2', 'pending'),
  },
]

const tables = {
  payments,
  matches: [matchUpcoming, matchLive, matchEnded],
  clubs: [club],
  courts: [court],
  bookings: [booking],
  notifications,
  profiles: Object.values(USERS).map((u) => ({
    id: u.id,
    full_name: u.name,
    role: u.role,
    avatar_url: null,
    skill_level: 'intermediate',
    rating: 4.5,
    phone_number: null,
  })),
}

const rpcs = {
  get_my_profile: (user) => (user ? [{ ...tables.profiles.find((p) => p.id === user.id), phone_number: '0912345678' }] : []),
  player_public_stats: () => [{ matches_created: 2, matches_joined: 3, bookings_played: 5 }],
  platform_stats: () => platformStats,
  // Khách khác đã đặt sân số 1 lúc 14:00-15:00 ngày 15/03/2027 (07:00Z-08:00Z); chỉ ngày này nên không ảnh hưởng test khác
  get_busy_slots: () => [
    { court_id: COURT_ID, start_time: '2027-03-15T07:00:00Z', end_time: '2027-03-15T08:00:00Z', status: 'confirmed' },
  ],
  get_booking_contacts: () => [],
  // Xóa tài khoản / xuất dữ liệu / đối soát (máy chủ gọi bằng service_role nên không có người dùng kèm theo)
  account_deletion_blockers: () => ['active_bookings'],
  export_user_data: () => ({ profile: { full_name: 'Người dùng thử', phone_number: '0912345678' }, bookings: [] }),
  admin_mark_payment_refunded: () => 'refunded',
  admin_repair_paid_payment: () => 'confirmed',
}

const recoverRequests = []
const passwordUpdates = []

function send(res, status, body, extra = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...extra })
  res.end(JSON.stringify(body))
}

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')

/** JWT HS256 giả (chữ ký không kiểm tra): supabase-js với khóa đối xứng sẽ hỏi lại /auth/v1/user để xác thực. */
function makeToken(user, amr) {
  const now = Math.floor(Date.now() / 1000)
  const payload = { sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', session_id: user.id, iat: now, exp: now + 3600, ...(amr ? { amr } : {}) }
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.mock-signature`
}

function authUser(user) {
  return {
    id: user.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: user.email,
    email_confirmed_at: '2026-01-01T00:00:00Z',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { full_name: user.name, role: user.role },
    created_at: '2026-01-01T00:00:00Z',
  }
}

function userFromToken(req) {
  const header = String(req.headers.authorization ?? '')
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  const part = token.split('.')[1]
  if (!part) return null
  try {
    const { sub } = JSON.parse(Buffer.from(part, 'base64url').toString())
    return Object.values(USERS).find((u) => u.id === sub) ?? null
  } catch {
    return null
  }
}

async function readBody(req) {
  const chunks = []
  for await (const c of req) chunks.push(c)
  try {
    return JSON.parse(Buffer.concat(chunks).toString() || '{}')
  } catch {
    return {}
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
  const path = url.pathname

  if (path === '/__health') return send(res, 200, { ok: true })

  // Đăng nhập: nhận email của 3 tài khoản giả, từ chối còn lại
  if (path.startsWith('/auth/v1/token')) {
    const { email } = await readBody(req)
    const user = Object.values(USERS).find((u) => u.email === email)
    if (!user) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' })
    const access = makeToken(user)
    return send(res, 200, {
      access_token: access,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: `refresh-${user.id}`,
      user: authUser(user),
    })
  }
  if (path === '/auth/v1/user') {
    const user = userFromToken(req)
    if (!user) return send(res, 401, { msg: 'Auth session missing', code: 401 })
    // updateUser (đặt mật khẩu mới): ghi nhận để kiểm thử đọc lại qua /__password-updates
    if (req.method === 'PUT') {
      const { password } = await readBody(req)
      passwordUpdates.push({ userId: user.id, password })
      return send(res, 200, authUser(user))
    }
    return send(res, 200, authUser(user))
  }
  // Quên mật khẩu: ghi nhận yêu cầu gửi thư; không gửi thư thật
  if (path === '/auth/v1/recover') {
    const { email } = await readBody(req)
    recoverRequests.push({ email, redirectTo: url.searchParams.get('redirect_to') })
    return send(res, 200, {})
  }
  if (path === '/__recover-requests') return send(res, 200, recoverRequests)
  if (path === '/__password-updates') return send(res, 200, passwordUpdates)
  // Phiên khôi phục giả, như phiên Supabase cấp khi bấm liên kết trong thư (amr có phương thức recovery)
  if (path === '/__recovery-session') {
    const user = Object.values(USERS).find((u) => u.id === url.searchParams.get('user') || u.email === url.searchParams.get('email'))
    if (!user) return send(res, 404, {})
    return send(res, 200, { access_token: makeToken(user, [{ method: 'otp', timestamp: Math.floor(Date.now() / 1000) }]), refresh_token: `refresh-${user.id}` })
  }
  if (path.startsWith('/auth/v1/logout')) return send(res, 204, {})
  if (path.startsWith('/auth/v1/')) return send(res, 401, { msg: 'Auth session missing', code: 401 })

  if (path.startsWith('/rest/v1/rpc/')) {
    const handler = rpcs[path.slice('/rest/v1/rpc/'.length)]
    return send(res, 200, handler ? handler(userFromToken(req)) : [])
  }

  if (path.startsWith('/rest/v1/')) {
    const table = path.slice('/rest/v1/'.length)
    let rows = [...(tables[table] ?? [])]
    const id = url.searchParams.get('id')
    if (id?.startsWith('eq.')) rows = rows.filter((r) => r.id === id.slice(3))
    // Mock không giả lập RLS: chỉ lọc theo người sở hữu để mỗi tài khoản thấy dữ liệu của mình
    const userId = url.searchParams.get('user_id')
    if (userId?.startsWith('eq.')) rows = rows.filter((r) => r.user_id === userId.slice(3))
    const ownerId = url.searchParams.get('owner_id')
    if (ownerId?.startsWith('eq.')) rows = rows.filter((r) => r.owner_id === ownerId.slice(3))
    // Bộ lọc của trang đối soát (chỉ bảng payments, để không đổi kết quả của các truy vấn khác)
    if (table === 'payments') {
      const status = url.searchParams.get('status')
      if (status?.startsWith('eq.')) rows = rows.filter((r) => r.status === status.slice(3))
      const needsRefund = url.searchParams.get('metadata->>needs_refund')
      if (needsRefund?.startsWith('eq.')) rows = rows.filter((r) => String(r.metadata?.needs_refund) === needsRefund.slice(3))
      const bookingStatus = url.searchParams.get('booking.status')
      if (bookingStatus?.startsWith('in.(')) {
        const allowed = bookingStatus.slice(4, -1).split(',')
        rows = rows.filter((r) => allowed.includes(r.booking?.status))
      }
      if (url.searchParams.get('booking.cancelled_by') === 'is.null') rows = rows.filter((r) => r.booking?.cancelled_by == null)
      for (const cond of url.searchParams.getAll('or')) {
        if (cond.includes('needs_refund')) rows = rows.filter((r) => r.metadata?.needs_refund !== true)
        if (cond.includes('simulated')) rows = rows.filter((r) => r.metadata?.simulated !== true)
      }
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 201, rows[0] ?? {})

    const wantsObject = String(req.headers.accept ?? '').includes('application/vnd.pgrst.object+json')
    if (wantsObject) {
      return rows.length === 1
        ? send(res, 200, rows[0])
        : send(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: null, hint: null })
    }
    return send(res, 200, rows, { 'Content-Range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` })
  }

  send(res, 404, { message: 'not found' })
})

server.listen(PORT, '127.0.0.1', () => console.log(`Supabase giả đang chạy ở http://127.0.0.1:${PORT}`))
