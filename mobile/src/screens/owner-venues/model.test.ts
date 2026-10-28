import { describe, expect, it } from 'vitest'
import { buildRequest, initialValues, savedBank, type Club, type Court, type Form, type Rule } from './model'

const court: Court = {
  id: 'court-1',
  name: 'Sân 1',
  sport_type: 'football',
  surface_type: null,
  base_price_per_hour: 200000,
  deposit_percentage: 30,
  is_active: true,
  court_pricing_rules: null,
}
const rule: Rule = { id: 'rule-1', name: 'Giờ vàng', start_time: '17:00:00', end_time: '21:00:00', price_per_hour: 300000 }
const club: Club = {
  id: 'club-1',
  name: 'Sân Bình Thạnh',
  club_bank_accounts: null,
  address: '1 Nguyễn Hữu Cảnh',
  description: null,
  district: 'Bình Thạnh',
  city: null,
  open_time: '06:00:00',
  close_time: '23:00:00',
  amenities: ['Bãi xe', 'Nước uống'],
  accepts_online_payment: true,
  accepts_manual_transfer: false,
  images: null,
  latitude: null,
  longitude: null,
  courts: [court],
}

describe('savedBank', () => {
  const bank = { bank_bin: '970422', account_number: '123', account_name: 'NGUYEN VAN A' }
  it('chấp nhận đối tượng, mảng hoặc null từ PostgREST', () => {
    expect(savedBank({ ...club, club_bank_accounts: bank })).toEqual(bank)
    expect(savedBank({ ...club, club_bank_accounts: [bank] })).toEqual(bank)
    expect(savedBank({ ...club, club_bank_accounts: [] })).toBeNull()
    expect(savedBank(club)).toBeNull()
  })
})

describe('initialValues', () => {
  it('có mặc định khi tạo mới', () => {
    expect(initialValues({ kind: 'club' })).toMatchObject({ openTime: '06:00', closeTime: '23:00' })
    expect(initialValues({ kind: 'court', club })).toEqual({ basePrice: '150000', deposit: '30' })
    expect(initialValues({ kind: 'rule', court })).toMatchObject({ startTime: '17:00', endTime: '21:00', price: '200000' })
  })
  it('điền sẵn giá trị hiện có khi sửa, cắt giây khỏi giờ', () => {
    expect(initialValues({ kind: 'editClub', club })).toEqual({
      name: 'Sân Bình Thạnh',
      address: '1 Nguyễn Hữu Cảnh',
      district: 'Bình Thạnh',
      city: '',
      openTime: '06:00',
      closeTime: '23:00',
      description: '',
      amenities: 'Bãi xe, Nước uống',
    })
    expect(initialValues({ kind: 'editRule', court, rule })).toEqual({ name: 'Giờ vàng', startTime: '17:00', endTime: '21:00', price: '300000' })
    expect(initialValues({ kind: 'editCourt', court })).toMatchObject({ surface: '', basePrice: '200000', deposit: '30' })
  })
})

describe('buildRequest', () => {
  it('tạo cụm sân: tách tiện ích theo dấu phẩy và bỏ mục rỗng', () => {
    const req = buildRequest({ kind: 'club' }, { name: 'A', amenities: ' Bãi xe, ,Wifi ,' }, 'football')
    expect(req).toMatchObject({ method: 'POST', path: '/api/mobile/owner/clubs' })
    expect(req?.body.amenities).toEqual(['Bãi xe', 'Wifi'])
  })

  it('sửa cụm sân dùng PATCH theo id', () => {
    expect(buildRequest({ kind: 'editClub', club }, {}, 'football')).toMatchObject({ method: 'PATCH', path: '/api/mobile/owner/clubs/club-1' })
  })

  it('tạo sân gửi môn đã chọn và số đã ép kiểu', () => {
    const req = buildRequest({ kind: 'court', club }, { name: 'Sân 2', surface: 'Cỏ nhân tạo', basePrice: '180000', deposit: '25' }, 'tennis')
    expect(req).toEqual({
      method: 'POST',
      path: '/api/mobile/owner/clubs/club-1/courts',
      body: { name: 'Sân 2', sportType: 'tennis', surfaceType: 'Cỏ nhân tạo', basePricePerHour: 180000, depositPercentage: 25 },
    })
  })

  it('sửa sân không gửi môn thể thao', () => {
    const req = buildRequest({ kind: 'editCourt', court }, { name: 'Sân 1', surface: '', basePrice: '210000', deposit: '40' }, 'tennis')
    expect(req?.method).toBe('PATCH')
    expect(req?.body).not.toHaveProperty('sportType')
  })

  it('khung giá: thêm bằng POST, sửa bằng PATCH', () => {
    const values = { name: 'Giờ vàng', startTime: '17:00', endTime: '21:00', price: '300000' }
    expect(buildRequest({ kind: 'rule', court }, values, 'football')).toMatchObject({ method: 'POST', path: '/api/mobile/owner/courts/court-1/pricing-rules', body: { pricePerHour: 300000 } })
    expect(buildRequest({ kind: 'editRule', court, rule }, values, 'football')).toMatchObject({ method: 'PATCH', path: '/api/mobile/owner/pricing-rules/rule-1' })
  })

  it('trả null khi ô số không hợp lệ, nhưng biểu mẫu cụm sân không cần số', () => {
    const bad: Form[] = [
      { kind: 'court', club },
      { kind: 'editCourt', court },
      { kind: 'rule', court },
      { kind: 'editRule', court, rule },
    ]
    for (const form of bad) expect(buildRequest(form, { basePrice: 'abc', deposit: 'x', price: 'y' }, 'football')).toBeNull()
    expect(buildRequest({ kind: 'club' }, {}, 'football')).not.toBeNull()
  })
})
