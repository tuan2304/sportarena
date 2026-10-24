import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const deleteIn = vi.fn()
const adminClient = {
  from: vi.fn(() => ({ delete: () => ({ in: (...args: unknown[]) => deleteIn(...args) }) })),
}
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => adminClient }))

import { buildExpoMessages, chunk, deadTokens, isExpoPushToken, sendPushToTokens } from './push'

const tokenA = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]'
const tokenB = 'ExpoPushToken[bbbbbbbbbbbbbbbbbbbbbb]'
const payload = { title: 'Có người xin vào kèo', message: 'Mở app để duyệt', link: '/matches/123' }

describe('isExpoPushToken', () => {
  it('chỉ nhận token Expo đúng dạng', () => {
    expect(isExpoPushToken(tokenA)).toBe(true)
    expect(isExpoPushToken(tokenB)).toBe(true)
    for (const bad of ['', 'abc', 'ExponentPushToken[]', 'ExponentPushToken[a b]', 'fcm:APA91b...', null, 1]) {
      expect(isExpoPushToken(bad), String(bad)).toBe(false)
    }
  })
})

describe('buildExpoMessages', () => {
  it('dựng tin cho từng token hợp lệ, bỏ token sai và trùng', () => {
    const messages = buildExpoMessages([tokenA, 'rác', tokenA, tokenB], payload)
    expect(messages.map((m) => m.to)).toEqual([tokenA, tokenB])
    expect(messages[0]).toMatchObject({ title: payload.title, body: payload.message, sound: 'default', data: { link: '/matches/123' } })
  })

  it('chỉ giữ đường dẫn nội bộ trong data', () => {
    for (const link of ['https://evil.example', '//evil.example', 'javascript:alert(1)', '', null, undefined]) {
      expect(buildExpoMessages([tokenA], { ...payload, link })[0].data, String(link)).toEqual({})
    }
  })

  it('cắt tiêu đề và nội dung quá dài', () => {
    const [m] = buildExpoMessages([tokenA], { title: 'x'.repeat(500), message: 'y'.repeat(500) })
    expect(m.title.length).toBe(120)
    expect(m.body.length).toBe(240)
  })
})

describe('chunk', () => {
  it('chia lô đúng kích thước', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 3)).toEqual([])
  })
})

describe('deadTokens', () => {
  it('chỉ trả token mà Expo báo thiết bị không còn đăng ký', () => {
    const messages = buildExpoMessages([tokenA, tokenB], payload)
    const tickets = [
      { status: 'error' as const, details: { error: 'DeviceNotRegistered' } },
      { status: 'error' as const, details: { error: 'MessageRateExceeded' } },
    ]
    expect(deadTokens(messages, tickets)).toEqual([tokenA])
    expect(deadTokens(messages, [{ status: 'ok' }, { status: 'ok' }])).toEqual([])
  })
})

describe('sendPushToTokens', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
    deleteIn.mockReset().mockResolvedValue({ error: null })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('không gọi mạng khi không có token hợp lệ', async () => {
    expect(await sendPushToTokens(['rác'], payload)).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('gửi một lô và xóa token hỏng khỏi database', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }] }),
    })
    expect(await sendPushToTokens([tokenA, tokenB], payload)).toBe(2)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://exp.host/--/api/v2/push/send')
    expect(JSON.parse(init.body)).toHaveLength(2)
    expect(deleteIn).toHaveBeenCalledWith('token', [tokenB])
  })

  it('chia thành nhiều lô khi quá 100 token', async () => {
    const many = Array.from({ length: 150 }, (_, i) => `ExponentPushToken[${String(i).padStart(12, 'x')}]`)
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) })
    expect(await sendPushToTokens(many, payload)).toBe(150)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('lỗi mạng hoặc Expo trả lỗi không ném ra ngoài và không tính là đã gửi', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
    expect(await sendPushToTokens([tokenA], payload)).toBe(0)
    fetchMock.mockRejectedValueOnce(new Error('network'))
    expect(await sendPushToTokens([tokenA], payload)).toBe(0)
  })
})
