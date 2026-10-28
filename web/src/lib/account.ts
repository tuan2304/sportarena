import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { enforceRateLimit } from '@/lib/rate-limit'
import { captureError } from '@/lib/monitoring'
import type { Database } from '@/types/database'

type Admin = SupabaseClient<Database>

/**
 * Xóa tài khoản và xuất dữ liệu cá nhân. Dùng chung cho web (Server Action / route) và API mobile.
 *
 * Xóa tài khoản không thể xóa thẳng người dùng vì mọi bảng đều ON DELETE CASCADE từ profiles (sẽ cuốn theo đơn đặt,
 * thanh toán và cụm sân của người khác). Quy trình:
 *   1. account_deletion_blockers: còn đơn sắp tới / tiền cọc chưa hoàn thì từ chối kèm lý do.
 *   2. anonymize_user: xóa dữ liệu cá nhân, giữ sổ sách tài chính đã bỏ tên (một transaction).
 *   3. dọn ảnh đại diện trong kho lưu trữ.
 *   4. xóa tài khoản đăng nhập: xóa cứng nếu không còn dòng nào phải giữ, ngược lại xóa mềm (Supabase gỡ email, số điện
 *      thoại và liên kết đăng nhập, giữ lại id để các dòng sổ sách còn trỏ vào được).
 */

/** Chuỗi người dùng phải gõ để xác nhận. Nhận cả bản không dấu và bản tiếng Anh. */
export function isDeleteConfirmation(input: unknown): boolean {
  if (typeof input !== 'string') return false
  const v = input.trim().normalize('NFC').toUpperCase()
  return v === 'XÓA' || v === 'XOA' || v === 'DELETE'
}

/** Mã lý do chặn (từ account_deletion_blockers) → câu hiển thị. Có bản dịch tiếng Anh trong i18n/server-messages.ts. */
export const BLOCKER_MESSAGES: Record<string, string> = {
  admin: 'Tài khoản quản trị không thể tự xóa. Hãy nhờ một quản trị khác gỡ quyền quản trị trước.',
  active_bookings: 'Bạn còn đơn đặt sân sắp tới. Hãy hủy đơn hoặc chờ chơi xong rồi xóa tài khoản.',
  refund_owed: 'Bạn còn khoản tiền cọc đang chờ được hoàn. Hãy nhận lại tiền hoặc liên hệ hỗ trợ trước khi xóa tài khoản.',
  club_active_bookings: 'Cụm sân của bạn còn khách đặt sắp tới. Hãy xử lý các đơn đó (hủy hoặc chờ chơi xong) rồi xóa tài khoản.',
  club_refunds_pending: 'Bạn còn khoản cọc phải hoàn cho khách. Hãy hoàn tiền và bấm "Đã hoàn cọc" trước khi xóa tài khoản.',
}

export function blockerMessages(codes: string[]): string[] {
  return codes.map((c) => BLOCKER_MESSAGES[c]).filter((m): m is string => Boolean(m))
}

/** Tài khoản đăng ký bằng email + mật khẩu thì phải nhập lại mật khẩu; đăng nhập qua OTP/Zalo/Google/Apple thì không có mật khẩu. */
export function requiresPassword(user: Pick<User, 'email' | 'app_metadata'>): boolean {
  const providers = (user.app_metadata?.providers as string[] | undefined) ?? []
  return Boolean(user.email) && providers.includes('email')
}

/** Kiểm tra mật khẩu bằng một client riêng, không đụng tới phiên (cookie) đang dùng. */
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return false
  const client = createClient<Database>(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) return false
  // Chỉ thu hồi phiên tạm vừa tạo, không đăng xuất các thiết bị khác của người dùng
  await client.auth.signOut({ scope: 'local' }).catch(() => {})
  return true
}

export type DeleteOutcome =
  | { ok: true; mode: 'deleted' | 'anonymized' }
  | { ok: false; status: number; error: string; blockers?: string[] }

const GENERIC_FAILURE = 'Không thể xóa tài khoản lúc này. Vui lòng thử lại sau.'

