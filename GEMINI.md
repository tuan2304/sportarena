# Dự án: Nền tảng Đặt sân & Ghép kèo Thể thao Real-time

## 📌 Nguyên tắc làm việc (Mandates)
1. **Ghi chép (Logging):** Mọi hành động, thay đổi kiến trúc, và tiến độ phải được ghi lại vào file `GEMINI.md` này.
2. **Kiểm tra (Context First):** Phải đọc file này trước khi bắt đầu bất kỳ tác vụ nào để đảm bảo tính nhất quán.
3. **Xác nhận Logic (Logic First):** Luôn hỏi ý kiến người dùng về các logic nghiệp vụ trước khi tiến hành code.
4. **Phong cách (Vibe):** Ưu tiên giao diện đẹp (Modern, Sporty), code sạch, và trải nghiệm người dùng mượt mà (Real-time).

## 🏗️ Kiến trúc tổng thể (Architecture)
- **Web:** Next.js (App Router), Tailwind CSS.
- **Mobile:** React Native (Expo) - *Giai đoạn sau*.
- **Backend/Database:** Supabase (Postgres, Auth, Realtime, Storage).
- **Thanh toán:** Tích hợp VietQR (PayOS).

## 🗺️ Lộ trình (Roadmap)
- [x] **Giai đoạn 1: Khởi tạo Web & Cấu trúc dự án** (Hoàn thành)
- [x] **Giai đoạn 2: Quản lý Sân (Dành cho Chủ sân)** (Hoàn thành)
- [x] **Giai đoạn 3: Tìm kiếm & Đặt sân (Dành cho Người chơi)** (Hoàn thành)
- [x] **Giai đoạn 4: Hệ thống Ghép kèo (Matchmaking)** (Hoàn thành)
- [x] **Giai đoạn 5: Thanh toán PayOS Webhook & Real-time Notification** (Hoàn thành)
- [x] **Giai đoạn 6: Seed Data Mẫu & Kiểm Thử E2E** (Hoàn thành)
- [x] **Giai đoạn 7: Phát triển Mobile App (React Native / Expo)** (Hoàn thành)
- [x] **Giai đoạn 8: Triển khai Production (Deploy Web)** (Hoàn thành)
- [x] **Giai đoạn 9: Nâng cấp Live Chat & Đánh giá/Review** (Hoàn thành)
- [x] **Giai đoạn 10: Hardening - Bảo mật RLS, thanh toán PayOS thật, hết hạn giữ chỗ** (Hoàn thành, đã áp lên production)
- [x] **Giai đoạn 11: Mỗi chủ sân dùng PayOS riêng** (Hoàn thành, đã merge vào `master`, migration đã áp lên production; phần sổ đối soát chi trả đã gỡ vì nền tảng không còn thu hộ cọc)
- [x] **Giai đoạn 12: Thuê bao gói Free/Pro theo cụm sân** (Hoàn thành, đang miễn phí cho tới khi đặt `BILLING_ENFORCED_FROM`)

## 📝 Nhật ký hoạt động (Activity Log)
- **2024-05-20:** Khởi tạo file `GEMINI.md` và thiết lập quy trình làm việc.
- **Quyết định Logic:** 
    - Cấu trúc: Monorepo (web/, mobile/, supabase/).
    - Auth: Dùng chung hệ thống (Role-based: Admin/Owner/Player).
    - UI: Next.js + Tailwind CSS + Shadcn/ui.
- **Hành động:** 
    - Đã tạo các thư mục gốc `web`, `mobile`, `supabase`.
    - Khởi tạo dự án Next.js 14+ (App Router) trong thư mục `web`.
    - Khởi tạo Shadcn/ui thành công.
- **Quyết định Logic Database:**
    - Cấu trúc: Cụm sân (Club) -> Sân con (Courts). Lịch đặt theo từng sân con.
    - Thời gian: **Chọn giờ tự do (Flexible Time)**. Chống trùng lịch bằng `tstzrange` và ràng buộc loại trừ `EXCLUDE USING gist` trong Postgres.
    - Cơ chế giá: **Linh hoạt theo khung giờ** (Giờ thường, Giờ cao điểm / Cuối tuần).
    - Giữ chỗ tạm thời: **15 phút** chờ quét mã VietQR PayOS trước khi tự động hủy.
    - Mức đặt cọc: **Chủ sân tự cấu hình % cọc** cho từng sân (gợi ý 30% - 50%).
    - Ghép kèo: Tích hợp vào lúc đặt sân; chủ kèo tùy chọn **Chia đều tiền sân** hoặc **Bao trọn sân**.
    - Thanh toán: Tự động tạo mã VietQR (PayOS) và xác thực cọc qua Webhook Realtime.
- **2026-09-21:** 
    - Rà soát và đồng bộ hiện trạng dự án.
    - Đã đệ trình và được người dùng phê duyệt 4 quyết định logic nghiệp vụ cốt lõi (Giá linh hoạt theo khung giờ, Timeout giữ chỗ 15 phút, Chủ sân tự cấu hình % cọc, Tùy chọn chia tiền ghép kèo).
