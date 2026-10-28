export const SPORTS = ['football', 'badminton', 'pickleball', 'tennis', 'basketball'] as const
export type Sport = (typeof SPORTS)[number]

export interface Rule {
  id: string
  name: string
  start_time: string
  end_time: string
  price_per_hour: number
}
export interface Court {
  id: string
  name: string
  sport_type: string
  surface_type: string | null
  base_price_per_hour: number
  deposit_percentage: number
  is_active: boolean
  court_pricing_rules: Rule[] | null
}
export interface BankAccount {
  bank_bin: string
  account_number: string
  account_name: string
}
export interface Club {
  id: string
  name: string
  /** Chỉ chủ cụm sân đọc được (RLS). PostgREST trả đối tượng hoặc null cho quan hệ 1-1, mảng nếu không nhận ra 1-1 */
  club_bank_accounts: BankAccount | BankAccount[] | null
  address: string
  description: string | null
  district: string | null
  city: string | null
  open_time: string
  close_time: string
  amenities: string[] | null
  accepts_online_payment: boolean | null
  accepts_manual_transfer: boolean | null
  images: string[] | null
  latitude: number | null
  longitude: number | null
  courts: Court[] | null
}

export type Form =
  | { kind: 'club' }
  | { kind: 'editClub'; club: Club }
  | { kind: 'court'; club: Club }
  | { kind: 'rule'; court: Court }
  | { kind: 'editCourt'; court: Court }
  | { kind: 'editRule'; court: Court; rule: Rule }

export const SELECT = `
  id, name, address, description, district, city, open_time, close_time, amenities, accepts_online_payment, accepts_manual_transfer,
  images, latitude, longitude,
  club_bank_accounts ( bank_bin, account_number, account_name ),
  courts ( id, name, sport_type, surface_type, base_price_per_hour, deposit_percentage, is_active,
    court_pricing_rules ( id, name, start_time, end_time, price_per_hour ) )
`

export const hhmm = (time: string) => time.slice(0, 5)

export const savedBank = (club: Club): BankAccount | null => (Array.isArray(club.club_bank_accounts) ? club.club_bank_accounts[0] : club.club_bank_accounts) ?? null

/** Giá trị ban đầu của biểu mẫu: mặc định khi tạo, giá trị hiện có khi sửa. */
export function initialValues(form: Form): Record<string, string> {
  switch (form.kind) {
    case 'club':
      return { openTime: '06:00', closeTime: '23:00', city: 'Hồ Chí Minh' }
    case 'editClub': {
      const c = form.club
      return {
        name: c.name,
        address: c.address,
        district: c.district ?? '',
        city: c.city ?? '',
        openTime: hhmm(c.open_time),
        closeTime: hhmm(c.close_time),
        description: c.description ?? '',
        amenities: (c.amenities ?? []).join(', '),
      }
    }
    case 'court':
      return { basePrice: '150000', deposit: '30' }
    case 'rule':
      return { startTime: '17:00', endTime: '21:00', price: String(form.court.base_price_per_hour) }
    case 'editCourt':
      return {
        name: form.court.name,
        surface: form.court.surface_type ?? '',
        basePrice: String(form.court.base_price_per_hour),
        deposit: String(form.court.deposit_percentage),
      }
    case 'editRule':
      return { name: form.rule.name, startTime: hhmm(form.rule.start_time), endTime: hhmm(form.rule.end_time), price: String(form.rule.price_per_hour) }
  }
}

export interface OwnerRequest {
  method: 'POST' | 'PATCH'
  path: string
  body: Record<string, unknown>
}

/**
 * Dựng yêu cầu gửi lên API của máy chủ từ biểu mẫu đã nhập. Trả null khi một ô số không phải số
 * (máy chủ vẫn kiểm tra lại, đây chỉ để báo lỗi sớm thay vì gửi NaN).
 */
export function buildRequest(form: Form, values: Record<string, string>, sport: Sport): OwnerRequest | null {
  const v = (key: string) => values[key] ?? ''
  const basePricePerHour = Number(v('basePrice'))
  const depositPercentage = Number(v('deposit'))
  const pricePerHour = Number(v('price'))

  const clubBody = () => ({
    name: v('name'),
    address: v('address'),
    district: v('district'),
    city: v('city'),
    description: v('description'),
    openTime: v('openTime'),
    closeTime: v('closeTime'),
    amenities: v('amenities').split(',').map((item) => item.trim()).filter(Boolean),
  })
  const ruleBody = () => ({ name: v('name'), startTime: v('startTime'), endTime: v('endTime'), pricePerHour })

  switch (form.kind) {
    case 'club':
      return { method: 'POST', path: '/api/mobile/owner/clubs', body: clubBody() }
    case 'editClub':
      return { method: 'PATCH', path: `/api/mobile/owner/clubs/${form.club.id}`, body: clubBody() }
    case 'court':
      if (Number.isNaN(basePricePerHour) || Number.isNaN(depositPercentage)) return null
      return {
        method: 'POST',
        path: `/api/mobile/owner/clubs/${form.club.id}/courts`,
        body: { name: v('name'), sportType: sport, surfaceType: v('surface'), basePricePerHour, depositPercentage },
      }
    case 'editCourt':
      if (Number.isNaN(basePricePerHour) || Number.isNaN(depositPercentage)) return null
      return {
        method: 'PATCH',
        path: `/api/mobile/owner/courts/${form.court.id}`,
        body: { name: v('name'), surfaceType: v('surface'), basePricePerHour, depositPercentage },
      }
    case 'rule':
      if (Number.isNaN(pricePerHour)) return null
      return { method: 'POST', path: `/api/mobile/owner/courts/${form.court.id}/pricing-rules`, body: ruleBody() }
    case 'editRule':
      if (Number.isNaN(pricePerHour)) return null
      return { method: 'PATCH', path: `/api/mobile/owner/pricing-rules/${form.rule.id}`, body: ruleBody() }
  }
}
