/**
 * Tiện ích cho bộ kiểm thử với Supabase thật chạy cục bộ (`supabase start`). Khóa lấy từ biến môi trường do e2e-real/run.mjs
 * đặt từ `supabase status`, nên không bao giờ chạm tới database thật của dự án.
 */
export const SUPABASE_URL = required('E2E_SUPABASE_URL')
export const ANON_KEY = required('E2E_SUPABASE_ANON_KEY')
export const SERVICE_KEY = required('E2E_SUPABASE_SERVICE_ROLE_KEY')

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Thiếu biến môi trường ${name}. Chạy bằng "npm run e2e:real" (cần Docker và Supabase CLI).`)
  return value
}

export const PASSWORD = 'e2e-Passw0rd!'

export interface TestUser {
  id: string
  email: string
  token: string
  refreshToken: string
}

/** Tạo tài khoản đã xác thực email qua API quản trị của GoTrue, rồi đăng nhập lấy access token. */
export async function createUser(label: string, role: 'player' | 'owner', fullName: string): Promise<TestUser> {
  const email = `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.test`
  const created = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: fullName, role } }),
  })
  if (!created.ok) throw new Error(`Không tạo được tài khoản ${label}: ${created.status} ${await created.text()}`)
  const { id } = (await created.json()) as { id: string }

  const login = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  if (!login.ok) throw new Error(`Không đăng nhập được ${label}: ${login.status} ${await login.text()}`)
  const { access_token, refresh_token } = (await login.json()) as { access_token: string; refresh_token: string }
  return { id, email, token: access_token, refreshToken: refresh_token }
}

/** Gọi REST của database bằng service_role (bỏ qua RLS) để dựng dữ liệu và kiểm tra kết quả. */
export async function rest<T = Record<string, unknown>>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`)
  const text = await res.text()
  return text ? (JSON.parse(text) as T[]) : []
}

/** 10:00 giờ Việt Nam của `daysAhead` ngày nữa, cộng thêm `hour - 10` giờ; trả về ISO UTC. */
export function vnSlot(daysAhead: number, hour: number, durationHours = 1): { startTime: string; endTime: string } {
  const start = new Date()
  start.setUTCDate(start.getUTCDate() + daysAhead)
  start.setUTCHours(hour - 7, 0, 0, 0)
  const end = new Date(start.getTime() + durationHours * 3600_000)
  return { startTime: start.toISOString(), endTime: end.toISOString() }
}

/** PNG 1x1 hợp lệ để thử tải ảnh lên Storage. */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)
