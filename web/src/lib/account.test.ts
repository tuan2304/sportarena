import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'

const signIn = vi.fn()
const signOut = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { signInWithPassword: signIn, signOut } }),
}))
const enforce = vi.fn()
vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: (...args: unknown[]) => enforce(...args) }))
vi.mock('@/lib/monitoring', () => ({ captureError: vi.fn(), captureMessage: vi.fn() }))

import { blockerMessages, buildDataExport, deleteAccount, handleDeleteRequest, isDeleteConfirmation, requiresPassword } from '@/lib/account'

const USER_ID = 'a0000000-0000-0000-0000-00000000000a'

function user(providers: string[], email = 'a@example.com'): User {
  return {
    id: USER_ID,
    email,
    phone: '',
    created_at: '2026-01-01T00:00:00Z',
    app_metadata: { providers },
  } as unknown as User
}

interface Calls {
  order: string[]
  deleteUser: Array<[string, boolean]>
}

/** Admin giả: mỗi RPC trả kết quả cấu hình sẵn, ghi lại thứ tự gọi. */
function fakeAdmin(opts: {
  blockers?: string[] | null
  blockersError?: boolean
  anonymize?: { data?: boolean; error?: { message: string } }
  authError?: boolean
  exportData?: unknown
  exportError?: boolean
}) {
  const calls: Calls = { order: [], deleteUser: [] }
  const admin = {
    rpc: async (name: string) => {
      calls.order.push(name)
      if (name === 'account_deletion_blockers') {
        return opts.blockersError ? { data: null, error: { message: 'boom' } } : { data: opts.blockers ?? [], error: null }
      }
      if (name === 'anonymize_user') return { data: opts.anonymize?.data ?? false, error: opts.anonymize?.error ?? null }
      if (name === 'export_user_data') {
        return opts.exportError ? { data: null, error: { message: 'boom' } } : { data: opts.exportData ?? { profile: { full_name: 'A' } }, error: null }
      }
      return { data: null, error: { message: `rpc ${name} chưa giả lập` } }
    },
    storage: {
      from: () => ({
        list: async () => ({ data: [{ name: 'a.png' }], error: null }),
        remove: async () => {
          calls.order.push('remove-avatars')
          return { error: null }
        },
      }),
    },
    auth: {
      admin: {
        deleteUser: async (id: string, soft: boolean) => {
          calls.order.push('deleteUser')
          calls.deleteUser.push([id, soft])
          return { error: opts.authError ? { message: 'auth down' } : null }
        },
      },
    },
  }
  return { admin: admin as never, calls }
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon')
  signIn.mockReset()
  signOut.mockReset()
  signOut.mockResolvedValue({ error: null })
  enforce.mockReset()
  enforce.mockResolvedValue(null)
})

describe('isDeleteConfirmation', () => {
  it('nhận XÓA / XOA / DELETE không phân biệt hoa thường và khoảng trắng', () => {
    for (const ok of ['XÓA', 'xóa', ' Xóa ', 'XOA', 'delete', 'DELETE ']) expect(isDeleteConfirmation(ok)).toBe(true)
  })

  it('từ chối câu khác, rỗng hoặc không phải chuỗi', () => {
    for (const bad of ['', 'xoa tai khoan', 'del', 'XÓA!', null, undefined, 1, {}]) expect(isDeleteConfirmation(bad)).toBe(false)
  })
})

describe('requiresPassword', () => {
  it('chỉ tài khoản có đăng nhập email mới cần mật khẩu', () => {
    expect(requiresPassword(user(['email']))).toBe(true)
    expect(requiresPassword(user(['email', 'google']))).toBe(true)
    expect(requiresPassword(user(['google']))).toBe(false)
    expect(requiresPassword(user(['phone'], ''))).toBe(false)
    expect(requiresPassword(user([]))).toBe(false)
    expect(requiresPassword(user(['email'], ''))).toBe(false)
  })
})

describe('blockerMessages', () => {
  it('mỗi mã chặn có một câu giải thích, mã lạ bị bỏ qua', () => {
    const codes = ['admin', 'active_bookings', 'refund_owed', 'club_active_bookings', 'club_refunds_pending']
    expect(blockerMessages(codes)).toHaveLength(5)
    expect(blockerMessages(['unknown'])).toEqual([])
  })
})

