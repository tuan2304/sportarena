import { after } from 'next/server'

/**
 * Giám sát lỗi phía máy chủ, không cần SDK:
 *  - SENTRY_DSN: gửi sự kiện lên Sentry (hoặc dịch vụ tương thích như GlitchTip) bằng giao thức "envelope".
 *  - ALERT_WEBHOOK_URL: đẩy cảnh báo tới Slack/Discord cho các sự cố cần người xử lý ngay (webhook thanh toán 5xx,
 *    lớp chống spam tự tắt, AI hỏng...). Chỉ những lời gọi có `alert: true` mới tới đây.
 * Thiếu cả hai biến thì chỉ ghi log như trước. Các hàm ở đây KHÔNG BAO GIỜ ném lỗi hay làm chậm request: giám sát
 * hỏng không được làm hỏng chức năng đang được giám sát.
 *
 * Đừng đưa dữ liệu cá nhân (email, số điện thoại, nội dung tin nhắn) vào `context`; chỉ id và con số.
 */

export type Context = Record<string, unknown>
export type Level = 'warning' | 'error'

interface Options {
  level?: Level
  /** Đẩy thêm tới ALERT_WEBHOOK_URL (mặc định chỉ gửi Sentry và ghi log) */
  alert?: boolean
}

const SENTRY_WINDOW_MS = 60_000
const ALERT_WINDOW_MS = 10 * 60_000
const TIMEOUT_MS = 3000

/**
 * Chống ngập: cùng một sự cố lặp lại (vd. mỗi request đều trượt giới hạn tần suất) chỉ gửi một lần mỗi cửa sổ.
 * Bộ nhớ theo từng instance serverless nên đây là chặn tương đối, đủ để không bị tràn hộp thư/kênh chat.
 */
const lastSent = new Map<string, number>()
const MAX_TRACKED = 200

export function shouldSend(key: string, windowMs: number, now = Date.now()): boolean {
  const last = lastSent.get(key)
  if (last !== undefined && now - last < windowMs) return false
  if (lastSent.size >= MAX_TRACKED) {
    for (const [k, t] of lastSent) if (now - t > ALERT_WINDOW_MS) lastSent.delete(k)
    if (lastSent.size >= MAX_TRACKED) lastSent.clear()
  }
  lastSent.set(key, now)
  return true
}

export function resetThrottle(): void {
  lastSent.clear()
}

export interface SentryDsn {
  endpoint: string
  key: string
}

/** DSN dạng https://<khóa>@<máy chủ>/<mã dự án> → địa chỉ nhận envelope. Sai dạng thì null. */
export function parseDsn(dsn: string | undefined): SentryDsn | null {
  if (!dsn) return null
  try {
    const url = new URL(dsn)
    const projectId = url.pathname.split('/').filter(Boolean).pop()
    if (!url.username || !projectId || !/^https?:$/.test(url.protocol)) return null
    return { endpoint: `${url.protocol}//${url.host}/api/${projectId}/envelope/`, key: url.username }
  } catch {
    return null
  }
}

function errorParts(err: unknown): { type: string; message: string; stack?: string } {
  if (err instanceof Error) return { type: err.name || 'Error', message: err.message, stack: err.stack }
  if (typeof err === 'object' && err !== null) {
    // Lỗi của Supabase/PostgREST là object thường {message, code, details}, không phải Error
    const o = err as { message?: unknown; code?: unknown; name?: unknown }
    const message = typeof o.message === 'string' ? o.message : JSON.stringify(err)
    return { type: typeof o.name === 'string' ? o.name : 'Error', message: o.code ? `${o.code}: ${message}` : message }
  }
  return { type: 'Error', message: String(err) }
}

