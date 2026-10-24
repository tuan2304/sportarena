import type { Metadata } from "next";
import { headers } from "next/headers";
import { Be_Vietnam_Pro, Barlow_Condensed, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { resolveAppUrl } from "@/lib/app-url";

// Font thân bài: thiết kế riêng cho tiếng Việt nên dấu không bị lệch/rơi font
const beVietnam = Be_Vietnam_Pro({
  variable: "--font-bevietnam",
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

// Font tiêu đề: condensed, đậm, đúng chất thể thao
const barlow = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["600", "700", "800"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Gốc để đổi các đường dẫn tương đối (canonical, ảnh chia sẻ) thành địa chỉ tuyệt đối
  metadataBase: new URL(resolveAppUrl()),
  title: {
    default: "SportArena - Đặt sân & Ghép kèo thể thao",
    template: "%s | SportArena",
  },
  description:
    "Đặt sân chống trùng lịch, đặt cọc qua VietQR và ghép kèo giao lưu thể thao theo thời gian thực.",
  openGraph: {
    type: "website",
    siteName: "SportArena",
    locale: "vi_VN",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "SportArena" }],
  },
  twitter: { card: "summary" },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Nonce do proxy.ts tạo cho từng request; đọc header khiến mọi trang render lúc có request (cần cho CSP có nonce)
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="vi"
      className={`${beVietnam.variable} ${barlow.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Đặt giao diện sáng/tối trước khi vẽ trang để không bị nháy */}
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ConfirmProvider>{children}</ConfirmProvider>
        <Toaster />
      </body>
    </html>
  );
}
