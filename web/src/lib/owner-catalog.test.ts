import { describe, expect, it } from 'vitest'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  createClubForOwner,
  createCourtForOwner,
  createPricingRuleForOwner,
  deleteClubForOwner,
  deleteCourtForOwner,
  deletePricingRuleForOwner,
  removeBankAccountForOwner,
  saveBankAccountForOwner,
  setClubImagesForOwner,
  updateClubForOwner,
  updateClubLocationForOwner,
  updateCourtForOwner,
  updatePricingRuleForOwner,
} from './owner-catalog'

type Row = Record<string, unknown>
type Tables = Record<string, Row[]>

/**
 * Supabase giả trong bộ nhớ, đủ cho các truy vấn mà lib dùng: select/insert/update/delete lọc bằng eq, và
 * sân con tự kèm `club` để mô phỏng truy vấn lồng. Không mô phỏng RLS: quyền sở hữu phải do lib tự kiểm tra.
 */
function fakeClient(tables: Tables = {}, options: { failWith?: string } = {}) {
  const removedFiles: string[] = []
  const store: Tables = { profiles: [], clubs: [], courts: [], court_pricing_rules: [], bookings: [], payments: [], subscription_payments: [], club_bank_accounts: [], ...tables }

  function builder(table: string) {
    let op: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select'
    let payload: Row = {}
    const filters: Array<[string, unknown]> = []
    const inFilters: Array<[string, unknown[]]> = []

    const matching = () => store[table].filter((r) => filters.every(([col, val]) => r[col] === val) && inFilters.every(([col, vals]) => vals.includes(r[col])))
    const withJoins = (r: Row) => (table === 'courts' ? { ...r, club: store.clubs.find((c) => c.id === r.club_id) ?? null } : r)

    function run(): { data: Row[] | null; error: { message: string } | null } {
      if (options.failWith && op !== 'select') return { data: null, error: { message: options.failWith } }
      if (op === 'insert' || op === 'upsert') {
        if (op === 'upsert') store[table] = store[table].filter((r) => r.club_id !== payload.club_id)
        const row = op === 'upsert' ? { ...payload } : { id: 'new-id', ...payload }
        store[table].push(row)
        return { data: [row], error: null }
      }
      const rows = matching()
      if (op === 'update') rows.forEach((r) => Object.assign(r, payload))
      if (op === 'delete') store[table] = store[table].filter((r) => !rows.includes(r))
      return { data: op === 'select' ? rows.map(withJoins) : rows, error: null }
    }

    const api = {
      select: () => api,
      insert(row: Row) {
        op = 'insert'
        payload = row
        return api
      },
      upsert(row: Row) {
        op = 'upsert'
        payload = row
        return api
      },
      update(patch: Row) {
        op = 'update'
        payload = patch
        return api
      },
      delete() {
        op = 'delete'
        return api
      },
      eq(col: string, val: unknown) {
        filters.push([col, val])
        return api
      },
      in(col: string, vals: unknown[]) {
        inFilters.push([col, vals])
        return api
      },
      maybeSingle: async () => {
        const res = run()
        return { data: res.data?.[0] ?? null, error: res.error }
      },
      single: async () => {
        const res = run()
        return { data: res.data?.[0] ?? null, error: res.error }
      },
      then: (resolve: (value: unknown) => void) => resolve(run()),
    }
    return api
  }

  const client = {
    from: (table: string) => builder(table),
    storage: { from: () => ({ remove: async (paths: string[]) => (removedFiles.push(...paths), { error: null }) }) },
  }
  return { client: client as unknown as SupabaseClient<Database>, store, removedFiles }
}

const user = { id: 'user-1' } as User
const OTHER = 'someone-else'

