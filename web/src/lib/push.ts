import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Gửi thông báo đẩy tới ứng dụng mobile qua Expo Push Service. Thông báo trong chuông (bảng notifications) vẫn là
 * nguồn sự thật; đẩy chỉ là lời nhắc kèm theo, nên mọi lỗi ở đây chỉ ghi log và không bao giờ làm hỏng nghiệp vụ gọi nó.
 */
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
// Expo nhận tối đa 100 tin mỗi lần gọi
const BATCH_SIZE = 100
const TIMEOUT_MS = 8000
const TOKEN_FORMAT = /^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/

export interface PushPayload {
  title: string
  message: string
  /** Đường dẫn trong app/web (vd. /matches/<id>); app mobile dùng để mở đúng màn hình khi chạm vào thông báo */
  link?: string | null
  /** Bản tiếng Anh, gửi cho người nhận đã chọn tiếng Anh (profiles.locale = 'en') */
  en?: { title: string; message: string } | null
  /** Nhóm nút hành động trên thông báo (đăng ký ở app, vd. 'join_request') */
  categoryId?: string
  /** Dữ liệu kèm theo cho app (vd. participantId); chỉ nhận chuỗi ngắn */
  data?: Record<string, string>
}

export interface ExpoMessage {
  to: string
  title: string
  body: string
  sound: 'default'
  channelId: 'default'
  categoryId?: string
  data: Record<string, string>
}

export function isExpoPushToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_FORMAT.test(value)
}

/** Chỉ giữ dữ liệu là chuỗi ngắn (thông báo đẩy bị giới hạn kích thước, và không nên chứa gì nhạy cảm). */
function extraData(data: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(data ?? {})) {
    if (key !== 'link' && typeof value === 'string' && value.length <= 100) out[key] = value
  }
  return out
}

/** Dựng tin nhắn cho từng token hợp lệ; bỏ token sai dạng và loại trùng. */
export function buildExpoMessages(tokens: readonly string[], payload: PushPayload): ExpoMessage[] {
  const link = payload.link && payload.link.startsWith('/') && !payload.link.startsWith('//') ? payload.link : undefined
  return [...new Set(tokens)].filter(isExpoPushToken).map((to) => ({
    to,
    title: payload.title.slice(0, 120),
    body: payload.message.slice(0, 240),
    sound: 'default' as const,
    channelId: 'default' as const,
    ...(payload.categoryId && /^[a-z_]{1,40}$/.test(payload.categoryId) ? { categoryId: payload.categoryId } : {}),
    data: { ...extraData(payload.data), ...(link ? { link } : {}) },
  }))
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

interface ExpoTicket {
  status: 'ok' | 'error'
  details?: { error?: string }
}

/** Token mà Expo báo thiết bị không còn nhận được (gỡ app, tắt thông báo): nên xóa khỏi database. */
export function deadTokens(messages: readonly ExpoMessage[], tickets: readonly ExpoTicket[]): string[] {
  return tickets.flatMap((t, i) => (t.status === 'error' && t.details?.error === 'DeviceNotRegistered' && messages[i] ? [messages[i].to] : []))
}

async function sendBatch(messages: ExpoMessage[]): Promise<string[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' }
  // Tùy chọn: bật "Enhanced Security for Push Notifications" trong Expo thì cần token truy cập
  if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Expo Push trả về ${res.status}`)
  const json = (await res.json()) as { data?: ExpoTicket[] }
  return deadTokens(messages, json.data ?? [])
}

/** Gửi đẩy tới danh sách token. Trả về số tin đã gửi; lỗi từng lô được bỏ qua sau khi ghi log. */
export async function sendPushToTokens(tokens: readonly string[], payload: PushPayload): Promise<number> {
  const messages = buildExpoMessages(tokens, payload)
  if (messages.length === 0) return 0

  const dead: string[] = []
  let sent = 0
  for (const batch of chunk(messages, BATCH_SIZE)) {
    try {
      dead.push(...(await sendBatch(batch)))
      sent += batch.length
    } catch (err) {
      console.error('Gửi thông báo đẩy lỗi:', err instanceof Error ? err.message : err)
    }
  }

  if (dead.length > 0) {
    const { error } = await createAdminClient().from('push_tokens').delete().in('token', dead)
    if (error) console.error('Không xóa được push token hỏng:', error)
  }
  return sent
}

/** Đẩy tới mọi thiết bị của các người dùng. Không ném lỗi. */
export async function pushToUsers(userIds: readonly string[], payload: PushPayload): Promise<void> {
  if (userIds.length === 0 || !payload.title) return
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.from('push_tokens').select('token, profile:profiles!inner(locale)').in('user_id', [...userIds])
    if (error) throw error
    const rows = data ?? []
    const english = rows.filter((r) => r.profile?.locale === 'en').map((r) => r.token)
    const vietnamese = rows.filter((r) => r.profile?.locale !== 'en').map((r) => r.token)
    await sendPushToTokens(vietnamese, payload)
    // Người nhận chọn tiếng Anh mà chưa có bản dịch thì vẫn nhận bản gốc
    await sendPushToTokens(english, payload.en ? { ...payload, ...payload.en } : payload)
  } catch (err) {
    console.error('pushToUsers lỗi:', err instanceof Error ? err.message : err)
  }
}

/** Đẩy tới mọi thiết bị của một nhóm vai trò (hoặc tất cả). Dùng cho thông báo cập nhật của quản trị. */
export async function pushToAudience(audience: 'all' | 'owners' | 'players', payload: PushPayload): Promise<void> {
  try {
    const admin = createAdminClient()
    const query = admin.from('push_tokens').select('token, profile:profiles!inner(role)')
    const { data, error } = await (audience === 'all'
      ? query
      : query.in('profile.role', audience === 'owners' ? ['owner', 'admin'] : ['player']))
    if (error) throw error
    await sendPushToTokens((data ?? []).map((r) => r.token), payload)
  } catch (err) {
    console.error('pushToAudience lỗi:', err instanceof Error ? err.message : err)
  }
}
