import { describe, expect, it } from 'vitest'
import {
  bearerToken,
  isUuid,
  MAX_NOTE_LENGTH,
  parseCreateBookingBody,
  parseCreateClubBody,
  parseCreateCourtBody,
  parseForgotPasswordBody,
  parseImagesBody,
  parseLocationBody,
  parseOwnerStatusBody,
  parsePricingRuleBody,
  parseRespondBody,
  parseBankAccountBody,
  parseUpdateClubBody,
  parseUpdateCourtBody,
} from './mobile-api'

const court = '11111111-1111-1111-1111-111111111111'
const ok = { courtId: court, startTime: '2026-11-05T11:00:00.000Z', endTime: '2026-11-05T12:00:00.000Z' }

describe('bearerToken', () => {
  it('lấy token từ header đúng dạng', () => {
    expect(bearerToken('Bearer abc.def-ghi_jkl')).toBe('abc.def-ghi_jkl')
    expect(bearerToken('  Bearer eyJhbGciOi.payload.sig  ')).toBe('eyJhbGciOi.payload.sig')
  })

  it('từ chối header thiếu, sai tên scheme hoặc có ký tự lạ', () => {
    for (const bad of [null, undefined, '', 'Bearer', 'Bearer ', 'Basic abc', 'abc', 'Bearer a b', 'Bearer a;b', 'Bearer <script>']) {
      expect(bearerToken(bad), String(bad)).toBeNull()
    }
  })
})

describe('isUuid', () => {
  it('chỉ nhận UUID', () => {
    expect(isUuid(court)).toBe(true)
    for (const bad of ['', 'abc', '../etc/passwd', `${court}x`, 1, null, undefined]) {
      expect(isUuid(bad), String(bad)).toBe(false)
    }
  })
})

describe('parseCreateBookingBody', () => {
  it('nhận thân yêu cầu hợp lệ', () => {
    expect(parseCreateBookingBody(ok)).toEqual({ ok: true, value: ok })
    expect(parseCreateBookingBody({ ...ok, note: 'Mang bóng' })).toEqual({ ok: true, value: { ...ok, note: 'Mang bóng' } })
  })

  it('bỏ ghi chú rỗng', () => {
    expect(parseCreateBookingBody({ ...ok, note: '' })).toEqual({ ok: true, value: ok })
  })

  it('từ chối dữ liệu không phải object', () => {
    for (const bad of [null, undefined, 'x', 1, [], [ok]]) {
      expect(parseCreateBookingBody(bad).ok, String(bad)).toBe(false)
    }
  })

  it('từ chối mã sân sai và thời gian sai', () => {
    expect(parseCreateBookingBody({ ...ok, courtId: 'x' }).ok).toBe(false)
    expect(parseCreateBookingBody({ ...ok, courtId: undefined }).ok).toBe(false)
    expect(parseCreateBookingBody({ ...ok, startTime: 'hôm qua' }).ok).toBe(false)
    expect(parseCreateBookingBody({ ...ok, endTime: 12345 }).ok).toBe(false)
    expect(parseCreateBookingBody({ ...ok, startTime: 'x'.repeat(100) }).ok).toBe(false)
  })

  it('từ chối ghi chú sai kiểu hoặc quá dài', () => {
    expect(parseCreateBookingBody({ ...ok, note: 5 }).ok).toBe(false)
    expect(parseCreateBookingBody({ ...ok, note: 'x'.repeat(MAX_NOTE_LENGTH + 1) }).ok).toBe(false)
    expect(parseCreateBookingBody({ ...ok, note: 'x'.repeat(MAX_NOTE_LENGTH) }).ok).toBe(true)
  })

  it('bỏ qua các trường lạ (không đi vào giá trị trả về)', () => {
    const r = parseCreateBookingBody({ ...ok, userId: 'kẻ-gian', totalPrice: 1, status: 'confirmed' })
    expect(r).toEqual({ ok: true, value: ok })
  })
})

