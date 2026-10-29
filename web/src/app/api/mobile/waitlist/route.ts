import type { NextRequest } from 'next/server'
import { authenticateMobile, errorResponse, jsonResponse, readJsonBody, unauthorized } from '@/lib/mobile-auth'
import { isUuid } from '@/lib/mobile-api'
import { joinWaitlist } from '@/lib/waitlist'

/** Ứng dụng mobile đăng ký chờ một khung giờ đang kín. */
export async function POST(request: NextRequest) {
  const auth = await authenticateMobile(request)
  if (!auth) return unauthorized(request)

  const raw = await readJsonBody(request)
  if (!raw.ok) return raw.response
  const { courtId, startTime, endTime } = (raw.body ?? {}) as Record<string, unknown>
  if (!isUuid(courtId)) return errorResponse(request, 'Mã sân không hợp lệ', 400)
  if (typeof startTime !== 'string' || typeof endTime !== 'string') return errorResponse(request, 'Thời gian đặt sân không hợp lệ', 400)

  const result = await joinWaitlist(auth.user.id, courtId, startTime, endTime)
  if ('error' in result) return errorResponse(request, result.error, 400)
  return jsonResponse({ id: result.id }, 201)
}
