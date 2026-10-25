import type { NextRequest } from 'next/server'
import { authenticateMobile, errorResponse, jsonResponse, readJsonBody, unauthorized } from '@/lib/mobile-auth'
import { parseCreateBookingBody } from '@/lib/mobile-api'
import { createBookingForUser } from '@/lib/booking-service'

/** Ứng dụng mobile giữ chỗ một khung giờ. Giá và tiền cọc luôn do server tính, không nhận từ client. */
export async function POST(request: NextRequest) {
  const auth = await authenticateMobile(request)
  if (!auth) return unauthorized(request)

  const raw = await readJsonBody(request)
  if (!raw.ok) return raw.response
  const parsed = parseCreateBookingBody(raw.body)
  if (!parsed.ok) return errorResponse(request, parsed.error, 400)

  const { courtId, startTime, endTime, note, match } = parsed.value
  const result = await createBookingForUser(auth.supabase, auth.user, courtId, startTime, endTime, note, match)
  if (result.error || !result.bookingId) return errorResponse(request, result.error ?? 'Không thể đặt sân', 400)
  return jsonResponse({ bookingId: result.bookingId }, 201)
}
