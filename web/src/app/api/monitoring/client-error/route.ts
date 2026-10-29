import { NextResponse, type NextRequest } from 'next/server'
import { parseClientError } from '@/lib/client-error'
import { captureMessage } from '@/lib/monitoring'
import { enforceRateLimitByIp } from '@/lib/rate-limit'

const MAX_BODY = 8 * 1024

/**
 * Nhận lỗi từ trình duyệt và app mobile. Luôn trả 204 dù báo cáo hợp lệ hay không (client không cần biết), nhưng bỏ qua
 * báo cáo sai dạng hoặc vượt giới hạn tần suất theo IP. Chỉ ghi nhận mức cảnh báo, không đẩy kênh chat: lỗi từ phía
 * người dùng có thể bị giả mạo nên không đủ tin cậy để đánh thức người trực.
 */
export async function POST(request: NextRequest) {
  const noContent = () => new NextResponse(null, { status: 204 })

  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > MAX_BODY) return noContent()

  let body: unknown
  try {
    const text = await request.text()
    if (text.length > MAX_BODY) return noContent()
    body = JSON.parse(text)
  } catch {
    return noContent()
  }

  const report = parseClientError(body)
  if (!report) return noContent()
  if (await enforceRateLimitByIp('clientError')) return noContent()

  captureMessage(
    `client.${report.source}`,
    report.message,
    { path: report.path, digest: report.digest, appVersion: report.appVersion, stack: report.stack },
    { level: 'warning' }
  )
  return noContent()
}
