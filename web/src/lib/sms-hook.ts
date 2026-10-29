import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Send SMS hook của Supabase Auth: thay vì Twilio..., Supabase gọi một HTTPS endpoint của mình mỗi khi cần gửi OTP, để gửi
 * qua nhà cung cấp SMS Việt Nam (SpeedSMS, eSMS). Yêu cầu được ký theo chuẩn Standard Webhooks; phải kiểm tra chữ ký, nếu
 * không ai cũng gọi được endpoint này để gửi tin nhắn tốn tiền tới số bất kỳ.
 */
export const HOOK_TOLERANCE_SECONDS = 5 * 60

export interface HookHeaders {
  id: string | null
  timestamp: string | null
  signature: string | null
}

/** Secret của hook có dạng "v1,whsec_<base64>" (Supabase Dashboard); lấy phần base64 làm khóa HMAC. */
export function hookKey(secret: string): Buffer {
  return Buffer.from(secret.replace(/^v1,/, '').replace(/^whsec_/, ''), 'base64')
}

export function signHook(secret: string, id: string, timestamp: string, body: string): string {
  return createHmac('sha256', hookKey(secret)).update(`${id}.${timestamp}.${body}`).digest('base64')
}

/**
 * Chữ ký hợp lệ khi trùng một trong các giá trị "v1,<base64>" trong header (cách nhau bằng khoảng trắng) và dấu thời gian
 * nằm trong khoảng cho phép (chống phát lại yêu cầu cũ).
 */
export function verifyHook(secret: string, headers: HookHeaders, body: string, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  const { id, timestamp, signature } = headers
  if (!secret || !id || !timestamp || !signature) return false

  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > HOOK_TOLERANCE_SECONDS) return false

  const expected = Buffer.from(signHook(secret, id, timestamp, body))
  return signature.split(' ').some((part) => {
    const [version, value] = part.split(',')
    if (version !== 'v1' || !value) return false
    const given = Buffer.from(value)
    return given.length === expected.length && timingSafeEqual(given, expected)
  })
}

export interface SmsHookPayload {
  phone: string
  otp: string
}

/** Lấy số điện thoại và mã OTP từ thân yêu cầu của Supabase: { user: { phone }, sms: { otp } } */
export function parseHookPayload(body: unknown): SmsHookPayload | null {
  const b = body as { user?: { phone?: unknown }; sms?: { otp?: unknown } } | null
  const phone = typeof b?.user?.phone === 'string' ? b.user.phone.replace(/\D/g, '') : ''
  const otp = typeof b?.sms?.otp === 'string' ? b.sms.otp : ''
  if (!/^[1-9]\d{7,14}$/.test(phone) || !/^\d{4,10}$/.test(otp)) return null
  return { phone, otp }
}

/** Số quốc tế (84901234567) → số nội địa Việt Nam (0901234567); số nước khác giữ nguyên. */
export function toLocalVn(phone: string): string {
  return phone.startsWith('84') && phone.length === 11 ? `0${phone.slice(2)}` : phone
}

/** Nội dung không dấu (tin nhắn không Unicode rẻ hơn và máy nào cũng đọc được) */
export function otpMessage(otp: string, brand = 'SportArena'): string {
  return `${brand}: Ma xac thuc cua ban la ${otp}. Co hieu luc trong vai phut, khong chia se ma nay cho bat ky ai.`
}

export type SmsProvider = 'speedsms' | 'esms'

export interface SmsRequest {
  url: string
  init: { method: 'POST'; headers: Record<string, string>; body: string }
}

export function smsProvider(env: Record<string, string | undefined> = process.env): SmsProvider | null {
  const p = env.SMS_PROVIDER?.trim().toLowerCase()
  if (p === 'speedsms' && env.SPEEDSMS_TOKEN) return 'speedsms'
  if (p === 'esms' && env.ESMS_API_KEY && env.ESMS_SECRET_KEY) return 'esms'
  return null
}

/** SpeedSMS: xác thực Basic (token là tên đăng nhập, mật khẩu "x"); sms_type 2 = tin chăm sóc khách hàng, 3 = brandname. */
export function buildSpeedSmsRequest(payload: SmsHookPayload, env: Record<string, string | undefined> = process.env): SmsRequest {
  const sender = env.SPEEDSMS_SENDER?.trim()
  const body: Record<string, unknown> = {
    to: [toLocalVn(payload.phone)],
    content: otpMessage(payload.otp, env.SMS_BRAND),
    sms_type: sender ? 3 : 2,
  }
  if (sender) body.sender = sender
  return {
    url: 'https://api.speedsms.vn/index.php/sms/send',
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${env.SPEEDSMS_TOKEN}:x`).toString('base64')}`,
      },
      body: JSON.stringify(body),
    },
  }
}

/** eSMS: SmsType 8 = tin nhắn thông báo số ngẫu nhiên, 2 = brandname (cần đăng ký Brandname và đặt ESMS_BRANDNAME). */
export function buildEsmsRequest(payload: SmsHookPayload, env: Record<string, string | undefined> = process.env): SmsRequest {
  const brandname = env.ESMS_BRANDNAME?.trim()
  return {
    url: 'https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/',
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ApiKey: env.ESMS_API_KEY,
        SecretKey: env.ESMS_SECRET_KEY,
        Phone: toLocalVn(payload.phone),
        Content: otpMessage(payload.otp, env.SMS_BRAND),
        SmsType: brandname ? '2' : '8',
        IsUnicode: '0',
        ...(brandname ? { Brandname: brandname } : {}),
      }),
    },
  }
}

/** Kết quả nhà cung cấp trả về có phải đã nhận gửi tin không */
export function smsAccepted(provider: SmsProvider, body: unknown): boolean {
  const b = body as { status?: unknown; CodeResult?: unknown } | null
  return provider === 'speedsms' ? b?.status === 'success' : String(b?.CodeResult) === '100'
}

export async function sendOtpSms(payload: SmsHookPayload, env: Record<string, string | undefined> = process.env): Promise<boolean> {
  const provider = smsProvider(env)
  if (!provider) return false
  const request = provider === 'speedsms' ? buildSpeedSmsRequest(payload, env) : buildEsmsRequest(payload, env)
  const res = await fetch(request.url, { ...request.init, signal: AbortSignal.timeout(8000) })
  const json: unknown = await res.json().catch(() => null)
  const ok = res.ok && smsAccepted(provider, json)
  if (!ok) console.error('sendOtpSms: nhà cung cấp từ chối', { provider, status: res.status })
  return ok
}
