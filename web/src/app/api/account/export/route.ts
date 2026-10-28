import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildDataExport } from '@/lib/account'
import { tr } from '@/lib/localize-error'

/**
 * Tải toàn bộ dữ liệu cá nhân của người đang đăng nhập (web). GET nhưng chỉ trả dữ liệu cho chính chủ phiên và trình
 * duyệt không cho trang khác đọc nội dung phản hồi, nên không có rủi ro CSRF làm lộ dữ liệu.
 */
export async function GET() {
  const fail = async (message: string, status: number) =>
    NextResponse.json({ error: await tr(message) }, { status, headers: { 'Cache-Control': 'no-store' } })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return await fail('Vui lòng đăng nhập', 401)

  const result = await buildDataExport(createAdminClient(), user)
  if (!result.ok) return await fail(result.error, result.status)

  return new NextResponse(JSON.stringify(result.data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
