import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { decryptSecret } from '@/lib/crypto'
import { getPlatformCredentials, isPaymentSimulationEnabled, type PayosCredentials } from '@/lib/payos'

/**
 * Kênh nhận tiền cọc của một cụm sân:
 *  - club:       chủ sân tự kết nối PayOS → tiền về thẳng tài khoản của họ (cách duy nhất nhận đặt sân thật)
 *  - manual:     chủ sân khai báo tài khoản ngân hàng, khách chuyển khoản theo VietQR rồi chủ sân tự xác nhận
 *  - platform:   chỉ còn cho các khoản cọc cũ đã thu trước khi bắt buộc kết nối riêng (webhook vẫn phải kiểm tra được)
 *  - simulation: môi trường dev chưa có khóa nào → QR mẫu và nút giả lập
 *
 * Kênh PayOS của nền tảng chỉ dùng để thu tiền thuê gói Pro, không bao giờ thu hộ cọc của khách.
 */
export type PaymentChannel =
  | { kind: 'club'; clubId: string; creds: PayosCredentials }
  | { kind: 'manual'; clubId: string; bank: ManualBankAccount }
  | { kind: 'platform'; creds: PayosCredentials }
  | { kind: 'simulation' }

export interface ManualBankAccount {
  bin: string
  accountNumber: string
  accountName: string
}

type Admin = SupabaseClient<Database>

async function loadBankAccount(admin: Admin, clubId: string): Promise<ManualBankAccount | null> {
  const { data } = await admin
    .from('club_bank_accounts')
    .select('bank_bin, account_number, account_name')
    .eq('club_id', clubId)
    .maybeSingle()
  return data ? { bin: data.bank_bin, accountNumber: data.account_number, accountName: data.account_name } : null
}

async function loadClubCredentials(admin: Admin, clubId: string): Promise<{ creds: PayosCredentials; verified: boolean } | null> {
  const { data } = await admin
    .from('club_payment_settings')
    .select('payos_client_id, payos_api_key_enc, payos_checksum_key_enc, verified_at')
    .eq('club_id', clubId)
    .maybeSingle()

  if (!data) return null
  return {
    verified: data.verified_at !== null,
    creds: {
      clientId: data.payos_client_id,
      apiKey: decryptSecret(data.payos_api_key_enc),
      checksumKey: decryptSecret(data.payos_checksum_key_enc),
    },
  }
}

/**
 * Chọn kênh để tạo đơn thanh toán mới, theo thứ tự ưu tiên: PayOS riêng đã xác thực (tự động xác nhận) →
 * chuyển khoản thủ công (chủ sân tự xác nhận) → giả lập (chỉ dev). Trả null nếu cụm sân chưa có kênh nào:
 * khi đó cụm sân chưa nhận đặt sân online, tiền của khách không bao giờ đi qua tài khoản của nền tảng.
 */
export async function resolveClubChannel(admin: Admin, clubId: string): Promise<PaymentChannel | null> {
  const own = await loadClubCredentials(admin, clubId)
  if (own?.verified) return { kind: 'club', clubId, creds: own.creds }

  const bank = await loadBankAccount(admin, clubId)
  if (bank) return { kind: 'manual', clubId, bank }

  if (isPaymentSimulationEnabled()) return { kind: 'simulation' }
  return null
}

/**
 * Lấy khóa của kênh đã ghi trên một khoản thanh toán cũ, dùng để kiểm tra chữ ký webhook.
 * Cụm sân đổi hoặc xóa khóa sau khi khách đã nhận QR vẫn không làm hỏng các đơn đang chờ vì khóa cũ được giữ
 * cho đến khi chủ sân thay bằng khóa mới; khi đó các đơn cũ cần xử lý tay.
 */
export async function credentialsForStoredChannel(
  admin: Admin,
  channel: string | undefined,
  clubId: string | undefined
): Promise<PayosCredentials | null> {
  if (channel === 'club' && clubId) {
    return (await loadClubCredentials(admin, clubId))?.creds ?? null
  }
  // Chuyển khoản thủ công không có webhook nên không có khóa nào để kiểm tra chữ ký
  if (channel === 'simulation' || channel === 'manual') return null
  return getPlatformCredentials()
}

/**
 * Điều kiện PostgREST (dùng với `.or()`) để danh sách công khai chỉ gồm cụm sân đã liên kết ngân hàng
 * (PayOS hoặc tài khoản VietQR), tức là khách thanh toán cọc được. Môi trường mô phỏng thanh toán (dev, CI) không lọc
 * vì ở đó cụm sân nào cũng đặt được; xem `listsOnlyBookableClubs`.
 */
export const BOOKABLE_CLUB_FILTER = 'accepts_online_payment.eq.true,accepts_manual_transfer.eq.true'

export function listsOnlyBookableClubs(): boolean {
  return !isPaymentSimulationEnabled()
}

/** Cụm sân có nhận đặt sân online được không (để ẩn/hiện form đặt ở giao diện). */
export function canAcceptBookings(acceptsOnlinePayment: boolean, acceptsManualTransfer = false): boolean {
  return acceptsOnlinePayment || acceptsManualTransfer || isPaymentSimulationEnabled()
}