describe('createClubForOwner', () => {
  const input = { name: ' Sân A ', address: ' 1 Lê Lợi ' }

  it('chỉ chủ sân hoặc quản trị mới tạo được', async () => {
    const { client, store } = fakeClient({ profiles: [{ id: 'user-1', role: 'player' }] })
    expect(await createClubForOwner(client, user, input)).toEqual({ error: 'Chỉ tài khoản chủ sân mới tạo được cụm sân' })
    expect(store.clubs).toHaveLength(0)
  })

  it('thiếu tên hoặc địa chỉ thì báo lỗi', async () => {
    const { client } = fakeClient({ profiles: [{ id: 'user-1', role: 'owner' }] })
    expect(await createClubForOwner(client, user, { name: 'A', address: ' ' })).toEqual({ error: 'Vui lòng nhập tên cụm sân và địa chỉ' })
  })

  it('toạ độ sai thì không ghi', async () => {
    const { client, store } = fakeClient({ profiles: [{ id: 'user-1', role: 'owner' }] })
    expect(await createClubForOwner(client, user, { ...input, latitude: '200', longitude: '10' })).toEqual({ error: 'Toạ độ vị trí không hợp lệ' })
    expect(store.clubs).toHaveLength(0)
  })

  it('tạo với giá trị mặc định và gán đúng chủ', async () => {
    const { client, store } = fakeClient({ profiles: [{ id: 'user-1', role: 'owner' }] })
    const result = await createClubForOwner(client, user, input)
    expect('success' in result).toBe(true)
    expect(store.clubs[0]).toMatchObject({
      owner_id: 'user-1',
      name: 'Sân A',
      address: '1 Lê Lợi',
      city: 'Hồ Chí Minh',
      open_time: '06:00:00',
      close_time: '23:00:00',
      amenities: ['wifi', 'parking', 'shower'],
      latitude: null,
      longitude: null,
    })
  })

  it('chuyển lỗi của database ra ngoài', async () => {
    const { client } = fakeClient({ profiles: [{ id: 'user-1', role: 'admin' }] }, { failWith: 'boom' })
    expect(await createClubForOwner(client, user, input)).toEqual({ error: 'boom' })
  })
})

describe('createCourtForOwner', () => {
  it('thiếu thông tin thì báo lỗi và không ghi', async () => {
    const { client, store } = fakeClient()
    expect(await createCourtForOwner(client, { clubId: 'c1', name: 'Sân 1' })).toEqual({ error: 'Vui lòng điền đủ thông tin sân con' })
    expect(store.courts).toHaveLength(0)
  })
})

describe('khung giá', () => {
  const rule = { courtId: 'court-1', name: 'Giờ vàng', startTime: '17:00', endTime: '21:00', pricePerHour: 250000 }

  it('giờ sai thì không ghi', async () => {
    const { client, store } = fakeClient()
    expect(await createPricingRuleForOwner(client, { ...rule, endTime: '16:00' })).toEqual({ error: 'Giờ kết thúc phải sau giờ bắt đầu' })
    expect(store.court_pricing_rules).toHaveLength(0)
  })

  it('ghi khung giá áp dụng cả tuần', async () => {
    const { client, store } = fakeClient()
    expect(await createPricingRuleForOwner(client, rule)).toEqual({ success: true })
    expect(store.court_pricing_rules[0]).toMatchObject({ court_id: 'court-1', price_per_hour: 250000, days_of_week: [1, 2, 3, 4, 5, 6, 0] })
  })

  it('sửa khung giá có kiểm tra giờ và giá, báo lỗi khi không tìm thấy', async () => {
    const { client, store } = fakeClient({ court_pricing_rules: [{ id: 'r1', name: 'Cũ', start_time: '06:00', end_time: '09:00', price_per_hour: 100000 }] })
    expect(await updatePricingRuleForOwner(client, 'r1', { name: 'Mới', startTime: '09:00', endTime: '08:00', pricePerHour: 200000 })).toEqual({ error: 'Giờ kết thúc phải sau giờ bắt đầu' })
    expect(await updatePricingRuleForOwner(client, 'r1', { name: 'Mới', startTime: '07:00', endTime: '10:00', pricePerHour: 200000 })).toEqual({ success: true })
    expect(store.court_pricing_rules[0]).toMatchObject({ name: 'Mới', start_time: '07:00', end_time: '10:00', price_per_hour: 200000 })
    expect(await updatePricingRuleForOwner(client, 'khac', { name: 'Mới', startTime: '07:00', endTime: '10:00', pricePerHour: 200000 })).toEqual({ error: 'Không tìm thấy khung giá' })
  })

  it('xóa khung giá, báo lỗi khi không có dòng nào bị xóa', async () => {
    const { client, store } = fakeClient({ court_pricing_rules: [{ id: 'r1' }] })
    expect(await deletePricingRuleForOwner(client, 'r1')).toEqual({ success: true })
    expect(store.court_pricing_rules).toHaveLength(0)
    expect(await deletePricingRuleForOwner(client, 'r1')).toEqual({ error: 'Không tìm thấy khung giá' })
  })
})

