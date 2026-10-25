import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Chỉ project Supabase của mình (xem src/lib/image-hosts.ts); thiếu biến thì bỏ mẫu này thay vì mở rộng
function supabaseHostname(): string | null {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null;
  } catch {
    return null;
  }
}
const supabaseHost = supabaseHostname();

/**
 * Header bảo mật cho mọi trang. Content-Security-Policy (có nonce cho script) được tạo riêng cho từng request
 * ở src/proxy.ts, nên không đặt ở đây.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Chủ sân dùng định vị để ghim vị trí cụm sân (location-picker); các tính năng còn lại không dùng
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    // SVG có thể chứa script; không bao giờ cho đi qua trình tối ưu ảnh
    dangerouslyAllowSVG: false,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      ...(supabaseHost ? [{ protocol: "https" as const, hostname: supabaseHost }] : []),
    ],
  },
};

export default withNextIntl(nextConfig);