describe('parseCreateBookingBody: mở kèo ghép', () => {
  const match = { title: 'Kèo tối thứ 5', requiredPlayers: 4, skillLevel: 'intermediate', costSharingType: 'split' }

  it('nhận cấu hình kèo hợp lệ và gắn isOpenMatch', () => {
    const res = parseCreateBookingBody({ ...ok, match })
    expect(res).toEqual({ ok: true, value: { ...ok, match: { ...match, isOpenMatch: true } } })
  })

  it('điền mặc định trình độ và cách chia chi phí', () => {
    const res = parseCreateBookingBody({ ...ok, match: { requiredPlayers: 6 } })
    expect(res.ok && res.value.match).toMatchObject({ skillLevel: 'all', costSharingType: 'split', requiredPlayers: 6 })
  })

  it('không nhận chi phí mỗi người từ app', () => {
    const res = parseCreateBookingBody({ ...ok, match: { ...match, costPerPerson: 1 } })
    expect(res.ok && res.value.match).not.toHaveProperty('costPerPerson')
  })

  it('từ chối cấu hình sai', () => {
    for (const bad of [
      'x',
      [],
      { ...match, requiredPlayers: 1 },
      { ...match, requiredPlayers: 51 },
      { ...match, requiredPlayers: 4.5 },
      { ...match, requiredPlayers: '4' },
      { ...match, skillLevel: 'god' },
      { ...match, costSharingType: 'free' },
      { ...match, title: 'x'.repeat(101) },
      { ...match, description: 'x'.repeat(501) },
    ]) {
      expect(parseCreateBookingBody({ ...ok, match: bad }).ok, JSON.stringify(bad)).toBe(false)
    }
  })

  it('bỏ qua match null', () => {
    expect(parseCreateBookingBody({ ...ok, match: null })).toEqual({ ok: true, value: ok })
  })
})

describe('parseOwnerStatusBody', () => {
  it('nhận ba trạng thái hợp lệ', () => {
    for (const status of ['confirmed', 'cancelled', 'completed']) {
      expect(parseOwnerStatusBody({ status })).toEqual({ ok: true, value: { status } })
    }
  })

  it('từ chối trạng thái lạ và dữ liệu sai dạng', () => {
    for (const bad of [{ status: 'pending' }, { status: 'refunded' }, { status: '' }, { status: 1 }, {}, null, 'x', [], undefined]) {
      expect(parseOwnerStatusBody(bad).ok, JSON.stringify(bad)).toBe(false)
    }
  })
})

describe('parseRespondBody', () => {
  it('chỉ nhận accepted hoặc rejected', () => {
    expect(parseRespondBody({ status: 'accepted' })).toEqual({ ok: true, value: { status: 'accepted' } })
    expect(parseRespondBody({ status: 'rejected' })).toEqual({ ok: true, value: { status: 'rejected' } })
    for (const bad of [{ status: 'pending' }, { status: 'left' }, { status: '' }, {}, null, 'x', [], 1]) {
      expect(parseRespondBody(bad).ok, JSON.stringify(bad)).toBe(false)
    }
  })
})


