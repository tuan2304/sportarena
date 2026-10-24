import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { buildCsp, generateNonce } from '@/lib/csp'

export async function proxy(request: NextRequest) {
  const nonce = generateNonce()
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV === 'development',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  })

  // Next đọc nonce từ CSP trong header yêu cầu để gắn vào script của framework; x-nonce cho layout dùng
  const response = await updateSession(request, { 'x-nonce': nonce, 'Content-Security-Policy': csp })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  matcher: [
    // Bỏ qua tệp tĩnh và yêu cầu nạp trước của next/link (không cần nonce)
    {
      source: '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