/** Bước 1-4 ở trên. Người gọi đã xác thực danh tính và xác nhận ý định của người dùng. */
export async function deleteAccount(admin: Admin, userId: string): Promise<DeleteOutcome> {
  const { data: blockers, error: blockErr } = await admin.rpc('account_deletion_blockers', { p_user: userId })
  if (blockErr || !blockers) {
    captureError('account.delete', blockErr ?? new Error('thiếu kết quả'), { userId, step: 'blockers' })
    return { ok: false, status: 500, error: GENERIC_FAILURE }
  }
  if (blockers.length > 0) {
    return { ok: false, status: 409, error: blockerMessages(blockers)[0] ?? GENERIC_FAILURE, blockers }
  }

  const { data: retained, error: anonErr } = await admin.rpc('anonymize_user', { p_user: userId })
  if (anonErr) {
    if (anonErr.message.includes('DELETION_BLOCKED')) {
      return { ok: false, status: 409, error: 'Tài khoản vừa có thay đổi nên chưa thể xóa. Vui lòng thử lại.' }
    }
    captureError('account.delete', anonErr, { userId, step: 'anonymize' }, { alert: true })
    return { ok: false, status: 500, error: GENERIC_FAILURE }
  }

  await removeAvatars(admin, userId)

  const { error: authErr } = await admin.auth.admin.deleteUser(userId, retained === true)
  if (authErr) {
    // Dữ liệu cá nhân đã xóa nhưng còn đăng nhập được: bấm xóa lại sẽ chạy tiếp từ đây (các bước trước idempotent)
    captureError('account.delete', authErr, { userId, step: 'auth-delete' }, { alert: true })
    return { ok: false, status: 500, error: 'Đã xóa dữ liệu cá nhân nhưng chưa đóng được tài khoản. Vui lòng bấm xóa lại.' }
  }
  return { ok: true, mode: retained === true ? 'anonymized' : 'deleted' }
}

/** Ảnh đại diện nằm ở avatars/<user_id>/. Lỗi dọn ảnh không chặn việc xóa (chỉ ghi nhận). */
async function removeAvatars(admin: Admin, userId: string): Promise<void> {
  try {
    const { data: files, error } = await admin.storage.from('avatars').list(userId, { limit: 1000 })
    if (error) throw error
    if (!files || files.length === 0) return
    const { error: rmErr } = await admin.storage.from('avatars').remove(files.map((f) => `${userId}/${f.name}`))
    if (rmErr) throw rmErr
  } catch (err) {
    captureError('account.delete', err, { userId, step: 'avatars' }, { level: 'warning' })
  }
}

export interface DeleteRequest {
  user: User
  password?: unknown
  confirmation?: unknown
}

/**
 * Toàn bộ luồng xóa từ một yêu cầu của người dùng: giới hạn tần suất, xác nhận, nhập lại mật khẩu (nếu có), rồi xóa.
 * Dùng chung cho Server Action của web và API mobile; người gọi tự lo phần đăng xuất/điều hướng sau khi xong.
 */
export async function handleDeleteRequest(admin: Admin, req: DeleteRequest): Promise<DeleteOutcome> {
  const limited = await enforceRateLimit('accountDelete', req.user.id)
  if (limited) return { ok: false, status: 429, error: limited }

  if (!isDeleteConfirmation(req.confirmation)) {
    return { ok: false, status: 400, error: 'Vui lòng gõ XÓA để xác nhận xóa tài khoản' }
  }

  if (requiresPassword(req.user)) {
    if (typeof req.password !== 'string' || req.password.length === 0) {
      return { ok: false, status: 400, error: 'Vui lòng nhập mật khẩu để xác nhận' }
    }
    if (!(await verifyPassword(req.user.email!, req.password))) {
      return { ok: false, status: 403, error: 'Mật khẩu không đúng' }
    }
  }

  return deleteAccount(admin, req.user.id)
}

export type ExportOutcome =
  | { ok: true; filename: string; data: Record<string, unknown> }
  | { ok: false; status: number; error: string }

/** Gói dữ liệu của chính người dùng: phần trong database (export_user_data) cộng thông tin đăng nhập từ Supabase Auth. */
export async function buildDataExport(admin: Admin, user: User, now = new Date()): Promise<ExportOutcome> {
  const limited = await enforceRateLimit('accountExport', user.id)
  if (limited) return { ok: false, status: 429, error: limited }

  const { data, error } = await admin.rpc('export_user_data', { p_user: user.id })
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
    captureError('account.export', error ?? new Error('thiếu kết quả'), { userId: user.id })
    return { ok: false, status: 500, error: 'Không thể xuất dữ liệu lúc này. Vui lòng thử lại sau.' }
  }

  return {
    ok: true,
    filename: `sportarena-du-lieu-${now.toISOString().slice(0, 10)}.json`,
    data: {
      account: {
        id: user.id,
        email: user.email ?? null,
        phone: user.phone || null,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at ?? null,
        sign_in_methods: (user.app_metadata?.providers as string[] | undefined) ?? [],
      },
      ...(data as Record<string, unknown>),
    },
  }
}