describe('parseCreateClubBody', () => {
  const base = { name: '  Sân Quận 7 ', address: '12 Nguyễn Văn Linh' }

  it('nhận dữ liệu tối thiểu và cắt khoảng trắng', () => {
    expect(parseCreateClubBody(base)).toEqual({ ok: true, value: { name: 'Sân Quận 7', address: '12 Nguyễn Văn Linh' } })
  })

  it('nhận đầy đủ trường tùy chọn', () => {
    const parsed = parseCreateClubBody({ ...base, district: 'Q7', city: 'HCM', openTime: '06:00', closeTime: '22:30', amenities: ['wifi', ' parking '], latitude: 10.7, longitude: 106.7 })
    expect(parsed).toEqual({
      ok: true,
      value: { name: 'Sân Quận 7', address: '12 Nguyễn Văn Linh', district: 'Q7', city: 'HCM', openTime: '06:00', closeTime: '22:30', amenities: ['wifi', 'parking'], latitude: 10.7, longitude: 106.7 },
    })
  })

  it('từ chối tên hoặc địa chỉ trống hoặc quá dài, và thân sai kiểu', () => {
    for (const bad of [{}, { ...base, name: ' ' }, { ...base, name: 'a'.repeat(101) }, { ...base, address: '' }, { ...base, address: 'a'.repeat(201) }, null, 'x', []]) {
      expect(parseCreateClubBody(bad).ok, JSON.stringify(bad)).toBe(false)
    }
  })

  it('từ chối giờ sai định dạng hoặc đóng cửa trước giờ mở', () => {
    expect(parseCreateClubBody({ ...base, openTime: '6h' }).ok).toBe(false)
    expect(parseCreateClubBody({ ...base, openTime: '25:00' }).ok).toBe(false)
    expect(parseCreateClubBody({ ...base, openTime: '22:00', closeTime: '06:00' }).ok).toBe(false)
  })

  it('từ chối tiện ích sai và toạ độ thiếu một nửa hoặc sai kiểu', () => {
    expect(parseCreateClubBody({ ...base, amenities: 'wifi' }).ok).toBe(false)
    expect(parseCreateClubBody({ ...base, amenities: [1] }).ok).toBe(false)
    expect(parseCreateClubBody({ ...base, amenities: Array(21).fill('a') }).ok).toBe(false)
    expect(parseCreateClubBody({ ...base, latitude: 10 }).ok).toBe(false)
    expect(parseCreateClubBody({ ...base, latitude: '10', longitude: '106' }).ok).toBe(false)
  })
})

describe('parseCreateCourtBody', () => {
  const base = { name: 'Sân 1', sportType: 'pickleball', basePricePerHour: 150000, depositPercentage: 30 }

  it('nhận dữ liệu hợp lệ và làm tròn giá', () => {
    expect(parseCreateCourtBody({ ...base, basePricePerHour: 150000.4, surfaceType: ' Cỏ nhân tạo ' })).toEqual({
      ok: true,
      value: { name: 'Sân 1', sportType: 'pickleball', surfaceType: 'Cỏ nhân tạo', basePricePerHour: 150000, depositPercentage: 30 },
    })
  })

  it('từ chối môn lạ, giá ngoài khoảng, cọc ngoài 1-100 hoặc không nguyên', () => {
    for (const bad of [
      { ...base, sportType: 'chess' },
      { ...base, name: '' },
      { ...base, basePricePerHour: 500 },
      { ...base, basePricePerHour: 60_000_000 },
      { ...base, basePricePerHour: '150000' },
      { ...base, depositPercentage: 0 },
      { ...base, depositPercentage: 101 },
      { ...base, depositPercentage: 30.5 },
      null,
    ]) {
      expect(parseCreateCourtBody(bad).ok, JSON.stringify(bad)).toBe(false)
    }
  })
})

describe('parsePricingRuleBody', () => {
  it('chỉ chặn sai kiểu, phần kiểm tra giờ và giá do validatePricingRule làm', () => {
    const rule = { name: 'Giờ vàng', startTime: '17:00', endTime: '21:00', pricePerHour: 250000 }
    expect(parsePricingRuleBody(rule)).toEqual({ ok: true, value: rule })
    for (const bad of [{}, { ...rule, pricePerHour: '250000' }, { ...rule, name: 5 }, { ...rule, startTime: null }, null, []]) {
      expect(parsePricingRuleBody(bad).ok, JSON.stringify(bad)).toBe(false)
    }
  })
})

describe('parseUpdateCourtBody', () => {
  it('chỉ giữ trường được gửi', () => {
    expect(parseUpdateCourtBody({ name: ' Sân VIP ', isActive: false })).toEqual({ ok: true, value: { name: 'Sân VIP', isActive: false } })
    expect(parseUpdateCourtBody({ basePricePerHour: 200000.2, depositPercentage: 50 })).toEqual({ ok: true, value: { basePricePerHour: 200000, depositPercentage: 50 } })
  })

  it('từ chối thân rỗng và giá trị sai', () => {
    for (const bad of [{}, null, [], { name: '' }, { name: 'a'.repeat(81) }, { basePricePerHour: 10 }, { depositPercentage: 0 }, { depositPercentage: 101 }, { isActive: 'yes' }]) {
      expect(parseUpdateCourtBody(bad).ok, JSON.stringify(bad)).toBe(false)
    }
  })
})

