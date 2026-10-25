'use server'

import { createClient } from '@/lib/supabase/server'
import { resolveCoordinates } from '@/lib/maps-resolve'
import { tr } from '@/lib/localize-error'

/**
 * Chủ sân dán link Google Maps (kể cả link rút gọn maps.app.goo.gl) hoặc toạ độ → trả về toạ độ.
 * Link rút gọn phải được mở rộng ở server vì trình duyệt không đọc được nội dung chuyển hướng của Google (CORS).
 */
export async function resolveMapsInput(input: string): Promise<{ error?: string; lat?: number; lng?: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: await tr('Vui lòng đăng nhập') }

  const text = (input ?? '').trim()
  if (!text) return { error: await tr('Hãy dán link Google Maps hoặc toạ độ') }
  if (text.length > 1000) return { error: await tr('Nội dung quá dài') }

  try {
    const found = await resolveCoordinates(text)
    if (!found) {
      return {
        error:
          'Không đọc được toạ độ từ nội dung này. Hãy dán link Google Maps của sân (nút Chia sẻ → Sao chép liên kết) hoặc toạ độ dạng 10.7769, 106.7009.',
      }
    }
    return { lat: found.lat, lng: found.lng }
  } catch (err) {
    console.error('resolveMapsInput lỗi', err)
    return { error: await tr('Không mở được link này. Hãy thử dán toạ độ trực tiếp.') }
  }
}