describe('sửa và xóa sân con', () => {
  const tables = () => ({
    clubs: [{ id: 'club-1', owner_id: 'user-1' }, { id: 'club-2', owner_id: OTHER }],
    courts: [
      { id: 'court-1', club_id: 'club-1', name: 'Sân 1', is_active: true },
      { id: 'court-2', club_id: 'club-2', name: 'Sân của người khác', is_active: true },
    ],
  })

  it('sửa các trường được gửi và giữ nguyên phần còn lại', async () => {
    const { client, store } = fakeClient(tables())
    expect(await updateCourtForOwner(client, user, 'court-1', { name: 'Sân VIP', basePricePerHour: 200000, isActive: false })).toEqual({ success: true })
    expect(store.courts[0]).toMatchObject({ name: 'Sân VIP', base_price_per_hour: 200000, is_active: false })
  })

  it('không sửa được sân của cụm sân khác', async () => {
    const { client, store } = fakeClient(tables())
    expect(await updateCourtForOwner(client, user, 'court-2', { name: 'Hack' })).toEqual({ error: 'Bạn không có quyền sửa sân con này' })
    expect(store.courts[1].name).toBe('Sân của người khác')
  })

  it('không xóa được sân của cụm sân khác', async () => {
    const { client, store } = fakeClient(tables())
    expect(await deleteCourtForOwner(client, client, user, 'court-2')).toEqual({ error: 'Bạn không có quyền xóa sân con này' })
    expect(store.courts).toHaveLength(2)
  })
})

