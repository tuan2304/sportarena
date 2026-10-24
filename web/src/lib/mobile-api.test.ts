import { describe, expect, it } from 'vitest'
import { bearerToken, isUuid, MAX_NOTE_LENGTH, parseCreateBookingBody } from './mobile-api'

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
