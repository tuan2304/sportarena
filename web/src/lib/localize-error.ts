import { getLocale } from 'next-intl/server'
import { translateServerMessage } from '@/i18n/server-messages'

/**
 * Dịch thông báo lỗi do server trả về cho người dùng. Các lỗi này được viết sẵn bằng tiếng Việt trong code
 * nghiệp vụ (và có test dựa trên đúng câu chữ đó), nên dịch ở biên: Server Action gọi `tr()` ngay trước khi trả về.
 * Tiếng Việt giữ nguyên; tiếng Anh tra bảng trong i18n/server-messages.ts, không có thì trả lại bản gốc.
 */
export async function tr(message: string | undefined): Promise<string> {
  const locale = await getLocale()
  return translateServerMessage(message ?? '', locale)
}

/** Dịch trường `error` (nếu có) của kết quả trả về từ lớp nghiệp vụ. */
export async function trResult<T extends { error?: string }>(result: T): Promise<T> {
  return result.error ? { ...result, error: await tr(result.error) } : result
}
