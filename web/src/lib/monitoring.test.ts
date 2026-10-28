import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// `after` chỉ chạy trong một request; ngoài request nó ném lỗi và monitoring phải tự chạy ngay
vi.mock('next/server', () => ({
  after: () => {
    throw new Error('outside request scope')
  },
}))

import { buildSentryEnvelope, captureError, captureMessage, formatAlert, parseDsn, resetThrottle, shouldSend } from '@/lib/monitoring'

const DSN = 'https://abc123@o1.ingest.sentry.io/4507'

describe('parseDsn', () => {
  it('trích địa chỉ nhận envelope và khóa', () => {
    expect(parseDsn(DSN)).toEqual({ endpoint: 'https://o1.ingest.sentry.io/api/4507/envelope/', key: 'abc123' })
  })

  it('DSN thiếu khóa, thiếu mã dự án hoặc sai dạng thì null', () => {
    expect(parseDsn(undefined)).toBeNull()
    expect(parseDsn('')).toBeNull()
    expect(parseDsn('not a url')).toBeNull()
    expect(parseDsn('https://o1.ingest.sentry.io/4507')).toBeNull()
    expect(parseDsn('https://abc@o1.ingest.sentry.io/')).toBeNull()
    expect(parseDsn('ftp://abc@o1.ingest.sentry.io/4507')).toBeNull()
  })
})

describe('buildSentryEnvelope', () => {
  it('gồm 3 dòng JSON: tiêu đề, loại, sự kiện', () => {
    const lines = buildSentryEnvelope({ scope: 'x', level: 'error', message: 'boom', errorType: 'TypeError', context: { a: 1 } }).split('\n')
    expect(lines).toHaveLength(3)
    const [header, item, event] = lines.map((l) => JSON.parse(l))
    expect(item).toEqual({ type: 'event' })
    expect(header.event_id).toBe(event.event_id)
    expect(event.event_id).toMatch(/^[0-9a-f]{32}$/)
    expect(event.exception.values[0]).toEqual({ type: 'TypeError', value: 'boom' })
    expect(event.tags).toEqual({ scope: 'x' })
    expect(event.extra).toMatchObject({ a: 1 })
    expect(event.fingerprint).toEqual(['x', 'TypeError', 'boom'])
  })
})

describe('formatAlert', () => {
  it('có phạm vi, nội dung, ngữ cảnh và không dài quá giới hạn của Discord', () => {
    const text = formatAlert({ scope: 'payos.webhook', level: 'error', message: 'm'.repeat(5000), context: { status: 500 } })
    expect(text).toContain('payos.webhook')
    expect(text).toContain('🚨')
    expect(text.length).toBeLessThanOrEqual(1800)
    expect(formatAlert({ scope: 's', level: 'warning', message: 'hi', context: { status: 500 } })).toContain('⚠️')
  })
})

describe('shouldSend', () => {
  beforeEach(resetThrottle)

  it('cùng khóa chỉ gửi một lần trong cửa sổ, khóa khác thì gửi', () => {
    expect(shouldSend('a', 1000, 0)).toBe(true)
    expect(shouldSend('a', 1000, 999)).toBe(false)
    expect(shouldSend('b', 1000, 999)).toBe(true)
    expect(shouldSend('a', 1000, 1000)).toBe(true)
  })
})

describe('captureError / captureMessage', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    resetThrottle()
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(new Response('ok'))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  const settle = () => new Promise((r) => setTimeout(r, 0))

  it('không cấu hình gì thì chỉ ghi log, không gọi mạng', async () => {
    vi.stubEnv('SENTRY_DSN', '')
    vi.stubEnv('ALERT_WEBHOOK_URL', '')
    captureError('t', new Error('x'), undefined, { alert: true })
    await settle()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalled()
  })

  it('có SENTRY_DSN thì gửi envelope tới đúng địa chỉ', async () => {
    vi.stubEnv('SENTRY_DSN', DSN)
    captureError('t', new Error('x'), { id: 1 })
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://o1.ingest.sentry.io/api/4507/envelope/')
    expect(init.headers['X-Sentry-Auth']).toContain('sentry_key=abc123')
  })

  it('chỉ lời gọi có alert mới tới webhook cảnh báo, và gửi cả text lẫn content', async () => {
    vi.stubEnv('ALERT_WEBHOOK_URL', 'https://hooks.example/abc')
    captureMessage('quiet', 'chỉ log')
    captureMessage('loud', 'sự cố', { n: 1 }, { alert: true })
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://hooks.example/abc')
    const body = JSON.parse(init.body)
    expect(body.text).toBe(body.content)
    expect(body.text).toContain('loud')
  })

  it('cùng sự cố lặp lại liên tục chỉ cảnh báo một lần', async () => {
    vi.stubEnv('ALERT_WEBHOOK_URL', 'https://hooks.example/abc')
    for (let i = 0; i < 5; i++) captureMessage('rate-limit.fail-open', 'tắt', {}, { alert: true })
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('gửi thất bại không ném lỗi ra ngoài', async () => {
    vi.stubEnv('SENTRY_DSN', DSN)
    vi.stubEnv('ALERT_WEBHOOK_URL', 'https://hooks.example/abc')
    fetchMock.mockRejectedValue(new Error('network down'))
    expect(() => captureError('t', new Error('x'), undefined, { alert: true })).not.toThrow()
    await settle()
    expect(console.warn).toHaveBeenCalled()
  })

  it('nhận cả lỗi dạng object thường của Supabase', async () => {
    vi.stubEnv('SENTRY_DSN', DSN)
    captureError('t', { message: 'permission denied', code: '42501' })
    await settle()
    const event = JSON.parse(fetchMock.mock.calls[0][1].body.split('\n')[2])
    expect(event.exception.values[0].value).toBe('42501: permission denied')
  })
})