function eventId(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

export interface MonitorEvent {
  scope: string
  level: Level
  message: string
  errorType?: string
  stack?: string
  context?: Context
}

export function buildSentryEnvelope(event: MonitorEvent, now = new Date()): string {
  const id = eventId()
  const body: Record<string, unknown> = {
    event_id: id,
    timestamp: now.getTime() / 1000,
    platform: 'node',
    level: event.level,
    logger: event.scope,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    tags: { scope: event.scope },
    extra: { ...event.context, ...(event.stack ? { stack: event.stack } : {}) },
    // Không có stack frame có cấu trúc, nên gom nhóm theo phạm vi + loại + nội dung để các lỗi khác nhau không dính vào nhau
    fingerprint: [event.scope, event.errorType ?? 'message', event.message.slice(0, 200)],
    exception: {
      values: [{ type: event.errorType ?? 'Message', value: event.message }],
    },
  }
  return [
    JSON.stringify({ event_id: id, sent_at: now.toISOString() }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(body),
  ].join('\n')
}

async function sendToSentry(event: MonitorEvent): Promise<void> {
  const dsn = parseDsn(process.env.SENTRY_DSN)
  if (!dsn || !shouldSend(`sentry:${event.scope}:${event.message.slice(0, 120)}`, SENTRY_WINDOW_MS)) return
  await fetch(dsn.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-sentry-envelope',
      'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${dsn.key}, sentry_client=sportarena/1.0`,
    },
    body: buildSentryEnvelope(event),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
}

export function formatAlert(event: MonitorEvent): string {
  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown'
  const extra = event.context && Object.keys(event.context).length > 0 ? `\n${JSON.stringify(event.context)}` : ''
  return `${event.level === 'error' ? '🚨' : '⚠️'} [SportArena/${env}] ${event.scope}: ${event.message.slice(0, 500)}${extra}`.slice(0, 1800)
}

async function sendAlert(event: MonitorEvent): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL
  if (!url || !shouldSend(`alert:${event.scope}`, ALERT_WINDOW_MS)) return
  const text = formatAlert(event)
  // Slack đọc `text`, Discord đọc `content`; mỗi bên bỏ qua trường của bên kia
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, content: text }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
}

async function deliver(event: MonitorEvent, alert: boolean): Promise<void> {
  const tasks = [sendToSentry(event)]
  if (alert) tasks.push(sendAlert(event))
  const results = await Promise.allSettled(tasks)
  for (const r of results) {
    if (r.status === 'rejected') console.warn('monitoring: không gửi được báo cáo', r.reason instanceof Error ? r.reason.message : r.reason)
  }
}

/** Gửi sau khi đã trả lời người dùng nếu đang trong một request (serverless có thể đóng băng ngay khi trả lời xong). */
function schedule(task: () => Promise<void>): void {
  const safe = () => task().catch(() => {})
  try {
    after(safe)
  } catch {
    void safe()
  }
}

function log(event: MonitorEvent): void {
  const line = `[${event.scope}] ${event.message}`
  if (event.level === 'error') console.error(line, event.context ?? '')
  else console.warn(line, event.context ?? '')
}

function errorEvent(scope: string, err: unknown, context: Context | undefined, options: Options): MonitorEvent {
  const parts = errorParts(err)
  return { scope, level: options.level ?? 'error', message: parts.message, errorType: parts.type, stack: parts.stack, context }
}

/** Ghi lỗi bắt được: log + Sentry (+ cảnh báo kênh chat nếu alert). Gọi thay cho console.error ở nơi lỗi đáng chú ý. */
export function captureError(scope: string, err: unknown, context?: Context, options: Options = {}): void {
  try {
    const event = errorEvent(scope, err, context, options)
    log(event)
    schedule(() => deliver(event, options.alert === true))
  } catch {
    // giám sát không được phép làm hỏng luồng chính
  }
}

/** Ghi một sự kiện không kèm đối tượng lỗi (vd. webhook trả 5xx, lớp bảo vệ tự tắt). */
export function captureMessage(scope: string, message: string, context?: Context, options: Options = {}): void {
  try {
    const event: MonitorEvent = { scope, level: options.level ?? 'error', message, context }
    log(event)
    schedule(() => deliver(event, options.alert === true))
  } catch {
    // như trên
  }
}

/** Dùng trong instrumentation.ts (đã ở ngoài phạm vi request, cần chờ gửi xong). */
export async function captureErrorNow(scope: string, err: unknown, context?: Context, options: Options = {}): Promise<void> {
  try {
    const event = errorEvent(scope, err, context, options)
    log(event)
    await deliver(event, options.alert === true)
  } catch {
    // như trên
  }
}
