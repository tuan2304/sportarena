import Constants from 'expo-constants'
import { apiPostPublic } from './api'

/**
 * Gửi lỗi chưa bắt được của app lên máy chủ (endpoint công khai, đã giới hạn tần suất và làm sạch dữ liệu ở phía máy chủ).
 * Mọi lỗi ở đây đều nuốt êm: báo cáo lỗi không được tự gây thêm lỗi, và chỉ gửi mỗi thông điệp một lần mỗi phiên chạy app.
 */
const sent = new Set<string>()
let installed = false

export async function reportError(error: unknown): Promise<void> {
  try {
    const err = error instanceof Error ? error : new Error(String(error))
    const key = `${err.name}:${err.message}`
    if (sent.has(key) || sent.size >= 20) return
    sent.add(key)
    await apiPostPublic('/api/monitoring/client-error', {
      source: 'mobile',
      message: err.message || err.name,
      stack: err.stack,
      appVersion: Constants.expoConfig?.version,
    })
  } catch {
    // bỏ qua
  }
}

/** Bắt lỗi JS chưa xử lý (kể cả lỗi nghiêm trọng làm sập app) rồi giao lại cho trình xử lý mặc định. */
export function installGlobalErrorReporting(): void {
  if (installed) return
  installed = true
  const errorUtils = (globalThis as { ErrorUtils?: { getGlobalHandler(): (e: unknown, fatal?: boolean) => void; setGlobalHandler(h: (e: unknown, fatal?: boolean) => void): void } }).ErrorUtils
  if (!errorUtils) return
  const previous = errorUtils.getGlobalHandler()
  errorUtils.setGlobalHandler((error, isFatal) => {
    void reportError(error)
    previous(error, isFatal)
  })
}