describe('sửa thông tin cụm sân', () => {
  const tables = () => ({
    clubs: [
      { id: 'club-1', owner_id: 'user-1', name: 'Sân A', address: '1 Lê Lợi', description: 'Cũ', district: 'Q1', open_time: '06:00:00', close_time: '23:00:00', amenities: ['wifi'] },
      { id: 'club-2', owner_id: OTHER, name: 'Sân của người khác', address: '2 Hai Bà Trưng', open_time: '06:00:00', close_time: '23:00:00' },
    ],
  })

  it('chỉ đổi các trường được gửi và cắt khoảng trắng', async () => {
    const { client, store } = fakeClient(tables())
    expect(await updateClubForOwner(client, user, 'club-1', { name: ' Sân B ', amenities: ['wifi', 'parking'] })).toEqual({ success: true })
    expect(store.clubs[0]).toMatchObject({ name: 'Sân B', address: '1 Lê Lợi', description: 'Cũ', amenities: ['wifi', 'parking'] })
  })

  it('chuỗi rỗng xóa mô tả và quận, mảng rỗng xóa tiện ích', async () => {
    const { client, store } = fakeClient(tables())
    expect(await updateClubForOwner(client, user, 'club-1', { description: '', district: null, amenities: [] })).toEqual({ success: true })
    expect(store.clubs[0]).toMatchObject({ description: null, district: null, amenities: [] })
  })

  it('không sửa được cụm sân của người khác', async () => {
    const { client, store } = fakeClient(tables())
    expect(await updateClubForOwner(client, user, 'club-2', { name: 'Hack' })).toEqual({ error: 'Bạn không phải chủ của cụm sân này' })
    expect(store.clubs[1].name).toBe('Sân của người khác')
  })

  it('từ chối tên hoặc địa chỉ rỗng', async () => {
    const { client, store } = fakeClient(tables())
    expect(await updateClubForOwner(client, user, 'club-1', { name: '  ' })).toEqual({ error: 'Vui lòng nhập tên cụm sân và địa chỉ' })
    expect(await updateClubForOwner(client, user, 'club-1', { address: '' })).toEqual({ error: 'Vui lòng nhập tên cụm sân và địa chỉ' })
    expect(store.clubs[0]).toMatchObject({ name: 'Sân A', address: '1 Lê Lợi' })
  })

  it('giờ đóng cửa phải sau giờ mở cửa, so cả với giờ đang lưu', async () => {
    const { client, store } = fakeClient(tables())
    expect(await updateClubForOwner(client, user, 'club-1', { openTime: '22:00', closeTime: '06:00' })).toEqual({ error: 'Giờ đóng cửa phải sau giờ mở cửa' })
    // Chỉ đổi giờ mở thành 23:30 trong khi giờ đóng đang lưu là 23:00
    expect(await updateClubForOwner(client, user, 'club-1', { openTime: '23:30' })).toEqual({ error: 'Giờ đóng cửa phải sau giờ mở cửa' })
    expect(await updateClubForOwner(client, user, 'club-1', { openTime: '6h' })).toEqual({ error: 'Giờ mở cửa hoặc đóng cửa không đúng định dạng HH:MM' })
    expect(await updateClubForOwner(client, user, 'club-1', { openTime: '05:30', closeTime: '22:30' })).toEqual({ success: true })
    expect(store.clubs[0]).toMatchObject({ open_time: '05:30', close_time: '22:30' })
  })
})

describe('liên kết ngân hàng', () => {
  const tables = () => ({
    clubs: [
      { id: 'club-1', owner_id: 'user-1', accepts_manual_transfer: false },
      { id: 'club-2', owner_id: OTHER, accepts_manual_transfer: false },
    ],
  })
  const input = { bin: '970436', accountNumber: '0123 456-789', accountName: 'Nguyễn Văn Á' }

  it('lưu tài khoản đã chuẩn hóa và bật cờ nhận chuyển khoản', async () => {
    const { client, store } = fakeClient(tables())
    expect(await saveBankAccountForOwner(client, client, user, 'club-1', input)).toEqual({ success: true })
    expect(store.club_bank_accounts).toEqual([{ club_id: 'club-1', bank_bin: '970436', account_number: '0123456789', account_name: 'NGUYEN VAN A' }])
    expect(store.clubs[0].accepts_manual_transfer).toBe(true)
  })

  it('lưu lần nữa thì thay tài khoản cũ', async () => {
    const { client, store } = fakeClient(tables())
    await saveBankAccountForOwner(client, client, user, 'club-1', input)
    await saveBankAccountForOwner(client, client, user, 'club-1', { ...input, accountNumber: '999999' })
    expect(store.club_bank_accounts).toHaveLength(1)
    expect(store.club_bank_accounts[0].account_number).toBe('999999')
  })

  it('không liên kết được cho cụm sân của người khác', async () => {
    const { client, store } = fakeClient(tables())
    expect(await saveBankAccountForOwner(client, client, user, 'club-2', input)).toEqual({ error: 'Bạn không phải chủ của cụm sân này' })
    expect(await removeBankAccountForOwner(client, client, user, 'club-2')).toEqual({ error: 'Bạn không phải chủ của cụm sân này' })
    expect(store.club_bank_accounts).toHaveLength(0)
    expect(store.clubs[1].accepts_manual_transfer).toBe(false)
  })

  it('từ chối ngân hàng, số tài khoản hoặc tên không hợp lệ', async () => {
    const { client, store } = fakeClient(tables())
    expect(await saveBankAccountForOwner(client, client, user, 'club-1', { ...input, bin: '000000' })).toEqual({ error: 'Vui lòng chọn ngân hàng trong danh sách' })
    expect(await saveBankAccountForOwner(client, client, user, 'club-1', { ...input, accountNumber: '12ab' })).toEqual({ error: 'Số tài khoản chỉ gồm 6 đến 20 chữ số' })
    expect(await saveBankAccountForOwner(client, client, user, 'club-1', { ...input, accountName: '' })).toEqual({ error: 'Tên chủ tài khoản chỉ gồm chữ cái, từ 2 đến 60 ký tự' })
    expect(store.club_bank_accounts).toHaveLength(0)
    expect(store.clubs[0].accepts_manual_transfer).toBe(false)
  })

  it('gỡ tài khoản thì tắt cờ nhận chuyển khoản', async () => {
    const { client, store } = fakeClient(tables())
    await saveBankAccountForOwner(client, client, user, 'club-1', input)
    expect(await removeBankAccountForOwner(client, client, user, 'club-1')).toEqual({ success: true })
    expect(store.club_bank_accounts).toHaveLength(0)
    expect(store.clubs[0].accepts_manual_transfer).toBe(false)
  })
})

