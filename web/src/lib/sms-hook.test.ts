import { describe, expect, it } from 'vitest'
import {
  buildEsmsRequest,
  buildSpeedSmsRequest,
  otpMessage,
  parseHookPayload,
  signHook,
  smsAccepted,
  smsProvider,
  toLocalVn,
  verifyHook,
} from './sms-hook'

const SECRET = `v1,whsec_${Buffer.from('super-secret-key-bytes').toString('base64')}`
const NOW = 1_800_000_000
const body = '{"user":{"phone":"84901234567"},"sms":{"otp":"123456"}}'
const sign = (id = 'msg_1', ts = String(NOW), b = body) => `v1,${signHook(SECRET, id, ts, b)}`

describe('verifyHook', () => {
  it('chữ ký đúng và dấu thời gian còn hạn', () => {
    expect(verifyHook(SECRET, { id: 'msg_1', timestamp: String(NOW), signature: sign() }, body, NOW)).toBe(true)
  })

  it('nhận khi header có nhiều chữ ký và một trong số đó đúng', () => {
    const sig = `v1,AAAA ${sign()}`
    expect(verifyHook(SECRET, { id: 'msg_1', timestamp: String(NOW), signature: sig }, body, NOW)).toBe(true)
  })

  it('từ chối khi thân bị sửa, sai khóa hoặc sai id', () => {
    const headers = { id: 'msg_1', timestamp: String(NOW), signature: sign() }
    expect(verifyHook(SECRET, headers, body.replace('123456', '654321'), NOW)).toBe(false)
    expect(verifyHook(`v1,whsec_${Buffer.from('khac').toString('base64')}`, headers, body, NOW)).toBe(false)
    expect(verifyHook(SECRET, { ...headers, id: 'msg_2' }, body, NOW)).toBe(false)
  })

  it('từ chối yêu cầu quá cũ hoặc ở tương lai (chống phát lại)', () => {
    expect(verifyHook(SECRET, { id: 'msg_1', timestamp: String(NOW - 600), signature: sign('msg_1', String(NOW - 600)) }, body, NOW)).toBe(false)
    expect(verifyHook(SECRET, { id: 'msg_1', timestamp: String(NOW + 600), signature: sign('msg_1', String(NOW + 600)) }, body, NOW)).toBe(false)
  })

  it('từ chối khi thiếu header hoặc thiếu secret', () => {
    expect(verifyHook(SECRET, { id: null, timestamp: String(NOW), signature: sign() }, body, NOW)).toBe(false)
    expect(verifyHook(SECRET, { id: 'msg_1', timestamp: null, signature: sign() }, body, NOW)).toBe(false)
    expect(verifyHook(SECRET, { id: 'msg_1', timestamp: String(NOW), signature: null }, body, NOW)).toBe(false)
    expect(verifyHook('', { id: 'msg_1', timestamp: String(NOW), signature: sign() }, body, NOW)).toBe(false)
    expect(verifyHook(SECRET, { id: 'msg_1', timestamp: 'abc', signature: sign() }, body, NOW)).toBe(false)
  })

  it('chữ ký phiên bản khác v1 không được chấp nhận', () => {
    const v2 = sign().replace('v1,', 'v2,')
    expect(verifyHook(SECRET, { id: 'msg_1', timestamp: String(NOW), signature: v2 }, body, NOW)).toBe(false)
  })
})

describe('parseHookPayload', () => {
  it('đọc số điện thoại và OTP', () => {
    expect(parseHookPayload({ user: { phone: '84901234567' }, sms: { otp: '123456' } })).toEqual({ phone: '84901234567', otp: '123456' })
    expect(parseHookPayload({ user: { phone: '+84 901 234 567' }, sms: { otp: '123456' } })?.phone).toBe('84901234567')
  })

  it.each([null, {}, { user: {}, sms: {} }, { user: { phone: '123' }, sms: { otp: '123456' } }, { user: { phone: '84901234567' }, sms: { otp: 'abc' } }])(
    'từ chối %j',
    (b) => expect(parseHookPayload(b)).toBeNull()
  )
})

describe('toLocalVn / otpMessage', () => {
  it('đổi số Việt Nam sang dạng nội địa, giữ số nước khác', () => {
    expect(toLocalVn('84901234567')).toBe('0901234567')
    expect(toLocalVn('14155552671')).toBe('14155552671')
  })

  it('nội dung không dấu và có mã', () => {
    const m = otpMessage('123456')
    expect(m).toContain('123456')
    expect(m).toMatch(/^[\x20-\x7e]+$/)
  })
})

describe('smsProvider', () => {
  it('chỉ bật khi đủ khóa của nhà cung cấp đã chọn', () => {
    expect(smsProvider({})).toBeNull()
    expect(smsProvider({ SMS_PROVIDER: 'speedsms' })).toBeNull()
    expect(smsProvider({ SMS_PROVIDER: 'speedsms', SPEEDSMS_TOKEN: 't' })).toBe('speedsms')
    expect(smsProvider({ SMS_PROVIDER: 'esms', ESMS_API_KEY: 'k' })).toBeNull()
    expect(smsProvider({ SMS_PROVIDER: 'ESMS', ESMS_API_KEY: 'k', ESMS_SECRET_KEY: 's' })).toBe('esms')
    expect(smsProvider({ SMS_PROVIDER: 'twilio' })).toBeNull()
  })
})

describe('yêu cầu gửi tin', () => {
  const payload = { phone: '84901234567', otp: '123456' }

  it('SpeedSMS: Basic auth, số nội địa, loại tin theo có brandname hay không', () => {
    const r = buildSpeedSmsRequest(payload, { SPEEDSMS_TOKEN: 'tok' })
    expect(r.url).toBe('https://api.speedsms.vn/index.php/sms/send')
    expect(r.init.headers.Authorization).toBe(`Basic ${Buffer.from('tok:x').toString('base64')}`)
    const body = JSON.parse(r.init.body)
    expect(body).toMatchObject({ to: ['0901234567'], sms_type: 2 })
    expect(body.sender).toBeUndefined()
    expect(JSON.parse(buildSpeedSmsRequest(payload, { SPEEDSMS_TOKEN: 'tok', SPEEDSMS_SENDER: 'SPORT' }).init.body)).toMatchObject({ sms_type: 3, sender: 'SPORT' })
  })

  it('eSMS: khóa trong thân, loại tin 8 hoặc 2 khi có brandname', () => {
    const body = JSON.parse(buildEsmsRequest(payload, { ESMS_API_KEY: 'k', ESMS_SECRET_KEY: 's' }).init.body)
    expect(body).toMatchObject({ ApiKey: 'k', SecretKey: 's', Phone: '0901234567', SmsType: '8', IsUnicode: '0' })
    expect(body.Brandname).toBeUndefined()
    expect(JSON.parse(buildEsmsRequest(payload, { ESMS_API_KEY: 'k', ESMS_SECRET_KEY: 's', ESMS_BRANDNAME: 'SPORT' }).init.body)).toMatchObject({ SmsType: '2', Brandname: 'SPORT' })
  })

  it('nhận biết kết quả thành công của từng nhà cung cấp', () => {
    expect(smsAccepted('speedsms', { status: 'success' })).toBe(true)
    expect(smsAccepted('speedsms', { status: 'error' })).toBe(false)
    expect(smsAccepted('esms', { CodeResult: '100' })).toBe(true)
    expect(smsAccepted('esms', { CodeResult: 101 })).toBe(false)
    expect(smsAccepted('esms', null)).toBe(false)
  })
})
