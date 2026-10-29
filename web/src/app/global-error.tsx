'use client'

import { useEffect } from 'react'

/**
 * Lỗi render ở tầng gốc (layout hỏng) thay thế cả trang, nên phải tự có <html>/<body> và không dùng được provider nào.
 * Chỉ ghi nhận lỗi và cho người dùng thử lại; không hiện nội dung lỗi vì có thể chứa chi tiết nội bộ.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    try {
      const payload = JSON.stringify({
        source: 'web',
        message: error.message || 'Unknown error',
        stack: error.stack,
        path: window.location.pathname,
        digest: error.digest,
      })
      // sendBeacon sống sót cả khi trang đang bị thay thế; fetch keepalive là phương án dự phòng
      if (!navigator.sendBeacon?.('/api/monitoring/client-error', new Blob([payload], { type: 'application/json' }))) {
        void fetch('/api/monitoring/client-error', { method: 'POST', body: payload, keepalive: true }).catch(() => {})
      }
    } catch {
      // báo cáo lỗi không được tự gây thêm lỗi
    }
  }, [error])

  return (
    <html lang="vi">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0, padding: 24, textAlign: 'center' }}>
        <div>
          <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Đã có lỗi xảy ra / Something went wrong</h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 16px' }}>Vui lòng thử lại. / Please try again.</p>
          <button
            type="button"
            onClick={reset}
            style={{ background: '#047857', color: '#fff', border: 0, borderRadius: 8, padding: '10px 18px', fontSize: 14, cursor: 'pointer' }}
          >
            Thử lại / Retry
          </button>
        </div>
      </body>
    </html>
  )
}
