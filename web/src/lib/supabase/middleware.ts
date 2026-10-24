import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { Database } from '@/types/database'

/**
 * Làm mới phiên Supabase. `forwardHeaders` là các header thêm vào yêu cầu gửi cho trang (nonce và CSP do proxy.ts tạo);
 * được dựng lại mỗi lần tạo response để không làm mất cookie phiên vừa làm mới trên request.
 */
export async function updateSession(request: NextRequest, forwardHeaders: Record<string, string> = {}) {
  const requestHeaders = () => {
    const headers = new Headers(request.headers)
    for (const [name, value] of Object.entries(forwardHeaders)) headers.set(name, value)
    return headers
  }

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders() },
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders() },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // getClaims() kiểm tra chữ ký JWT tại chỗ (không cần gọi Supabase Auth ở Singapore) khi project
  // dùng JWT signing keys bất đối xứng; nếu vẫn dùng khóa HS256 cũ thì tự rơi về gọi Auth server.
  await supabase.auth.getClaims()

  return supabaseResponse
}