describe('deleteAccount', () => {
  it('còn việc dang dở thì từ chối và KHÔNG xóa gì', async () => {
    const { admin, calls } = fakeAdmin({ blockers: ['active_bookings'] })
    const res = await deleteAccount(admin, USER_ID)
    expect(res).toMatchObject({ ok: false, status: 409, blockers: ['active_bookings'] })
    expect(calls.order).toEqual(['account_deletion_blockers'])
  })

  it('còn sổ sách tài chính → xóa mềm, ẩn danh trước rồi mới đóng tài khoản đăng nhập', async () => {
    const { admin, calls } = fakeAdmin({ anonymize: { data: true } })
    const res = await deleteAccount(admin, USER_ID)
    expect(res).toEqual({ ok: true, mode: 'anonymized' })
    expect(calls.deleteUser).toEqual([[USER_ID, true]])
    expect(calls.order).toEqual(['account_deletion_blockers', 'anonymize_user', 'remove-avatars', 'deleteUser'])
  })

  it('không còn gì phải giữ → xóa cứng', async () => {
    const { admin, calls } = fakeAdmin({ anonymize: { data: false } })
    expect(await deleteAccount(admin, USER_ID)).toEqual({ ok: true, mode: 'deleted' })
    expect(calls.deleteUser).toEqual([[USER_ID, false]])
  })

  it('ẩn danh lỗi thì dừng, không đụng tới tài khoản đăng nhập', async () => {
    const { admin, calls } = fakeAdmin({ anonymize: { error: { message: 'db down' } } })
    const res = await deleteAccount(admin, USER_ID)
    expect(res).toMatchObject({ ok: false, status: 500 })
    expect(calls.deleteUser).toEqual([])
  })

  it('trạng thái đổi giữa lúc kiểm tra và ẩn danh (DELETION_BLOCKED) → 409 chứ không phải 500', async () => {
    const { admin } = fakeAdmin({ anonymize: { error: { message: 'DELETION_BLOCKED' } } })
    expect(await deleteAccount(admin, USER_ID)).toMatchObject({ ok: false, status: 409 })
  })

  it('đóng tài khoản đăng nhập lỗi → báo bấm xóa lại', async () => {
    const { admin } = fakeAdmin({ anonymize: { data: true }, authError: true })
    const res = await deleteAccount(admin, USER_ID)
    expect(res).toMatchObject({ ok: false, status: 500 })
    expect((res as { error: string }).error).toContain('bấm xóa lại')
  })

  it('không đọc được danh sách chặn thì từ chối (không xóa mù quáng)', async () => {
    const { admin, calls } = fakeAdmin({ blockersError: true })
    expect(await deleteAccount(admin, USER_ID)).toMatchObject({ ok: false, status: 500 })
    expect(calls.order).toEqual(['account_deletion_blockers'])
  })
})

describe('handleDeleteRequest', () => {
  it('vượt giới hạn tần suất thì dừng ngay', async () => {
    enforce.mockResolvedValue('Bạn thao tác quá nhanh. Vui lòng thử lại sau 5 phút.')
    const { admin, calls } = fakeAdmin({})
    const res = await handleDeleteRequest(admin, { user: user(['google']), confirmation: 'XÓA' })
    expect(res).toMatchObject({ ok: false, status: 429 })
    expect(calls.order).toEqual([])
  })

  it('thiếu hoặc sai câu xác nhận thì không xóa', async () => {
    const { admin, calls } = fakeAdmin({})
    expect(await handleDeleteRequest(admin, { user: user(['google']), confirmation: 'ok' })).toMatchObject({ ok: false, status: 400 })
    expect(calls.order).toEqual([])
  })

  it('tài khoản email phải nhập mật khẩu, và mật khẩu sai bị từ chối', async () => {
    const { admin, calls } = fakeAdmin({})
    expect(await handleDeleteRequest(admin, { user: user(['email']), confirmation: 'XÓA' })).toMatchObject({ ok: false, status: 400 })

    signIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    expect(await handleDeleteRequest(admin, { user: user(['email']), confirmation: 'XÓA', password: 'sai' })).toMatchObject({
      ok: false,
      status: 403,
    })
    expect(calls.order).toEqual([])
  })

  it('mật khẩu đúng: xóa, và phiên tạm để kiểm tra chỉ thu hồi cục bộ (không đăng xuất thiết bị khác)', async () => {
    signIn.mockResolvedValue({ error: null })
    const { admin, calls } = fakeAdmin({ anonymize: { data: false } })
    const res = await handleDeleteRequest(admin, { user: user(['email']), confirmation: 'xóa', password: 'dung' })
    expect(res).toEqual({ ok: true, mode: 'deleted' })
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(calls.deleteUser).toHaveLength(1)
  })

  it('đăng nhập OTP/Zalo/Google (không có mật khẩu) chỉ cần câu xác nhận', async () => {
    const { admin, calls } = fakeAdmin({ anonymize: { data: true } })
    const res = await handleDeleteRequest(admin, { user: user(['phone'], ''), confirmation: 'DELETE' })
    expect(res).toEqual({ ok: true, mode: 'anonymized' })
    expect(signIn).not.toHaveBeenCalled()
    expect(calls.deleteUser).toEqual([[USER_ID, true]])
  })
})

describe('buildDataExport', () => {
  it('gộp thông tin đăng nhập với dữ liệu trong database, tên tệp theo ngày', async () => {
    const { admin } = fakeAdmin({ exportData: { profile: { full_name: 'A' }, bookings: [] } })
    const res = await buildDataExport(admin, user(['email']), new Date('2026-10-28T10:00:00Z'))
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.filename).toBe('sportarena-du-lieu-2026-10-28.json')
    expect(res.data).toMatchObject({
      account: { id: USER_ID, email: 'a@example.com', phone: null, sign_in_methods: ['email'] },
      profile: { full_name: 'A' },
      bookings: [],
    })
  })

  it('bị giới hạn tần suất hoặc database lỗi thì báo lỗi', async () => {
    const { admin } = fakeAdmin({ exportError: true })
    expect(await buildDataExport(admin, user(['email']))).toMatchObject({ ok: false, status: 500 })

    enforce.mockResolvedValue('chậm lại')
    expect(await buildDataExport(admin, user(['email']))).toMatchObject({ ok: false, status: 429 })
  })
})