describe('cụm sân: xóa, vị trí, ảnh', () => {
  const SUPABASE = 'https://x.supabase.co'
  const tables = () => ({
    clubs: [
      { id: 'club-1', owner_id: 'user-1', images: [`${SUPABASE}/storage/v1/object/public/club-images/club-1/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg`] },
      { id: 'club-2', owner_id: OTHER, images: [] },
    ],
  })

  it('không xóa được cụm sân của người khác', async () => {
    const { client, store } = fakeClient(tables())
    expect(await deleteClubForOwner(client, client, user, 'club-2')).toEqual({ error: 'Bạn không phải chủ của cụm sân này' })
    expect(store.clubs).toHaveLength(2)
  })

  it('xóa được cụm sân của mình khi chưa có đơn nào', async () => {
    const { client, store } = fakeClient({ ...tables(), bookings: [] })
    expect(await deleteClubForOwner(client, client, user, 'club-1')).toEqual({ success: true })
    expect(store.clubs.map((c) => c.id)).toEqual(['club-2'])
  })

  it('ghim, gỡ và từ chối toạ độ sai', async () => {
    const { client, store } = fakeClient(tables())
    expect(await updateClubLocationForOwner(client, user, 'club-1', 10.7, 106.7)).toEqual({ success: true })
    expect(store.clubs[0]).toMatchObject({ latitude: 10.7, longitude: 106.7 })
    expect(await updateClubLocationForOwner(client, user, 'club-1', null, null)).toEqual({ success: true })
    expect(store.clubs[0]).toMatchObject({ latitude: null, longitude: null })
    expect(await updateClubLocationForOwner(client, user, 'club-1', 200, 10)).toEqual({ error: 'Toạ độ vị trí không hợp lệ' })
    expect(await updateClubLocationForOwner(client, user, 'club-2', 10, 10)).toEqual({ error: 'Bạn không phải chủ của cụm sân này' })
  })

  it('chỉ nhận ảnh trong kho của cụm sân và dọn file bị gỡ', async () => {
    const { client, store, removedFiles } = fakeClient(tables())
    const own = `${SUPABASE}/storage/v1/object/public/club-images/club-1/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png`
    const foreign = `${SUPABASE}/storage/v1/object/public/club-images/club-2/cccccccc-cccc-4ccc-8ccc-cccccccccccc.png`

    expect(await setClubImagesForOwner(client, user, 'club-1', [foreign], SUPABASE)).toEqual({ error: 'Có ảnh không thuộc kho ảnh của cụm sân này' })
    expect(await setClubImagesForOwner(client, user, 'club-2', [], SUPABASE)).toEqual({ error: 'Bạn không phải chủ của cụm sân này' })

    expect(await setClubImagesForOwner(client, user, 'club-1', [own], SUPABASE)).toEqual({ success: true, images: [own] })
    expect(store.clubs[0].images).toEqual([own])
    expect(removedFiles).toEqual(['club-1/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg'])
  })
})