- **2026-09-24:**
    - Khởi tạo cấu hình Supabase (`supabase init`).
    - Hoàn tất viết file migration SQL Schema [20260924000000_initial_schema.sql](file:///D:/myproject/supabase/migrations/20260924000000_initial_schema.sql) gồm đầy đủ 8 bảng nghiệp vụ (`profiles`, `clubs`, `courts`, `court_pricing_rules`, `bookings`, `matches`, `match_participants`, `payments`).
    - Cấu hình ràng buộc loại trừ `EXCLUDE USING gist` chống trùng lịch tự động và cờ hết hạn cọc sau 15 phút.
    - Cấu hình phân quyền bảo mật cấp dòng (Row Level Security - RLS) và đăng ký Realtime publication.
    - Cài đặt thành công `@supabase/supabase-js`, `@supabase/ssr` cho ứng dụng `web`.
    - Tạo đầy đủ Database TypeScript types tại [web/src/types/database.ts](file:///D:/myproject/web/src/types/database.ts).
    - Tạo các module client/server/middleware helper cho Supabase tại [web/src/lib/supabase/](file:///D:/myproject/web/src/lib/supabase/) và [web/src/middleware.ts](file:///D:/myproject/web/src/middleware.ts).
    - Đăng nhập Supabase CLI và liên kết thành công với dự án Cloud: `MyProject` (`hlaawnushcfuzidzwvww`).
    - Thực hiện đẩy trực tiếp toàn bộ 8 bảng và logic chống trùng lịch lên Supabase Cloud qua `supabase db push`.
    - Khởi tạo file cấu hình môi trường [web/.env.local](file:///D:/myproject/web/.env.local) liên kết trực tiếp với dự án.
    - Hoàn tất **Giai đoạn 1**!
- **2026-10-02:**
    - Hoàn tất xây dựng toàn bộ **Giai đoạn 2 (Quản lý Sân cho Chủ sân)**:
      1. Triển khai các trang Xác thực: Trang Đăng nhập [web/src/app/(auth)/login/page.tsx](file:///D:/myproject/web/src/app/(auth)/login/page.tsx), Trang Đăng ký [web/src/app/(auth)/register/page.tsx](file:///D:/myproject/web/src/app/(auth)/register/page.tsx) với thẻ lựa chọn vai trò trực quan (Chủ sân vs Người chơi).
      2. Xây dựng Server Actions xác thực [web/src/app/actions/auth.ts](file:///D:/myproject/web/src/app/actions/auth.ts) và tự động điều hướng theo Role (`owner` -> `/owner/dashboard`).
      3. Xây dựng Layout Dashboard Chủ sân với Sidebar chuyên nghiệp [web/src/components/owner/owner-sidebar.tsx](file:///D:/myproject/web/
      
      
      src/components/owner/owner-sidebar.tsx) và Header bảo vệ theo session.
      4. Xây dựng trang Tổng quan [web/src/app/owner/dashboard/page.tsx](file:///D:/myproject/web/src/app/owner/dashboard/page.tsx) hiển thị các thẻ KPIs (Cụm sân, Sân con, Lịch đặt trong ngày, Doanh thu cọc) và đơn đặt mới nhất.
      5. Xây dựng trang Quản lý Cụm Sân & Sân Con [web/src/app/owner/clubs/page.tsx](file:///D:/myproject/web/src/app/owner/clubs/page.tsx) hỗ trợ thêm cụm sân, thêm sân con, tạm ngưng/bật lại sân (`is_active`) và xóa cụm/sân.
      6. Xây dựng trang Lịch Đặt Sân [web/src/app/owner/schedule/page.tsx](file:///D:/myproject/web/src/app/owner/schedule/page.tsx) kết hợp cả 2 chế độ: **Lưới thời gian (Timeline Grid)** và **Bảng dữ liệu (Data Table)**, tích hợp **Supabase Realtime Live Channel** tự động cập nhật khi có khách đặt mới.
      7. Xây dựng trang Cấu hình Bảng Giá Linh Hoạt [web/src/app/owner/pricing/page.tsx](file:///D:/myproject/web/src/app/owner/pricing/page.tsx) thiết lập giờ cao điểm/cuối tuần cho từng sân con kèm chức năng xóa khung giá.
      8. Cập nhật trang chủ Landing Page thể thao [web/src/app/page.tsx](file:///D:/myproject/web/src/app/page.tsx) kết nối trực tiếp đến Auth và Owner Portal.
      9. Kiểm tra TypeScript và chạy Production Build thành công 100%.
    - Hoàn tất **Giai đoạn 2**!
- **Khởi động Giai đoạn 3 (Tìm kiếm & Đặt sân cho Người chơi):**
    - Đã đệ trình và được người dùng phê duyệt 3 quyết định logic UI/UX:
      1. **Khám phá sân:** Giao diện Lưới thẻ thể thao hiện đại kèm Thanh lọc nhanh theo Bộ môn (Bóng đá, Cầu lông, Pickleball...) và Khu vực (Quận/Huyện).
      2. **Chọn giờ đặt sân:** Lưới khung giờ trực quan (Time Slot Picker: click chọn slot trống, tự động chuyển màu khi kín lịch, hỗ trợ chọn nối tiếp nhiều slot).
      3. **Giữ chỗ & Cọc:** Trang giữ chỗ trực tiếp (`/bookings/[id]`) có Đồng hồ đếm ngược 15 phút, sinh mã VietQR động chuẩn PayOS và kênh Real-time tự động cập nhật khi khách chuyển khoản thành công.
- **2026-10-10:**
    - Hoàn tất xây dựng toàn bộ **Giai đoạn 3 (Tìm kiếm & Đặt sân cho Người chơi)**:
      1. Xây dựng Server Actions đặt sân [web/src/app/actions/booking.ts](file:///D:/myproject/web/src/app/actions/booking.ts) hỗ trợ tính giá linh hoạt theo giờ vàng/cuối tuần, tính % cọc, chống trùng lịch tự động và khởi tạo giao dịch VietQR PayOS.
      2. Xây dựng MainHeader dùng chung [web/src/components/layout/main-header.tsx](file:///D:/myproject/web/src/components/layout/main-header.tsx) kết nối các trang Người chơi & Cổng Chủ sân.
      3. Xây dựng trang Khám Phá Sân [web/src/app/clubs/page.tsx](file:///D:/myproject/web/src/app/clubs/page.tsx) tích hợp bộ lọc nhanh theo bộ môn thể thao và khu vực quận huyện [web/src/components/clubs/club-filters.tsx](file:///D:/myproject/web/src/components/clubs/club-filters.tsx).
      4. Xây dựng trang Chi Tiết Cụm Sân [web/src/app/clubs/[id]/page.tsx](file:///D:/myproject/web/src/app/clubs/[id]/page.tsx).
      5. Xây dựng bộ chọn giờ trực quan [web/src/components/booking/time-slot-picker.tsx](file:///D:/myproject/web/src/components/booking/time-slot-picker.tsx) hiển thị các slot trống, tính toán chi phí và mức cọc theo thời gian thực.
      6. Xây dựng trang Giữ Chỗ & Thanh Toán VietQR [web/src/app/bookings/[id]/page.tsx](file:///D:/myproject/web/src/app/bookings/[id]/page.tsx) kết hợp đồng hồ đếm ngược 15 phút, mã VietQR động chuẩn PayOS và kênh Supabase Realtime Live tự động xá
      
      c nhận khi có cọc [web/src/components/booking/booking-payment-view.tsx](file:///D:/myproject/web/src/components/booking/booking-payment-view.tsx).
      7. Xây dựng trang Lịch Đặt Của Tôi [web/src/app/my-bookings/page.tsx](file:///D:/myproject/web/src/app/my-bookings/page.tsx) theo dõi trạng thái các đơn đặt.
      8. Chạy Production Build thành công 100% với 12 route tối ưu hóa.
    - Hoàn tất **Giai đoạn 3**!
- **Khởi động Giai đoạn 4 (Hệ thống Ghép kèo - Matchmaking):**
    - Đã đệ trình và được người dùng phê duyệt 3 quyết định logic nghiệp vụ:
      1. **Duyệt thành viên:** Chủ kèo duyệt yêu cầu (pending -> accepted/rejected) để đảm bảo phù hợp trình độ và văn hóa đội.
      2. **Luồng tạo kèo:** Hỗ trợ 2 luồng: Mở ghép kèo ngay khi Đặt sân (Time Slot Picker) HOẶC mở ghép kèo từ các đơn đặt có sẵn trong "Lịch đặt của tôi".
      3. **Phân chia chi phí:** Tự động tính toán chi phí gợi ý (Tổng tiền sân / Số người) nếu chọn Chia đều, và 0đ nếu chọn Chủ bao trọn.
- **2026-10-10 (Tiếp tục):**
    - Hoàn tất xây dựng toàn bộ **Giai đoạn 4 (Hệ thống Ghép kèo - Matchmaking)**:
      1. Xây dựng Server Actions ghép kèo [web/src/app/actions/matches.ts](file:///D:/myproject/web/src/app/actions/matches.ts) (`createMatch`, `joinMatch`, `respondParticipant`, `leaveMatch`, `cancelMatch`).
      2. Nâng cấp Server Action [web/src/app/actions/booking.ts](file:///D:/myproject/web/src/app/actions/booking.ts) hỗ trợ `matchConfig` tạo bài đăng ghép kèo ngay lúc giữ chỗ sân.
      3. Tích hợp tùy chọn "Mở Ghép Kèo Giao Lưu" trực quan vào bộ chọn giờ [web/src/components/booking/time-slot-picker.tsx](file:///D:/myproject/web/src/components/booking/time-slot-picker.tsx).
      4. Xây dựng thanh điều hướng và cập nhật MainHeader [web/src/components/layout/main-header.tsx](file:///D:/myproject/web/src/components/layout/main-header.tsx) bổ sung nút "Kèo Giao Lưu" (`/matches`).
      5. Xây dựng trang Khám Phá Kèo Thể Thao [web/src/app/matches/page.tsx](file:///D:/myproject/web/src/app/matches/page.tsx) kèm bộ lọc theo Môn, Trình độ, Hình thức chia tiền [web/src/components/matches/match-filters.tsx](file:///D:/myproject/web/src/components/matches/match-filters.tsx) và thẻ hiển thị kèo [web/src/components/matches/match-card.tsx](file:///D:/myproject/web/src/components/matches/match-card.tsx).
      6. Xây dựng trang Chi Tiết Kèo & Tham Gia [web/src/app/matches/[id]/page.tsx](file:///D:/myproject/web/src/app/matches/[id]/page.tsx) kết hợp component [web/src/components/matches/match-detail-view.tsx](file:///D:/myproject/web/src/components/matches/match-detail-view.tsx) với kênh Supabase Realtime tự động cập nhật khi có ứng viên mới hoặc chủ kèo duyệt.
      7. Xây dựng Modal mở ghép kèo cho đơn đặt có sẵn [web/src/components/matches/create-match-modal.tsx](file:///D:/myproject/web/src/components/matches/create-match-modal.tsx).
      8. Nâng cấp trang Lịch Đặt Của Tôi [web/src/app/my-bookings/page.tsx](file:///D:/myproject/web/src/app/my-bookings/page.tsx) và component [web/src/components/booking/my-bookings-view.tsx](file:///D:/myproject/web/src/components/booking/my-bookings-view.tsx) hỗ trợ 2 tab ("Sân Tôi Đã Đặt" & "Kèo Tôi Tham Gia") cùng nút mở ghép kèo tiện lợi.
      9. Cập nhật trang chủ Landing Page [web/src/app/page.tsx](file:///D:/myproject/web/src/app/page.tsx) kết nối trực tiếp đến Kèo Giao Lưu.
      10. Chạy Production Build thành công 100% với 13 route tối ưu hóa.
    - Hoàn tất **Giai đoạn 4**!
- **Tiếp theo:** Bước sang **Giai đoạn 5: Thanh toán PayOS Webhook & Real-time Notification** (Tích hợp API PayOS chính thức, tạo Payment Link/VietQR qua API, Webhook endpoint nhận IPN tự động xác nhận chuyển khoản và thông báo chuông).
- **2026-10-12:**
    - Rà soát toàn bộ codebase, xác nhận phần lớn Giai đoạn 5 đã được xây dựng sẵn từ các giai đoạn trước.
    - Hoàn tất xây dựng toàn bộ **Giai đoạn 5 (Thanh toán PayOS Webhook & Real-time Notification)**:
      1. Xác nhận [web/src/lib/payos.ts](file:///D:/myproject/web/src/lib/payos.ts) đã tích hợp PayOS SDK + VietQR fallback đầy đủ.
      2. Xác nhận [web/src/app/api/payos/webhook/route.ts](file:///D:/myproject/web/src/app/api/payos/webhook/route.ts) nhận IPN, xác minh chữ ký PayOS, cập nhật `payments` & `bookings` và gửi thông báo real-time.
      3. Xác nhận [web/src/app/actions/notifications.ts](file:///D:/myproject/web/src/app/actions/notifications.ts) có đủ CRUD (`getNotifications`, `markAsRead`, `markAllAsRead`, `createNotification`).
      4. Xác nhận [web/src/components/notifications/notification-bell.tsx](file:///D:/myproject/web/src/components/notifications/notification-bell.tsx) có Bell icon + Dropdown + Supabase Realtime subscription tự động nhận thông báo mới.
      5. Tạo migration SQL [supabase/migrations/20261012000000_add_notifications.sql](file:///D:/myproject/supabase/migrations/20261012000000_add_notifications.sql) cho bảng `notifications` với RLS đầy đủ (user chỉ xem/sửa thông báo của mình).
      6. Đăng ký bảng `notifications` vào `supabase_realtime` publication để Supabase tự broadcast mỗi khi có thông báo mới INSERT.
      7. Push migration thành công lên Supabase Cloud (`hlaawnushcfuzidzwvww`).
      8. Sửa lỗi TypeScript `Cannot use namespace 'PayOS' as a type` trong `lib/payos.ts` sau khi nâng Next.js lên 16.4.0 (đổi sang `require()` cho CommonJS module).
      9. Nâng cấp Next.js từ 16.3.x lên **16.4.0** (vá lỗ hổng bảo mật Critical: RCE, Cache Poisoning, SSRF).
      10. Chạy Production Build thành công 100% với **14 route** tối ưu hóa.
    - Hoàn tất **Giai đoạn 5**! 🎉
- **Ghi chú kỹ thuật:**
    - Luồng thanh toán hoàn chỉnh: `TimeSlotPicker` → `createBooking()` → PayOS API → QR Code → Người chơi quét → PayOS gọi Webhook → `api/payos/webhook` cập nhật DB → Supabase Realtime broadcast → `NotificationBell` hiện popup + `BookingPaymentView` tự chuyển trạng thái.
    - Để kích hoạt PayOS thật: điền `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` vào `.env.local` và cấu hình Webhook URL trên dashboard PayOS: `https://yourdomain.com/api/payos/webhook`.
- **2026-10-19:**
    - Tinh chỉnh giao diện trang chủ [web/src/app/page.tsx](file:///D:/myproject/web/src/app/page.tsx): Loại bỏ nút "Cổng Chủ Sân" ở Hero Section đầu trang nhằm tối ưu trải nghiệm tập trung cho Người chơi khám phá sân và ghép kèo thể thao.
    - Hoàn tất **Giai đoạn 6: Seed Data Mẫu & Kiểm Thử E2E**:
      1. Viết script nạp dữ liệu mẫu [web/scripts/seed.mjs](file:///D:/myproject/web/scripts/seed.mjs).
      2. Tạo thành công 3 tài khoản Auth mẫu: Chủ sân (`owner@sportarena.vn`), 2 Người chơi (`player1@sportarena.vn`, `player2@sportarena.vn`) với mật khẩu chung `123456`.
      3. Tạo 3 Cụm sân thực tế: D-Sports Arena Thảo Điền (Pickleball & Tennis), Hangar Arena Cầu Giấy (Cầu Lông & Bóng Đá Mini), Saigon Sports Center Phú Mỹ Hưng (Pickleball & Bóng Rổ).
      4. Tạo các Sân con, quy tắc Giờ vàng tối và cuối tuần.
      5. Tạo đơn đặt sân và Kèo giao lưu mẫu kèm thành viên tham gia đã được duyệt.
      6. Tạo hệ thống thông báo chuông Real-time mẫu cho cả Chủ sân và Người chơi.
    - Hoàn tất **Giai đoạn 7: Phát triển Mobile App (React Native / Expo)**:
      1. Khởi tạo dự án Expo SDK 58 (TypeScript) tại thư mục [mobile/](file:///D:/myproject/mobile/).
      2. Cài đặt các thư viện lõi: `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `react-native-url-polyfill`, `@react-navigation/native`, `@react-navigation/bottom-tabs`, `@react-navigation/native-stack`, `react-native-svg`, `lucide-react-native`.
      3. Cấu hình Supabase Client kết nối đồng bộ cơ sở dữ liệu với Web [mobile/src/lib/supabase.ts](file:///D:/myproject/mobile/src/lib/supabase.ts).
      4. Thiết lập bảng màu giao diện thể thao hiện đại [mobile/src/theme/colors.ts](file:///D:/myproject/mobile/src/theme/colors.ts) và TypeScript types [mobile/src/types/index.ts](file:///D:/myproject/mobile/src/types/index.ts).
      5. Xây dựng 5 màn hình Tab Bar:
         - [mobile/src/screens/ClubsScreen.tsx](file:///D:/myproject/mobile/src/screens/ClubsScreen.tsx): Khám phá cụm sân & bộ lọc theo bộ môn (Pickleball, Cầu lông, Bóng đá...).
         - [mobile/src/screens/MatchesScreen.tsx](file:///D:/myproject/mobile/src/screens/MatchesScreen.tsx): Danh sách kèo giao lưu đang mở tuyển người.
         - [mobile/src/screens/MyBookingsScreen.tsx](file:///D:/myproject/mobile/src/screens/MyBookingsScreen.tsx): Quản lý lịch sân đã đặt và cọc.
         - [mobile/src/screens/NotificationsScreen.tsx](file:///D:/myproject/mobile/src/screens/NotificationsScreen.tsx): Hệ thống thông báo chuông tức thời.
         - [mobile/src/screens/ProfileScreen.tsx](file:///D:/myproject/mobile/src/screens/ProfileScreen.tsx): Tài khoản cá nhân kèm Quick Switcher giữa 3 tài khoản mẫu.
      6. Xây dựng 2 màn hình Stack chi tiết: [mobile/src/screens/ClubDetailScreen.tsx](file:///D:/myproject/mobile/src/screens/ClubDetailScreen.tsx) và [mobile/src/screens/MatchDetailScreen.tsx](file:///D:/myproject/mobile/src/screens/MatchDetailScreen.tsx).
      7. Điều hướng RootNavigator hoàn chỉnh tại [mobile/src/navigation/RootNavigator.tsx](file:///D:/myproject/mobile/src/navigation/RootNavigator.tsx) và [mobile/App.tsx](file:///D:/myproject/mobile/App.tsx).
      8. Kiểm tra TypeScript (`npx tsc --noEmit`) thành công 100% không có bất kỳ cảnh báo lỗi nào.
    - Hoàn tất **Giai đoạn 8: Triển khai Production (Deploy Web)**:
      1. Tối ưu hóa cấu hình [web/next.config.ts](file:///D:/myproject/web/next.config.ts) hỗ trợ `output: 'standalone'` và cấu hình remote image patterns.
      2. Soạn thảo file cấu hình biến môi trường mẫu [web/.env.example](file:///D:/myproject/web/.env.example).
      3. Xây dựng [web/Dockerfile](file:///D:/myproject/web/Dockerfile) multi-stage tối ưu dung lượng cho trường hợp chạy trên VPS/Server riêng.
      4. Soạn thảo tài liệu hướng dẫn triển khai hoàn chỉnh [DEPLOYMENT.md](file:///D:/myproject/DEPLOYMENT.md) chi tiết các bước đưa Web lên Vercel thông qua GitHub repository `tuan2304/pickleball-booking` và cấu hình Webhook PayOS.
      5. Kiểm tra build standalone production thành công.
    - Sẵn sàng bước sang **Giai đoạn 9: Nâng cấp Live Chat & Đánh giá/Review**.
- **2026-10-19 (Giai đoạn 9):**
    - Hoàn tất xây dựng toàn bộ **Giai đoạn 9 (Live Chat & Đánh giá/Review)**:
      1. Tạo migration SQL [supabase/migrations/20261019000000_add_chat_and_reviews.sql](file:///D:/myproject/supabase/migrations/20261019000000_add_chat_and_reviews.sql) bổ sung 2 bảng mới: `match_messages` (Live Chat theo kèo) và `club_reviews` (Đánh giá sao + nhận xét cụm sân), đầy đủ RLS và Supabase Realtime publication.
      2. Push migration thành công lên Supabase Cloud (`hlaawnushcfuzidzwvww`).
      3. Bổ sung TypeScript types vào [web/src/types/database.ts](file:///D:/myproject/web/src/types/database.ts): định nghĩa table `match_messages` & `club_reviews` trong `Database['public']['Tables']`, thêm `MiniProfile`, `MatchMessage`, `ClubReview` interfaces.
      4. Xây dựng Server Actions chat [web/src/app/actions/chat.ts](file:///D:/myproject/web/src/app/actions/chat.ts): `getMatchMessages()`, `sendMatchMessage()`.
      5. Xây dựng Server Actions review [web/src/app/actions/reviews.ts](file:///D:/myproject/web/src/app/actions/reviews.ts): `getClubReviews()`, `submitClubReview()`.
      6. Xây dựng component Live Chat [web/src/components/matches/match-chat-box.tsx](file:///D:/myproject/web/src/components/matches/match-chat-box.tsx) với Supabase Realtime subscription, hiển thị bubble chat theo chiều trái (người khác) / phải (tôi), auto-scroll, hỗ trợ Enter để gửi.
      7. Xây dựng component Đánh giá Sân [web/src/components/clubs/club-reviews-section.tsx](file:///D:/myproject/web/src/components/clubs/club-reviews-section.tsx) gồm Form chọn sao tương tác + nhập nhận xét + danh sách review realtime.
      8. Tích hợp `MatchChatBox` vào trang Chi Tiết Kèo [web/src/app/matches/[id]/page.tsx](file:///D:/myproject/web/src/app/matches/[id]/page.tsx) và [web/src/components/matches/match-detail-view.tsx](file:///D:/myproject/web/src/components/matches/match-detail-view.tsx).
      9. Tích hợp `ClubReviewsSection` vào trang Chi Tiết Cụm Sân [web/src/app/clubs/[id]/page.tsx](file:///D:/myproject/web/src/app/clubs/[id]/page.tsx).
      10. Fix TypeScript: dùng `MiniProfile` type thay vì full `Profile` để match với Supabase partial select query.
      11. Chạy Production Build thành công 100% với **15 route** tối ưu hóa (exit code 0).
    - **Toàn bộ 9 Giai đoạn đã hoàn thành! 🎉🏆**




- **2026-10-21 (Rà soát & nâng cấp giao diện):**
    - Rà soát toàn bộ dự án, ghi kết quả vào file IMPROVEMENTS.md (đã gỡ ngày 23/10/2026, việc còn lại nằm ở README): phát hiện các lỗ hổng bảo mật/thanh toán (P0), lỗi nghiệp vụ (P1) và danh sách việc nên làm tiếp (P2/P3). **Đề xuất Giai đoạn 10: Hardening (RLS, webhook, pg_cron, múi giờ) trước khi chạy thật.**
    - Viết tài liệu luồng hoạt động có sơ đồ Mermaid: [mục "Luồng hoạt động" trong README.md](README.md#luồng-hoạt-động).
    - Nâng cấp giao diện: sửa lỗi font không áp dụng (`--font-sans` tự tham chiếu chính nó), đổi sang **Be Vietnam Pro** (thân bài, có subset tiếng Việt) + **Barlow Condensed** (tiêu đề); màu `--primary` chuyển sang emerald; thêm hệ animation (fade-up, float, shimmer, card-lift, btn-shine, scroll-reveal, page transition, skeleton loading) có hỗ trợ `prefers-reduced-motion`; làm lại hero + thêm mục 'Bốn bước' ở trang chủ.
    - Build production thành công (15 route).
- **2026-10-21 (Giai đoạn 10 - Hardening):**
    - Migration [20261021000000_phase10_hardening.sql](supabase/migrations/20261021000000_phase10_hardening.sql): thu hồi quyền ghi trực tiếp vào `bookings/payments/matches/notifications`, cấp quyền UPDATE theo cột cho `profiles`; `handle_new_user` không nhận role admin; trigger tự đếm người trong kèo + chặn quá số người; `expire_pending_bookings()` + `pg_cron`; sequence `payos_order_code_seq`; RPC `get_busy_slots`; RLS chat (chỉ thành viên) và review (chỉ người đã chơi). Đã kiểm thử trên Postgres 16 (Docker) với 30+ ca tấn công/hợp lệ, tất cả đạt.
    - Viết lại [web/src/lib/payos.ts](web/src/lib/payos.ts) theo `@payos/node` v2 (code cũ theo v1 nên chưa từng gọi PayOS thật). Production không còn QR giả. Thêm `lib/payments.ts` (`settlePayment` idempotent), `lib/notify.ts`, `lib/supabase/admin.ts`, `lib/datetime.ts`, `lib/pricing.ts`.
    - Webhook chỉ nhận payload có chữ ký; `createBooking` tính giá theo giờ VN, kiểm tra giờ mở cửa, giới hạn 3 đơn chờ cọc, rollback khi lỗi; `matches.ts`, `updateBookingStatus` ghi qua admin client sau khi tự kiểm tra quyền; gỡ `createNotification` và `confirmBookingDeposit` khỏi Server Actions (đang là endpoint công khai).
    - UI thanh toán: dùng thông tin tài khoản từ PayOS, nút giả lập chỉ ở dev, đếm ngược theo giờ server, polling dự phòng. Chat chỉ hiện cho thành viên.
    - Mobile: khóa Supabase sang `EXPO_PUBLIC_*`, nút đổi tài khoản mẫu chỉ ở `__DEV__`.
    - Dọn dẹp: `middleware.ts` -> `proxy.ts`, gỡ `socket.io`, sửa `.gitignore`.
    - **Việc còn lại của bạn:** chạy `supabase db push`, bật `pg_cron`, điền khóa PayOS + đăng ký Webhook URL, xóa/đổi mật khẩu tài khoản seed trên DB production. Chi tiết trong [DEPLOYMENT.md](DEPLOYMENT.md).
- **2026-10-22 (Dọn code, tối ưu hiệu năng, UI/UX, test, CI):**
    - Hiệu năng trên Vercel: `web/vercel.json` đặt vùng `sin1` (cùng Singapore với Supabase), `lib/supabase/session.ts` (React.cache) để mỗi request chỉ gọi Auth/profile một lần, header tải qua `Suspense`, các truy vấn độc lập chạy song song, `next/image` cho ảnh đã whitelist.
    - Dọn code: `lib/constants.ts` + `lib/format.ts` (ép múi giờ VN) thay cho nhãn/hàm định dạng lặp ở nhiều file; type DB tách thành `supabase.generated.ts` (cập nhật bằng `npm run db:types`); eslint từ 30 lỗi + 41 cảnh báo xuống 0.
    - Tách file lớn: `match-detail-view` 685 → 209 dòng (thư mục `matches/detail/`), `time-slot-picker` 571 → 182 dòng (thư mục `booking/picker/` + `lib/booking-slots.ts`).
    - Sửa lỗi phát hiện trong lúc dọn: (1) `bookings.matches` là quan hệ 1-1 nên API trả object, code cũ đọc như mảng nên luôn coi đơn chưa có kèo; (2) nút 'Hôm nay' và bảng giờ lấy ngày theo UTC (sai trước 7h sáng giờ VN); (3) đơn kết thúc 19:30 không làm kín ô 19:00; (4) giờ trên các trang server lệch 7 tiếng vì dùng múi giờ máy chủ.
    - UI/UX theo bộ hướng dẫn ui-ux-pro-max (xem [DESIGN.md](DESIGN.md)): sửa tương phản nút/chữ (trắng trên emerald-600 chỉ 3,77:1, trên amber-500 chỉ 2,15:1), chữ tối thiểu 12px, thay emoji bằng icon SVG, aria-label/role=alert/aria-busy, vùng chạm lớn hơn trên màn hình cảm ứng.
    - Test: 48 test đơn vị (vitest: múi giờ, giá, lịch, định dạng, `settlePayment` với DB giả lập, webhook) + 39 ca kiểm thử bảo mật DB (`npm run db:test`, cần Docker). CI GitHub Actions ở `.github/workflows/ci.yml`.
- **2026-10-22 (Giai đoạn 11-12):**
    - Migration [20261022000000_phase11_12_per_club_payos.sql](supabase/migrations/20261022000000_phase11_12_per_club_payos.sql): bảng `club_payment_settings` (khóa PayOS mã hóa, chỉ service_role truy cập), `subscription_payments`, `payouts`; cột `clubs.accepts_online_payment/plan/plan_until` kèm quyền ghi theo cột (chủ sân không tự nâng gói); hàm `apply_subscription_payment` (nguyên tử, idempotent) và `club_balances`.
    - Mỗi cụm sân chọn kênh PayOS: riêng → kênh nền tảng → giả lập (dev) qua `lib/payment-channel.ts`. Webhook ([lib/payos-webhook.ts](web/src/lib/payos-webhook.ts)) tra đơn ra kênh trước, rồi kiểm tra chữ ký bằng đúng khóa của kênh; hỗ trợ cả thanh toán thuê bao.
    - Giao diện: `/owner/payments` (kết nối PayOS, tự đăng ký webhook, xem số dư nền tảng giữ hộ), `/owner/billing` (mua/gia hạn Pro bằng QR), `/admin` (ghi nhận chi trả, cấp gói). Khóa mã hóa AES-256-GCM (`lib/crypto.ts`).
    - Sửa lỗ hổng: layout `/owner` trước đây không kiểm tra vai trò nên người chơi vào được và tạo cụm sân; nay chỉ owner/admin.
    - Kiểm thử: 93 test đơn vị, 66 ca kiểm thử bảo mật DB. Đã đổi mật khẩu ngẫu nhiên 3 tài khoản mẫu trên production (`scripts/secure-seed-accounts.mjs`).
- **2026-10-22 (Bản đồ Google):**
    - [lib/maps.ts](web/src/lib/maps.ts): đọc toạ độ từ link Google Maps / toạ độ thuần, dựng URL bản đồ nhúng, xem và chỉ đường. [lib/maps-resolve.ts](web/src/lib/maps-resolve.ts) mở rộng link rút gọn `maps.app.goo.gl` ở server, chỉ đi theo chuyển hướng tới host của Google (chống SSRF).
    - Chủ sân ghim vị trí lúc tạo cụm sân hoặc bằng nút 'Ghim vị trí' (dán link/toạ độ hoặc dùng vị trí hiện tại, có xem trước). Không cần đổi database: dùng sẵn cột `clubs.latitude/longitude`.
    - Khách thấy bản đồ nhúng ở trang chi tiết sân và nút 'Chỉ đường' ở danh sách sân, trang kèo, màn hình đặt sân thành công, app mobile. Chưa ghim vị trí thì tìm theo địa chỉ và ghi chú rõ.
- **2026-10-22 (Review nhánh trước khi merge):**
    - Sửa `settlePayment` ghi đè `payments.metadata` khi mất sân (mất `channel`/`club_id` nên webhook gọi lại kiểm chữ ký sai khóa): nay gộp metadata.
    - Chặn ngắt kết nối/đổi khóa PayOS khi còn đơn đang chờ thanh toán qua kênh riêng (khách đã chuyển tiền sẽ không được xác nhận).
    - Chặn xóa cụm sân/sân con đã có đơn hoặc giao dịch (xóa dây chuyền làm mất sổ sách tiền cọc, khoản chi, lịch sử thuê bao); nút Kích hoạt/Tạm ngưng và Xóa nay hiển thị lỗi thay vì nuốt.
    - Webhook: JSON hợp lệ nhưng thiếu `orderCode` trả 200 (không làm hỏng việc đăng ký webhook).
    - Đã kiểm tra: URL bản đồ nhúng không khóa của Google không bị chặn nhúng (trang cuối không có X-Frame-Options/frame-ancestors); audit toàn bộ Server Actions; quét bí mật trong diff: sạch.
- **2026-10-22 (Logo mới):**
    - Thay logo cúp + chữ bằng logo chữ S dựng từ vòng tròn giữa sân với quả bóng vàng. Bản thiết kế (4 bảng: logo chính, biến thể, ứng dụng, quy chuẩn) làm trên canvas thiết kế; quy chuẩn tóm tắt trong [DESIGN.md](DESIGN.md).
    - Component dùng chung [components/brand/logo.tsx](web/src/components/brand/logo.tsx) (`Logo`, `LogoMark`, `Wordmark`) thay logo ở trang chủ, thanh điều hướng, thanh bên chủ sân, đăng nhập, đăng ký.
    - `npm run brand:generate` ([scripts/generate-brand-assets.mjs](web/scripts/generate-brand-assets.mjs)) sinh toàn bộ ảnh từ một nguồn: SVG biến thể, `icon.svg`, `favicon.ico`, `apple-icon.png`, icon web 192/512, và 6 ảnh cho mobile (icon, Android adaptive/monochrome, splash, favicon). App mobile đổi tên hiển thị thành SportArena.
- **2026-10-23 (Trang quản trị nền tảng):**
    - Khu vực `/admin` chỉ cho `profiles.role = 'admin'` (kiểm tra ở [admin/layout.tsx](web/src/app/admin/layout.tsx)), thanh bên riêng có huy hiệu số yêu cầu đang chờ. Trang tài chính cũ (đối soát cọc, gói Pro) chuyển sang `/admin/finance`.
    - Thống kê vận hành `/admin` (7/30/90 ngày, giờ Việt Nam): doanh thu thuê gói Pro (doanh thu thật của nền tảng), GMV đặt sân, cọc thu theo kênh, tiền còn nợ chủ sân, người dùng/cụm sân/sân mới, biểu đồ theo ngày, top cụm sân. Hàm SQL `platform_stats` chỉ service_role gọi được. Cọc không tính là doanh thu nền tảng.
    - Hỗ trợ (ticket): chủ sân và người chơi gửi yêu cầu ở `/support` (tối đa 5 yêu cầu chưa giải quyết), admin trả lời ở `/admin/tickets`, tin nhắn cập nhật realtime, thông báo qua chuông cho cả hai phía. Người dùng chỉ đọc được phiếu của mình (RLS), mọi thao tác ghi đi qua server action có kiểm tra quyền.
    - Gửi thông báo cập nhật `/admin/announcements`: chọn loại (cập nhật/bảo trì/ưu đãi) và đối tượng (tất cả/chủ sân/người chơi), mỗi người nhận một thông báo trong chuông; link đính kèm chỉ nhận đường dẫn nội bộ; có hộp xác nhận vì không thu hồi được.
    - Migration mới `20261023000000_admin_console.sql` (cần `supabase db push` trước khi merge vào master), thêm 21 test vitest và nhóm test RLS số 10 (102/102 test SQL).
- **2026-10-23 (Giao diện sáng / tối):**
    - Thêm nút chuyển sáng/tối ở trang chủ, thanh điều hướng, cổng chủ sân, khu quản trị và trang đăng nhập/đăng ký; mặc định theo hệ thống, lựa chọn được nhớ. Thông báo nhỏ (sonner) đổi theo giao diện.
    - Bảng màu tối mới cùng tông thương hiệu, thêm biến thể `dark:` cho chữ đỏ/xanh/vàng đậm (tương phản ≥ 4.5:1), phủ tối đậm hơn cho hộp thoại. Đã chụp kiểm tra trang chủ, danh sách sân, kèo, đăng nhập ở cả hai chế độ. Quy tắc ghi ở [DESIGN.md](DESIGN.md).
- **2026-10-23 (Bắt buộc chủ sân kết nối PayOS riêng - phương án B):**
    - `resolveClubChannel` không còn rơi về kênh PayOS của nền tảng: cụm sân chưa kết nối (hoặc khóa chưa xác thực) không nhận đặt sân online, khách thấy thông báo chưa nhận đặt; tiền cọc không bao giờ vào tài khoản nền tảng. Kênh nền tảng chỉ còn thu tiền thuê gói Pro. Dev chưa có khóa nào vẫn giả lập được.
    - Giữ lại việc kiểm tra webhook kênh `platform` và sổ đối soát cho các khoản cọc cũ. Cập nhật chữ ở trang Nhận thanh toán của chủ sân, `/admin/finance`, DEPLOYMENT.md.
    - Tạo tài khoản quản trị bằng service_role (email dạng `+admin` của chủ dự án, mật khẩu ngẫu nhiên, đã xác nhận email, `profiles.role = 'admin'`).
- **2026-10-23 (Admin không còn thu hộ cọc):**
    - Bỏ màn ghi nhận chi trả ở `/admin/finance` (nay là trang Gói dịch vụ), bỏ action `recordPayout`, ô số dư thu hộ ở trang Nhận thanh toán của chủ sân, thẻ "đang nợ chủ sân" và cảnh báo hoàn cọc ở thống kê. Giữ bảng `payouts`/`club_balances` trong DB để không mất sổ cũ.
    - Thêm nút vàng **Trang quản trị** trên thanh đầu trang chủ và thanh điều hướng (chỉ admin thấy, có trên điện thoại); admin đăng nhập xong vào thẳng `/admin`.
- **2026-10-23 (Dọn tài liệu):** Gỡ `IMPROVEMENTS.md` (báo cáo rà soát đã xử lý xong; việc còn lại chuyển sang mục "Việc chưa làm" của [README.md](README.md)) và `web/README.md` (bản mẫu create-next-app). Giữ `AGENTS.md`/`CLAUDE.md` vì là hướng dẫn cho công cụ AI.
- **2026-10-25 (Hướng phát triển: mobile, CSP, e2e):**
    - Mobile: đổi ảnh đại diện (chọn ảnh, cắt vuông, tải lên bucket `avatars/<user_id>/`, dọn ảnh cũ; nhấn giữ để gỡ), màn hồ sơ công khai người chơi `PlayerProfile` (số liệu `player_public_stats` + kèo đang mở; mở từ chủ kèo và thành viên trong chi tiết kèo), mở kèo ghép ngay lúc đặt sân (API `/api/mobile/bookings` nhận thêm `match`, server tính chi phí mỗi người). `image-upload.ts` thêm vào nhóm file dùng chung web/mobile.
    - Thông báo đẩy: migration `20261102000000_push_tokens.sql` (bảng `push_tokens` khóa hoàn toàn, chỉ qua `register_push_token`/`unregister_push_token`), [lib/push.ts](web/src/lib/push.ts) gửi qua Expo Push Service (chia lô 100, tự xóa token `DeviceNotRegistered`), `notifyUser`/`notifyAdmins`/thông báo cập nhật đều kèm đẩy, chạy sau khi trả lời (`after`). App đăng ký token khi có phiên, gỡ trước khi đăng xuất, chạm thông báo mở đúng màn hình.
    - CSP có nonce: [lib/csp.ts](web/src/lib/csp.ts) dựng chính sách cho từng request trong [proxy.ts](web/src/proxy.ts); `script-src` chỉ nhận nonce + `strict-dynamic`, không còn `unsafe-inline`. Layout đọc nonce từ header `x-nonce` nên mọi trang render lúc có request. Vẫn giữ `style-src 'unsafe-inline'` (thuộc tính `style=` của React không dùng nonce được).
    - Playwright: [web/e2e/](web/e2e) chạy trên bản build production với Supabase giả (`mock-supabase.mjs`, không cần Docker hay database thật; biến môi trường ghi đè `.env.local` nên không chạm dữ liệu thật). 18 ca: nonce khác nhau mỗi request, không vi phạm CSP trên các trang công khai, chặn `onerror` chèn vào trang, đăng nhập sai, chuyển hướng trang cần đăng nhập, API mobile 401, webhook PayOS. Job `e2e` trong CI. Lệnh: `npm run e2e` (lần đầu `npm run e2e:install`).
    - Kiểm thử: 288 test vitest, 192/192 ca DB (thêm 13 ca push token), 18 ca Playwright.
    - Chưa làm (cần tài khoản bên ngoài): hoàn cọc tự động và cổng MoMo/VNPay.
- **2026-10-25 (Giao diện Việt - Anh):**
    - Dùng `next-intl`, ngôn ngữ lưu trong cookie `sa-lang` (không đổi URL nên proxy/CSP/liên kết thông báo giữ nguyên). Chưa chọn thì theo `Accept-Language` (en nếu ngôn ngữ ưu tiên là en, còn lại vi). Cấu hình ở [i18n/config.ts](web/src/i18n/config.ts), nút chuyển [language-switcher.tsx](web/src/components/layout/language-switcher.tsx), bản dịch ở [web/messages/vi.json](web/messages/vi.json) và `en.json`.
    - Khóa dịch có kiểu (`src/types/next-intl.d.ts`): gõ sai khóa trong `t('...')` báo lỗi lúc `tsc`. Test `messages.test.ts` bắt thiếu khóa, bản dịch rỗng, lệch `{biến}` và chữ Việt lọt vào bản Anh.
    - Đã dịch toàn bộ phần người chơi: trang chủ, đăng nhập/đăng ký, danh sách và chi tiết sân, chọn giờ, thanh toán cọc, lịch đặt, kèo, hồ sơ, thông báo, hỗ trợ, ảnh. Nhãn dạng mã (môn, trình độ, cách chia phí) qua `useLabels()` / `getLabels()` ([i18n/labels.ts](web/src/i18n/labels.ts)).
    - Lỗi do server trả về vẫn viết tiếng Việt ở nghiệp vụ (có test dựa trên câu chữ đó) và được dịch ở biên: Server Action gọi `tr()` ([lib/localize-error.ts](web/src/lib/localize-error.ts)), bảng dịch ở [i18n/server-messages.ts](web/src/i18n/server-messages.ts). Test quét mã nguồn, thêm câu lỗi mới mà quên dịch sẽ fail.
    - `lib/cancellation.ts` (dùng chung với mobile) thêm tham số `lang` mặc định `vi`; `formatShortDate`/`formatLongDate` nhận `lang`.
    - Chưa dịch: khu vực chủ sân và quản trị, nội dung thông báo lưu trong database (chuông), app mobile. README có bản tiếng Anh [README.en.md](README.en.md).
    - Playwright thêm 7 ca (`e2e/i18n.spec.ts`); trình duyệt giả lập đặt `locale: 'vi-VN'` để các ca cũ vẫn chạy bằng tiếng Việt.
- **2026-10-25 (Dịch khu chủ sân và quản trị):**
    - Dịch toàn bộ `/owner` (tổng quan, cụm sân và sân con, lịch đặt, bảng giá, nhận thanh toán, hoàn cọc, gói dịch vụ, chính sách hủy, chọn vị trí) và `/admin` (thống kê, hỗ trợ, thông báo, gói dịch vụ). Khóa dịch ở các nhóm `owner*`, `admin`, `locationPicker`; văn bản có thẻ in đậm/liên kết dùng `t.rich`.
    - Lỗi trả về từ action của chủ sân/quản trị cũng đi qua `tr()` và bảng [i18n/server-messages.ts](web/src/i18n/server-messages.ts); test quét mã nguồn mở rộng sang các file này (và cả khóa `message:`).
    - Còn tiếng Việt: nội dung thông báo lưu trong database và app mobile.
- **2026-10-25 (Thông báo và app mobile song ngữ):**
    - Migration `20261103000000_notification_locales.sql`: `notifications.title_en/message_en`, `profiles.locale` (không cấp quyền đọc/ghi trực tiếp), hàm `set_my_locale`. 201/201 ca DB.
    - `notifyUser`/`notifyAdmins` tự điền bản tiếng Anh từ bảng dịch ở `server-messages.ts` (không phải sửa từng nơi gọi); chuông web và mobile hiện theo ngôn ngữ đang chọn, thông báo đẩy gửi theo `profiles.locale` của người nhận. Test quét mọi lời gọi thông báo để bắt câu chưa dịch.
    - Mobile: [src/i18n](mobile/src/i18n) (vi.json/en.json, `useI18n()`, `translate()` cho code ngoài component), chọn ngôn ngữ ở tab Cá Nhân, mặc định theo điện thoại (`expo-localization`). Kiểu `MessageKey` làm gõ sai khóa hoặc thiếu khóa tiếng Anh báo lỗi lúc typecheck. App gửi `Accept-Language`, API `/api/mobile/*` dịch lỗi theo header đó.
- **2026-10-25 (Playwright có đăng nhập):** Supabase giả ([e2e/mock-supabase.mjs](web/e2e/mock-supabase.mjs)) nay cấp phiên cho 3 tài khoản mẫu (người chơi, chủ sân, quản trị; JWT giả, `/auth/v1/user` xác thực) và trả dữ liệu mẫu theo vai trò. [e2e/auth.spec.ts](web/e2e/auth.spec.ts): đăng nhập, lịch đặt, chuông thông báo, hồ sơ (cả hai ngôn ngữ), phân quyền, và mở từng trang `/owner/*`, `/admin/*` bằng tiếng Anh (bắt lỗi trang, kiểm tra tiêu đề và thanh bên đã dịch). Đã chụp màn hình kiểm tra bố cục tiếng Anh của cổng chủ sân và trang quản trị: không vỡ khung.
- **2026-10-25 (App mobile cho chủ sân):**
    - Tách logic đổi trạng thái đơn của chủ sân thành [lib/owner-booking.ts](web/src/lib/owner-booking.ts) (dùng chung Server Action `updateBookingStatus` và API mới), có test bảng chuyển trạng thái. API: `POST /api/mobile/owner/bookings/[id]/status` (`confirmed`/`cancelled`/`completed`) và `.../refunded`; xác thực Bearer, kiểm tra đúng chủ cụm sân, hoàn cọc theo quy tắc cũ, lỗi dịch theo `Accept-Language`.
    - Mobile: tab **Chủ Sân** (chỉ hiện với vai trò owner/admin, hook `useRole`) gồm 3 mục: chờ xác nhận cọc (thấy khách đã báo chuyển khoản), cần hoàn cọc, lịch sắp tới; nút xác nhận, từ chối/hủy (cảnh báo số tiền phải hoàn), đã chơi xong, đã hoàn cọc, gọi khách. Đọc trực tiếp từ Supabase (RLS cho chủ sân xem đơn của mình), ghi qua API. Thông báo đẩy `/owner/schedule`, `/owner/refunds` mở tab này.
    - Playwright: 4 ca API chủ sân (Bearer lấy từ Supabase giả).
    - Chưa kiểm tra trên thiết bị: chỉ typecheck mobile.
- **2026-10-25 (Nút Duyệt / Từ chối trên thông báo đẩy):**
    - Tách logic duyệt người xin vào kèo thành [lib/match-members.ts](web/src/lib/match-members.ts) (dùng chung Server Action và API mới `POST /api/mobile/matches/participants/[id]/respond`, chỉ chủ kèo gọi được). `joinMatch` gắn `categoryId: 'join_request'` và `participantId` vào thông báo đẩy; `PushPayload` có thêm `categoryId`/`data` (lọc: categoryId chỉ chữ thường và `_`, data là chuỗi ngắn, không ghi đè `link`).
    - Mobile: `registerNotificationCategories()` đăng ký nhóm nút theo ngôn ngữ hiện tại, `handleNotificationResponse()` gọi API khi bấm nút rồi mở chi tiết kèo, mỗi phản hồi chỉ xử lý một lần. Nút mở app (không chạy nền) để chắc chắn chạy được cả khi app đã bị tắt; chạy nền thật cần `expo-task-manager`.
    - Chưa thử trên thiết bị thật: cần dev build có EAS (xem DEPLOYMENT.md).
- **2026-10-25 (Mobile: chủ sân tạo cụm sân, sân con, khung giá):**
    - Tách logic ghi thành [lib/owner-catalog.ts](web/src/lib/owner-catalog.ts) (`createClubForOwner`, `createCourtForOwner`, `createPricingRuleForOwner`, `deletePricingRuleForOwner`), dùng chung cho Server Action `owner.ts` (đã refactor, hành vi web giữ nguyên) và 4 API mới: `POST /api/mobile/owner/clubs`, `POST .../clubs/[id]/courts`, `POST .../courts/[id]/pricing-rules`, `DELETE .../pricing-rules/[id]`. Quyền ghi vẫn do RLS kiểm tra; giới hạn số sân theo gói do `checkCourtAllowance`.
    - Parser `parseCreateClubBody`, `parseCreateCourtBody`, `parsePricingRuleBody` trong mobile-api.ts (giá 1.000-50.000.000, cọc 1-100, môn thuộc 5 môn có sẵn, giờ HH:MM); lỗi mới có bản dịch trong server-messages.ts.
    - Mobile: tab Chủ Sân có thanh chuyển Đơn đặt / Sân & giá ([OwnerVenuesPanel.tsx](mobile/src/screens/OwnerVenuesPanel.tsx)): danh sách cụm sân kèm sân con và khung giá, biểu mẫu dạng modal, xóa khung giá có xác nhận. `apiDelete` thêm vào lib/api.ts.
    - Test: 3 nhóm parser + owner-catalog.test.ts (Supabase giả), 2 ca Playwright cho API (401 và dữ liệu sai được dịch). Cụm sân mới dùng ảnh mặc định (đổi ảnh ở mục tiếp theo bên dưới). Chưa kiểm tra trên thiết bị: chỉ typecheck mobile.
- **2026-10-25 (Mobile: ảnh, vị trí, sửa/tắt/xóa sân và khung giá):**
    - Mở rộng [lib/owner-catalog.ts](web/src/lib/owner-catalog.ts): `updateCourtForOwner`, `setCourtActiveForOwner`, `deleteCourtForOwner`, `deleteClubForOwner`, `updateClubLocationForOwner`, `setClubImagesForOwner`, `updatePricingRuleForOwner`. Server Action web (`toggleCourtStatus`, `deleteCourt`, `deleteClub`, `updateClubLocation`, `setClubImages`) giờ chỉ là lớp mỏng gọi lib. `deletePricingRuleForOwner` báo "Không tìm thấy khung giá" khi không có dòng nào bị xóa (trước đây im lặng).
    - API mới: `PATCH/DELETE /api/mobile/owner/courts/[id]`, `DELETE .../clubs/[id]`, `PUT .../clubs/[id]/location`, `PUT .../clubs/[id]/images`, `PATCH .../pricing-rules/[id]`; parser `parseUpdateCourtBody`, `parseLocationBody`, `parseImagesBody`. Ảnh: app tải thẳng lên bucket `club-images/<clubId>/` bằng phiên chủ sân (chính sách bucket có sẵn) rồi PUT danh sách; server chỉ nhận URL trong kho của cụm sân và dọn file bị gỡ.
    - Mobile: [OwnerVenuesPanel.tsx](mobile/src/screens/OwnerVenuesPanel.tsx) có thêm quản lý ảnh (thêm, gỡ, đặt ảnh bìa), ghim vị trí bằng GPS (`expo-location`, [lib/location.ts](mobile/src/lib/location.ts), plugin trong app.json), công tắc bật/tắt sân, sửa/xóa sân con, sửa/xóa khung giá, xóa cụm sân (đều có xác nhận). `lib/api.ts` thêm `apiPut`, `apiPatch`. Cần `npm install` và dev build mới vì thêm `expo-location`.
    - Test: owner-catalog.test.ts dùng Supabase giả trong bộ nhớ (kiểm tra quyền sở hữu, dọn ảnh), thêm parser, 1 ca Playwright. Chưa kiểm tra trên thiết bị: chỉ typecheck mobile.
- **2026-10-25 (E2E luồng ghi dữ liệu trên Supabase thật):**
    - Bộ [web/e2e-real/](web/e2e-real/) + [playwright.real.config.ts](web/playwright.real.config.ts), chạy bằng `npm run e2e:real` ([run.mjs](web/e2e-real/run.mjs) lấy URL/khóa từ `supabase status -o env`; đặt `E2E_SUPABASE_WORKDIR` để dùng config riêng khi máy đã có Supabase cục bộ khác chiếm cổng mặc định). 11 ca tuần tự: chủ sân dựng cụm sân/sân/khung giá, chủ sân khác bị chặn, đặt sân (giá server tính 220.000 đ/cọc 66.000 đ, chống trùng lịch GiST, ngoài giờ mở cửa), xác nhận cọc thủ công (payment → paid, có thông báo), chặn xóa khi đã có đơn, chủ sân hủy → hoàn đủ → đánh dấu đã hoàn, khách hủy, kèo ghép + duyệt người xin vào, vị trí + ảnh (Storage thật, RLS bucket, dọn file khi gỡ), xóa khung giá/sân/cụm sân, giao diện web thấy dữ liệu.
    - Job CI `e2e-real` (supabase/setup-cli + `supabase start -x ...`). Đã chạy qua 11/11 trên Supabase cục bộ; job CI chưa chạy trên GitHub Actions.
    - Phát hiện: sân đang tắt bị RLS ẩn với người ngoài nên khách đặt sân tắt nhận "không tìm thấy" chứ không phải "đang bảo trì".
    - Chưa làm (cần bên ngoài): hoàn cọc tự động và cổng MoMo/VNPay. MoMo/VNPay yêu cầu tài khoản merchant để lấy khóa sandbox; chưa xác nhận được PayOS có API hoàn tiền công khai (phần chi hộ là sản phẩm riêng).
- **2026-10-26 (Quên mật khẩu, web + mobile):**
    - Trước đó link "Quên mật khẩu?" ở trang đăng nhập trỏ `href="#"` và không có chức năng nào. Thêm trang `/forgot-password` và `/reset-password`, Server Action [actions/password.ts](web/src/app/actions/password.ts) (`requestPasswordReset`, `establishRecoverySession`, `updatePassword`), phần thuần ở [lib/password-reset.ts](web/src/lib/password-reset.ts), phần gửi thư ở [lib/password-reset-server.ts](web/src/lib/password-reset-server.ts), API `POST /api/mobile/auth/forgot-password` (không cần token).
    - Thiết kế: dùng flow **implicit** (client Supabase không lưu phiên) để liên kết mang phiên ở phần `#` và mở được trên máy khác, kể cả khi yêu cầu gửi từ app mobile (PKCE cần đúng trình duyệt đã yêu cầu). Trang đặt lại đọc `#`, xóa khỏi URL (phải đợi Next gắn xong `history.replaceState`, nếu không Next ghi lại URL cũ), gửi token cho Server Action dựng phiên cookie. `updatePassword` chỉ nhận phiên có `amr` là `otp`/`recovery` còn mới (≤ 1 giờ): GoTrue thật ghi `otp` cho phiên từ liên kết khôi phục (đã kiểm tra), nên một phiên mật khẩu bị lộ không đổi được mật khẩu. Đổi xong gọi `signOut({ scope: 'others' })`.
    - Chống lạm dụng: giới hạn `forgotByIp` 5/giờ, `forgotByEmail` 3/giờ, luôn trả cùng kết quả dù email có tồn tại hay không. Mobile: chế độ "quên mật khẩu" trong AuthForm, `apiPostPublic`.
    - Test: unit (password-reset, parseForgotPasswordBody), Playwright mock (`e2e/password-reset.spec.ts`, vi + en), và `e2e-real/password-reset.spec.ts` với GoTrue thật (liên kết khôi phục → đổi mật khẩu → mật khẩu cũ hết hiệu lực, refresh token cũ bị thu hồi). `supabase/config.toml` thêm `/reset-password` vào redirect URLs; CI giữ dịch vụ thư.
    - Cần làm trên Supabase thật: thêm `https://<tên miền>/reset-password` vào Redirect URLs, cấu hình SMTP (xem DEPLOYMENT.md). Chưa kiểm tra trên thiết bị: chỉ typecheck mobile.
- **2026-10-26 (Chi tiết sân dạng hộp thoại):**
    - Web: mỗi thẻ sân ở bước "Chọn sân con" có nút **Chi tiết** mở hộp thoại ([court-detail-dialog.tsx](web/src/components/booking/picker/court-detail-dialog.tsx)): môn, mặt sân, giờ mở cửa, tiền cọc (kèm số tiền ví dụ), bảng giá (giá cơ bản + từng khung giờ, ngày áp dụng), chính sách hủy, nút "Chọn sân này". Bấm vào chính thẻ sân vẫn chỉ là chọn sân để đặt (không mở hộp thoại để khỏi cản luồng đặt).
    - Mobile: chạm thẻ sân trong chi tiết cụm sân mở bảng trượt từ dưới lên (`CourtDetailSheet`) với cùng nội dung và nút "Chọn giờ đặt"; nút đặt sẵn trên thẻ vẫn đi thẳng tới màn đặt.
    - Test: 4 ca Playwright (vi + en) cho hộp thoại; mock Supabase thêm một khung giá "Giờ vàng". Mobile chỉ qua typecheck.
