// Supabase giả cho kiểm thử đầu-cuối: trả dữ liệu mẫu cho các bảng công khai và từ chối mọi đăng nhập.
// Chạy bằng Node thuần, không cần Docker hay tài khoản Supabase thật nên chạy được trên máy dev lẫn CI.
// Server của Next gọi vào đây (SSR), vì vậy Playwright không chặn được các lời gọi này; phải là một server thật.
import { createServer } from 'node:http'
import { CLUB_ID } from './fixtures.mjs'

const PORT = Number(process.env.MOCK_SUPABASE_PORT ?? 54399)

const COURT_ID = '22222222-2222-4222-8222-222222222222'

const court = {
  id: COURT_ID,
  club_id: CLUB_ID,
  name: 'Sân số 1',
  sport_type: 'pickleball',
  surface_type: 'Sân cứng',
  base_price_per_hour: 120000,
  deposit_percentage: 30,
  is_active: true,
  court_pricing_rules: [],
}

const club = {
  id: CLUB_ID,
  owner_id: '33333333-3333-4333-8333-333333333333',
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

const tables = { clubs: [club], courts: [court] }

function send(res, status, body, extra = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...extra })
  res.end(JSON.stringify(body))
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
  const path = url.pathname

  if (path === '/__health') return send(res, 200, { ok: true })

  // Đăng nhập: luôn từ chối, đủ để kiểm tra luồng lỗi mà không cần tài khoản thật
  if (path.startsWith('/auth/v1/token')) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' })
  if (path.startsWith('/auth/v1/')) return send(res, 401, { msg: 'Auth session missing', code: 401 })

  if (path.startsWith('/rest/v1/rpc/')) return send(res, 200, [])

  if (path.startsWith('/rest/v1/')) {
    const table = path.slice('/rest/v1/'.length)
    let rows = [...(tables[table] ?? [])]
    const id = url.searchParams.get('id')
    if (id?.startsWith('eq.')) rows = rows.filter((r) => r.id === id.slice(3))

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
