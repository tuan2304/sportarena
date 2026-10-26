import { supabase } from './supabase'
import { currentLang, translate } from '../i18n'

/**
 * Gọi API của máy chủ web (Next.js). Ghi vào bảng đặt sân bị khóa với người dùng nên mọi thao tác ghi
 * (giữ chỗ, hủy đơn, báo đã chuyển khoản) đi qua đây; server tính giá và kiểm tra quy tắc, app không tự quyết số tiền.
 * Đặt EXPO_PUBLIC_API_URL trong mobile/.env (xem .env.example), ví dụ https://ten-mien-cua-ban.vercel.app
 */
const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '')
const TIMEOUT_MS = 20_000

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number }

export function apiPost<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
  return request<T>('POST', path, body)
}

/** Gọi API không cần đăng nhập (vd. quên mật khẩu): không gửi token. */
export function apiPostPublic<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
  return request<T>('POST', path, body, false)
}

export function apiPut<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
  return request<T>('PUT', path, body)
}

export function apiPatch<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
  return request<T>('PATCH', path, body)
}

export function apiDelete<T>(path: string): Promise<ApiResult<T>> {
  return request<T>('DELETE', path)
}

async function request<T>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown, authenticated = true): Promise<ApiResult<T>> {
  if (!API_URL) {
    return { ok: false, status: 0, error: translate('api.noServer') }
  }

  let token: string | null = null
  if (authenticated) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { ok: false, status: 401, error: translate('api.loginRequired') }
    token = session.access_token
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        // Máy chủ dịch thông báo lỗi theo ngôn ngữ này
        'Accept-Language': currentLang(),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(method === 'DELETE' ? {} : { body: JSON.stringify(body ?? {}) }),
      signal: controller.signal,
    })

    let json: any = null
    try {
      json = await res.json()
    } catch {
      // thân không phải JSON: rơi xuống thông báo chung bên dưới
    }

    if (!res.ok) {
      return { ok: false, status: res.status, error: json?.error ?? translate('api.serverError') }
    }
    return { ok: true, data: json as T }
  } catch (err: any) {
    const timedOut = err?.name === 'AbortError'
    return {
      ok: false,
      status: 0,
      error: timedOut ? translate('api.timeout') : translate('api.network'),
    }
  } finally {
    clearTimeout(timer)
  }
}
