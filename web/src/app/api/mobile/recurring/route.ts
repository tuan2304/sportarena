import type { NextRequest } from 'next/server'
import { authenticateMobile, errorResponse, jsonResponse, readJsonBody, unauthorized } from '@/lib/mobile-auth'
import { isUuid } from '@/lib/mobile-api'
import { requestRecurring } from '@/lib/recurring-service'

/** Ứng dụng mobile gửi yêu cầu lịch cố định hằng tuần; chủ sân duyệt sau. */
export async function POST(request: NextRequest) {
  const auth = await authenticateMobile(request)
  if (!auth) return unauthorized(request)

  const raw = await readJsonBody(request)
  if (!raw.ok) return raw.response
  const b = (raw.body ?? {}) as Record<string, unknown>
  if (!isUuid(b.courtId)) return errorResponse(request, 'Mã sân không hợp lệ', 400)
  if (typeof b.weekday !== 'number' || typeof b.startTime !== 'string' || typeof b.endTime !== 'string') {
    return errorResponse(request, 'Dữ liệu gửi lên không hợp lệ', 400)
  }
  if ((b.endsOn !== undefined && b.endsOn !== null && typeof b.endsOn !== 'string') || (b.note !== undefined && typeof b.note !== 'string')) {
    return errorResponse(request, 'Dữ liệu gửi lên không hợp lệ', 400)
  }

  const result = await requestRecurring(auth.user.id, {
    courtId: b.courtId,
    weekday: b.weekday,
    startTime: b.startTime,
    endTime: b.endTime,
    endsOn: (b.endsOn as string | null | undefined) ?? null,
    note: b.note as string | undefined,
  })
  if ('error' in result) return errorResponse(request, result.error, 400)
  return jsonResponse({ success: true }, 201)
}
