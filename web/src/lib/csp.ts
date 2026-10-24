/**
 * Content-Security-Policy có nonce, dựng cho từng request ở proxy.ts.
 *
 * - script-src: chỉ chạy script có nonce đúng của request này (Next tự gắn nonce cho script của framework khi đọc CSP
 *   từ header yêu cầu); 'strict-dynamic' cho script đã tin cậy được nạp thêm script khác. Không có 'unsafe-inline'
 *   nên XSS chèn thẻ <script> hay onclick= đều bị chặn.
 * - style-src giữ 'unsafe-inline': React/Tailwind/thư viện UI dùng thuộc tính style="..." mà nonce không phủ được;
 *   rủi ro của style thấp hơn nhiều so với script.
 * - img-src cho mọi https: vì chủ sân có thể dán link ảnh từ bất kỳ nơi nào (xem RemoteImage).
 * - frame-src chỉ Google Maps (bản đồ nhúng); connect-src chỉ chính mình và project Supabase (REST + realtime).
 */
export interface CspOptions {
  nonce: string
  isDev: boolean
  /** NEXT_PUBLIC_SUPABASE_URL; thiếu hoặc sai thì không mở thêm nguồn nào */
  supabaseUrl?: string | null
}

export function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function supabaseSources(url: string | null | undefined): string[] {
  if (!url) return []
  try {
    const { protocol, host } = new URL(url)
    if (protocol !== 'https:' && protocol !== 'http:') return []
    // Realtime dùng WebSocket cùng host
    return [`${protocol}//${host}`, `${protocol === 'https:' ? 'wss' : 'ws'}://${host}`]
  } catch {
    return []
  }
}

export function buildCsp({ nonce, isDev, supabaseUrl }: CspOptions): string {
  const directives: Array<[string, string[]]> = [
    ['default-src', ["'self'"]],
    // React cần eval ở chế độ phát triển để dựng lại stack lỗi; bản production không dùng
    ['script-src', ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])]],
    ['style-src', ["'self'", "'unsafe-inline'"]],
    ['img-src', ["'self'", 'data:', 'blob:', 'https:']],
    ['font-src', ["'self'", 'data:']],
    ['connect-src', ["'self'", ...supabaseSources(supabaseUrl)]],
    ['frame-src', ['https://www.google.com']],
    ['media-src', ["'self'"]],
    ['worker-src', ["'self'", 'blob:']],
    ['manifest-src', ["'self'"]],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
    ['frame-ancestors', ["'none'"]],
  ]
  return directives.map(([name, values]) => `${name} ${values.join(' ')}`).join('; ')
}
