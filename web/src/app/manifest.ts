import type { MetadataRoute } from 'next'

/**
 * Khách dùng web trên điện thoại không cần cài app, nhưng nếu thích vẫn có thể "Thêm vào màn hình chính"
 * để mở toàn màn hình như một ứng dụng (không qua kho ứng dụng).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SportArena',
    short_name: 'SportArena',
    description: 'Đặt sân thể thao và ghép kèo giao lưu theo thời gian thực.',
    lang: 'vi',
    start_url: '/clubs',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#047857',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