describe('parseUpdateClubBody', () => {
  it('chỉ giữ trường được gửi', () => {
    expect(parseUpdateClubBody({ name: ' Sân B ', openTime: '05:30' })).toEqual({ ok: true, value: { name: 'Sân B', openTime: '05:30' } })
    expect(parseUpdateClubBody({ amenities: ['wifi', ' parking '], city: ' HCM ' })).toEqual({ ok: true, value: { amenities: ['wifi', 'parking'], city: 'HCM' } })
  })

  it('chuỗi rỗng xóa mô tả và quận, mảng rỗng xóa tiện ích, thành phố rỗng thì bỏ qua', () => {
    expect(parseUpdateClubBody({ description: '', district: null, amenities: [], city: '' })).toEqual({ ok: true, value: { description: null, district: null, amenities: [] } })
  })

  it('từ chối thân rỗng và giá trị sai', () => {
    const bad = [{}, null, [], { name: '' }, { name: 'a'.repeat(101) }, { address: ' ' }, { description: 'a'.repeat(1001) }, { openTime: '6h' }, { openTime: '25:00' },
      { openTime: '22:00', closeTime: '06:00' }, { amenities: 'wifi' }, { amenities: [1] }, { amenities: Array(21).fill('a') }]
    for (const body of bad) expect(parseUpdateClubBody(body).ok, JSON.stringify(body)).toBe(false)
  })
})

describe('parseBankAccountBody', () => {
  it('nhận ba chuỗi', () => {
    const body = { bin: '970436', accountNumber: '0123456789', accountName: 'NGUYEN VAN A' }
    expect(parseBankAccountBody(body)).toEqual({ ok: true, value: body })
  })

  it('từ chối thiếu trường, sai kiểu hoặc không phải đối tượng', () => {
    for (const bad of [{}, null, [], { bin: '970436', accountNumber: 123456, accountName: 'A' }, { bin: '970436', accountNumber: '123456' }]) {
      expect(parseBankAccountBody(bad).ok, JSON.stringify(bad)).toBe(false)
    }
  })
})

describe('parseLocationBody', () => {
  it('nhận hai số hoặc hai null', () => {
    expect(parseLocationBody({ latitude: 10.7, longitude: 106.7 })).toEqual({ ok: true, value: { latitude: 10.7, longitude: 106.7 } })
    expect(parseLocationBody({ latitude: null, longitude: null })).toEqual({ ok: true, value: { latitude: null, longitude: null } })
  })

  it('từ chối thiếu một nửa, sai kiểu hoặc không có', () => {
    for (const bad of [{}, { latitude: 10 }, { latitude: 10, longitude: null }, { latitude: '10', longitude: '106' }, null]) {
      expect(parseLocationBody(bad).ok, JSON.stringify(bad)).toBe(false)
    }
  })
})

describe('parseForgotPasswordBody', () => {
  it('chuẩn hóa email hợp lệ', () => {
    expect(parseForgotPasswordBody({ email: ' A@B.com ' })).toEqual({ ok: true, value: { email: 'a@b.com' } })
  })

  it('từ chối email sai hoặc thân không phải object', () => {
    for (const bad of [{}, { email: 'abc' }, { email: 5 }, null, [], 'a@b.com']) {
      expect(parseForgotPasswordBody(bad).ok, JSON.stringify(bad)).toBe(false)
    }
  })
})

describe('parseImagesBody', () => {
  it('nhận danh sách chuỗi ngắn, tối đa 8', () => {
    expect(parseImagesBody({ images: [] })).toEqual({ ok: true, value: { images: [] } })
    expect(parseImagesBody({ images: ['https://a/b.jpg'] }).ok).toBe(true)
  })

  it('từ chối danh sách quá dài, phần tử sai kiểu hoặc URL quá dài', () => {
    for (const bad of [{}, { images: 'x' }, { images: Array(9).fill('a') }, { images: [1] }, { images: ['a'.repeat(501)] }, null]) {
      expect(parseImagesBody(bad).ok, JSON.stringify(bad)).toBe(false)
    }
  })
})
