# 🚀 Hướng Dẫn Triển Khai Production (SportArena Web)

Tài liệu hướng dẫn triển khai nền tảng **SportArena Web** lên môi trường Production với đầy đủ tính năng Real-time và thanh toán VietQR PayOS.

---

## 🌟 CÁCH 1: Triển khai qua Vercel & GitHub (Khuyên Dùng Nhất)
> **Ưu điểm:** Miễn phí, tốc độ cao (CDN toàn cầu), hỗ trợ Server Actions / Edge Middleware tối đa, tự động deploy (CI/CD) mỗi khi push code lên GitHub.

Dự án hiện đã được liên kết với GitHub Repository:  
👉 **`https://github.com/tuan2304/pickleball-booking.git`**

### Bước 0: Áp migration Giai đoạn 10 (BẮT BUỘC, làm TRƯỚC khi deploy code mới)
Migration [20261021000000_phase10_hardening.sql](supabase/migrations/20261021000000_phase10_hardening.sql) khóa quyền ghi trực tiếp vào `bookings`, `payments`, `matches`... Code cũ sẽ lỗi nếu chạy với DB đã khóa, nên hãy áp migration rồi deploy code mới ngay sau đó.

```bash
supabase db push
```
Sau đó vào **Supabase Dashboard → Database → Extensions** và bật **`pg_cron`** (nếu migration chưa tự bật được). Kiểm tra bằng:
```sql
select jobname, schedule from cron.job;  -- phải thấy 'expire-pending-bookings' chạy mỗi phút
```
> Nếu chưa bật `pg_cron`, hệ thống vẫn tự dọn đơn quá hạn mỗi khi có người đặt sân, nhưng nên bật để sân được nhả đúng hạn.

### Bước 1: Đẩy phiên bản code mới nhất lên GitHub
Chạy các lệnh sau trong terminal tại thư mục gốc `d:\myproject`:
```bash
git add .
git commit -m "feat: complete Phase 1-7 (Web, Realtime, PayOS, Mobile Expo)"
git push origin master
```

### Bước 2: Kết nối với Vercel
1. Truy cập [https://vercel.com](https://vercel.com) và đăng nhập bằng tài khoản GitHub của bạn.
2. Nhấn nút **"Add New..."** $\rightarrow$ chọn **"Project"**.
3. Tìm và chọn repository: **`tuan2304/pickleball-booking`** $\rightarrow$ bấm **"Import"**.

### Bước 3: Cấu hình Project trên Vercel
- **Framework Preset:** `Next.js`
- **Root Directory:** Bấm **Edit** và chọn thư mục **`web`** *(Rất quan trọng vì dự án là Monorepo)*.

### Bước 4: Thêm Biến Môi Trường (Environment Variables)
Sao chép các biến sau từ file `.env.local` vào mục **Environment Variables** trên Vercel:

| Tên biến | Giá trị mẫu | Mục đích |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://hlaawnushcfuzidzwvww.supabase.co` | Kết nối Supabase Cloud |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(Key anon trong .env.local)* | Xác thực phía Client |
| `SUPABASE_SERVICE_ROLE_KEY` | *(Key service_role trong .env.local)* | **Bắt buộc.** Server ghi đơn đặt, thanh toán, thông báo (không bao giờ đưa vào mobile/client) |
| `PAYOS_CLIENT_ID` | *(Client ID từ payos.vn)* | **Bắt buộc ở production.** Thiếu 3 khóa PayOS thì không thể đặt sân (không còn QR dự phòng) |
| `PAYOS_API_KEY` | *(API Key từ payos.vn)* | Cổng VietQR PayOS |
| `PAYOS_CHECKSUM_KEY` | *(Checksum Key từ payos.vn)* | Xác thực chữ ký số Webhook |
| `NEXT_PUBLIC_APP_URL` | `https://tên-dự-án.vercel.app` | Domain chính thức của bạn |

### Bước 5: Bấm "Deploy"
Vercel sẽ tự động build và cung cấp cho bạn một domain HTTPS miễn phí (ví dụ: `https://sportarena.vercel.app`).

### Bước 6: Cấu hình Webhook trên PayOS
1. Đăng nhập vào [https://my.payos.vn](https://my.payos.vn).
2. Vào mục **Kênh thanh toán** $\rightarrow$ chọn kênh của bạn.
3. Trong ô **Webhook URL**, điền URL chính thức:
   ```
   https://tên-dự-án.vercel.app/api/payos/webhook
   ```
4. Bấm **Xác nhận / Lưu**. Giờ đây mỗi khi khách quét mã VietQR và chuyển khoản, PayOS sẽ gọi ngay tới webhook này để cập nhật trạng thái đơn đặt và phát chuông thông báo Real-time!

---

## 🐳 CÁCH 2: Triển khai bằng Docker trên VPS (Self-hosted)

Nếu bạn có VPS riêng (Ubuntu, Debian, CentOS...):

### 1. Build Docker image:
```bash
cd web
docker build -t sportarena-web .
```

### 2. Chạy container:
```bash
docker run -d \
  --name sportarena \
  -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL="https://hlaawnushcfuzidzwvww.supabase.co" \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key" \
  -e SUPABASE_SERVICE_ROLE_KEY="your-service-key" \
  -e PAYOS_CLIENT_ID="your-client-id" \
  -e PAYOS_API_KEY="your-api-key" \
  -e PAYOS_CHECKSUM_KEY="your-checksum-key" \
  -e NEXT_PUBLIC_APP_URL="https://yourdomain.com" \
  sportarena-web
```

---

## 💳 Cài đặt PayOS (từng bước)

> Tên mục trên giao diện PayOS có thể khác đôi chút theo thời gian, nhưng các bước giữ nguyên.

### 1. Tạo tài khoản và kênh thanh toán
1. Vào [https://my.payos.vn](https://my.payos.vn) đăng ký bằng email, xác minh tài khoản.
2. Tạo một **Tổ chức** (cá nhân hoặc doanh nghiệp đều được), rồi tạo **Kênh thanh toán**.
3. **Liên kết tài khoản ngân hàng** nhận tiền cho kênh đó (PayOS sẽ hướng dẫn xác thực).
4. Trong kênh vừa tạo, lấy 3 giá trị: **Client ID**, **API Key**, **Checksum Key**.

> ⚠️ Toàn bộ tiền cọc của mọi người chơi sẽ về **một tài khoản ngân hàng này** (của nền tảng).
> Việc chia tiền cho từng chủ sân hiện phải làm thủ công ngoài hệ thống.

### 2. Khai báo biến môi trường
| Biến | Giá trị | Ghi chú |
| :--- | :--- | :--- |
| `PAYOS_CLIENT_ID` | Client ID | |
| `PAYOS_API_KEY` | API Key | |
| `PAYOS_CHECKSUM_KEY` | Checksum Key | Dùng để kiểm tra chữ ký webhook |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | Webhook ghi kết quả thanh toán vào DB |
| `NEXT_PUBLIC_APP_URL` | `https://<tên-miền-chính>` | **Chỉ một địa chỉ.** Khách được chuyển về đây sau khi thanh toán |

- **Vercel:** Project → Settings → Environment Variables → thêm cho môi trường **Production** → **Redeploy** (đổi biến phải deploy lại mới có hiệu lực).
- **Máy bạn:** điền vào `web/.env.local`. Hiện file này có `NEXT_PUBLIC_APP_URL` là danh sách 10 địa chỉ localhost nối bằng `;`, hãy sửa còn đúng một địa chỉ (`http://localhost:3000`).
  Code vẫn tự lấy địa chỉ đầu tiên nếu bị dán nhiều địa chỉ, nhưng nên để đúng một giá trị.

### 3. Đăng ký Webhook (để hệ thống biết khách đã trả tiền)
Webhook URL của dự án: `https://<tên-miền-chính>/api/payos/webhook`

Cách 1, trên giao diện PayOS: vào kênh thanh toán → ô **Webhook URL** → dán URL → lưu.

Cách 2, bằng script (có kiểm tra luôn endpoint có phản hồi đúng không):
```bash
cd web
npm run payos:webhook -- https://<tên-miền-chính>/api/payos/webhook
```
PayOS gửi một request thử có chữ ký tới URL này. Endpoint trả `200` thì đăng ký thành công.
Nếu thất bại, kiểm tra theo thứ tự:
1. Web đã deploy bản mới chưa (endpoint phải tồn tại).
2. URL dùng `https` và đúng tên miền.
3. **Vercel Deployment Protection** (Settings → Deployment Protection) không được chặn tên miền production; nếu bật cho cả production thì PayOS sẽ nhận `401` từ Vercel.
4. 3 khóa PayOS đã có trên Vercel và đã Redeploy.

### 4. Thử nghiệm với tiền thật (số tiền nhỏ)
PayOS không có chế độ sandbox, nên thử bằng số tiền nhỏ (tối thiểu thường là 2.000 đ):
1. Đăng nhập chủ sân, tạm đặt giá một sân con thấp (ví dụ 5.000 đ/giờ, cọc 100%).
2. Đăng nhập người chơi, đặt một khung giờ, quét QR bằng app ngân hàng và chuyển khoản đúng số tiền.
3. Trong vài giây trang đặt sân phải tự chuyển sang **"Đặt sân thành công"**; chủ sân thấy chuông thông báo.
4. Kiểm tra bảng `payments` có `status = 'paid'` và `bookings` có `status = 'confirmed'`.
5. Đặt lại giá thật cho sân.

### 5. Khi không thấy trạng thái cập nhật
| Triệu chứng | Nguyên nhân thường gặp |
| :--- | :--- |
| Báo lỗi ngay khi bấm giữ chỗ | Thiếu 1 trong 3 khóa PayOS trên môi trường production (production không còn QR giả) |
| QR hiện ra nhưng chuyển khoản xong vẫn "chờ" | Webhook chưa đăng ký / bị Vercel chặn / sai `PAYOS_CHECKSUM_KEY` (xem **Logs** của Vercel, tìm `/api/payos/webhook`: `401` nghĩa là sai chữ ký) |
| Sau khi trả tiền bị đưa về `localhost` | `NEXT_PUBLIC_APP_URL` chưa đặt đúng trên Vercel |
| Trang báo "đã nhận cọc nhưng khung giờ không còn" | Khách trả sau khi đơn đã hết hạn 15 phút và sân đã có người khác đặt; cần hoàn tiền thủ công (`payments.metadata.needs_refund = true`) |

## 🏦 Giai đoạn 11–12: mỗi chủ sân dùng PayOS riêng + thuê bao

Có **hai cách nhận tiền cọc**, hệ thống tự chọn theo từng cụm sân:

| Tình huống | Tiền cọc về đâu | Ghi chú |
| :-- | :-- | :-- |
| Chủ sân vào **Nhận thanh toán** và kết nối PayOS riêng | **Thẳng vào ngân hàng của chủ sân** | Hướng đích. Webhook tự đăng ký, khóa được mã hóa trong DB |
| Chưa kết nối (giai đoạn chạy thử) | Kênh PayOS của nền tảng (3 biến `PAYOS_*` trên Vercel) | Bạn chuyển lại cho chủ sân và ghi nhận ở `/admin` |
| Không có khóa nào (chỉ khi dev) | Giả lập | Production không bao giờ rơi vào đây, sẽ báo lỗi |

### Thứ tự triển khai (quan trọng)
1. **Áp migration trước:** `supabase db push` (file `20261022000000_phase11_12_per_club_payos.sql`). Code mới đọc các bảng này nên phải có trước khi deploy.
2. **Thêm biến môi trường trên Vercel** (Production), rồi Redeploy:

| Biến | Bắt buộc | Ý nghĩa |
| :-- | :-- | :-- |
| `PAYMENT_SETTINGS_ENCRYPTION_KEY` | **Có** | Khóa mã hóa khóa PayOS của chủ sân. Tạo: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. **Đừng đổi** sau khi chủ sân đã lưu khóa |
| `BILLING_ENFORCED_FROM` | Không | Ngày bắt đầu giới hạn gói Free, vd `2027-01-01T00:00:00+07:00`. **Để trống = miễn phí hoàn toàn** |
| `PRO_PLAN_PRICE_VND` | Không | Giá gói Pro mỗi tháng. Mặc định 199000 chỉ là giá tạm, hãy tự đặt |
| `PAYOS_*` (3 biến) | **Có** | Kênh PayOS của bạn, chỉ dùng để thu tiền thuê gói Pro. Cọc đặt sân không đi qua kênh này |

3. **Tạo tài khoản quản trị** (vai trò `admin` không tự đăng ký được). Chạy trong Supabase → SQL Editor, thay email của bạn:
```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'EMAIL_CUA_BAN');
```
   Sau đó vào `https://<tên-miền>/admin` để xem thống kê, trả lời hỗ trợ, gửi thông báo và cấp gói thủ công (`/admin/finance`). Tài khoản quản trị đăng nhập xong được đưa thẳng vào `/admin`; ở các trang khác có nút vàng **Trang quản trị** trên thanh đầu trang.
4. **Tài khoản mẫu:** `cd web && node --env-file=.env.local scripts/secure-seed-accounts.mjs` (xem trước), thêm `--apply` để đổi mật khẩu ngẫu nhiên. Đã chạy `--apply` trên database hiện tại ngày 22/10/2026.

### Chủ sân nhận tiền cọc (bắt buộc kết nối PayOS riêng)
- Cụm sân **chỉ nhận đặt sân online khi chủ sân đã kết nối PayOS riêng hoặc khai báo tài khoản chuyển khoản thủ công** ở mục **Nhận thanh toán**; tiền cọc về thẳng tài khoản của họ (xem mục "Hủy sân, chuyển khoản thủ công, ảnh và hồ sơ" bên dưới). Nền tảng không còn thu hộ cọc, nên không phải đối soát hay chuyển tiền lại.
- Cụm sân chưa kết nối hiện thông báo "chưa nhận đặt sân online" với khách và có huy hiệu tương ứng ở `/admin/finance` (trang Gói dịch vụ).
- Quản trị không còn phải đối soát hay chuyển tiền cọc: màn ghi nhận chi trả đã bỏ. Bảng `payouts` và hàm `club_balances` đã được gỡ khỏi database (dòng sổ cũ được sao lưu ngày 24/10/2026).

### Thuê bao
- Chưa đặt `BILLING_ENFORCED_FROM` thì **không có giới hạn nào**; chủ sân vẫn thấy trang **Gói dịch vụ** và có thể mua Pro thử.
- Từ ngày bắt đầu: gói Free tối đa 2 sân con đang hoạt động; sân thứ 3 trở đi không nhận đặt cho đến khi nâng Pro. Sân không bị xóa.
- Chủ sân trả thuê bao qua QR của **kênh PayOS nền tảng**; webhook tự gia hạn. Có thể cấp thủ công ở `/admin`.

## 🔁 Hủy sân, chuyển khoản thủ công, ảnh sân, hồ sơ và đặt sân trên mobile

### Thứ tự triển khai (quan trọng)
1. **Áp migration trước, deploy code sau.** Code mới đọc các cột và bảng mới (nếu thiếu, trang "Lịch đặt của tôi" và trang thanh toán sẽ lỗi). Trong thư mục dự án chạy `supabase db push`; các migration `20261028` đến `20261101` chỉ thêm mới, không xóa hay sửa dữ liệu cũ:

| Migration | Thêm gì |
| :-- | :-- |
| `20261028000000_rate_limits` | Bảng và hàm giới hạn tần suất. Code vẫn chạy nếu chưa áp (bỏ qua giới hạn) |
| `20261029000000_cancellation_refunds` | `clubs.free_cancel_hours`, các cột hủy và hoàn cọc của `bookings` |
| `20261030000000_manual_bank_transfer` | Bảng `club_bank_accounts`, cờ `clubs.accepts_manual_transfer` |
| `20261031000000_storage_images` | Bucket `club-images` và `avatars` cùng chính sách thư mục riêng |
| `20261101000000_profile_tools` | Hàm `get_my_profile()` và `player_public_stats()` |

2. Sau đó mới đẩy code lên `master` để Vercel deploy.
3. Chạy `cd web && npm run db:types` để tạo lại `src/types/supabase.generated.ts` từ database thật (bản trong repo đang được cập nhật tay cho các cột mới).

### Hủy sân và hoàn cọc
- Mỗi cụm sân đặt **số giờ hủy miễn phí** ở **Nhận thanh toán** (mặc định 24 giờ). Người chơi hủy trước hạn được hoàn đủ cọc, muộn hơn thì mất cọc; chủ sân hủy thì luôn hoàn đủ.
- Tiền cọc nằm ở tài khoản của chủ sân nên **chủ sân tự chuyển trả** rồi bấm **Đã hoàn cọc** ở mục **Hoàn cọc**. Hệ thống không tự hoàn tiền.

### Chuyển khoản thủ công
- Chủ sân chọn ngân hàng, nhập số tài khoản và tên chủ tài khoản. Khách nhận mã VietQR kèm số tiền và nội dung `SPORT <mã đơn>`, bấm **Tôi đã chuyển khoản**; chủ sân nhận thông báo, đối chiếu sao kê rồi bấm **Xác nhận** ở **Lịch đặt sân**.
- Đơn chuyển khoản giữ chỗ 60 phút, kéo dài tối đa 3 giờ (không quá giờ chơi) sau khi khách báo đã chuyển. PayOS riêng đã kết nối thì được ưu tiên.

### Ảnh sân và ảnh đại diện
- Tải thẳng lên Supabase Storage (bucket `club-images` tối đa 5 MB, `avatars` tối đa 2 MB; chỉ JPG, PNG, WebP, không nhận SVG). Mỗi chủ sân và mỗi người chỉ ghi được vào thư mục của mình.
- `next.config.ts` chỉ cho trình tối ưu ảnh nhận đúng project Supabase của bạn (lấy từ `NEXT_PUBLIC_SUPABASE_URL`).

### Ứng dụng mobile
- Đặt `EXPO_PUBLIC_API_URL` trong `mobile/.env` là địa chỉ web đã deploy (không có dấu `/` cuối). Mobile giữ chỗ, hủy đơn và báo đã chuyển khoản qua `/api/mobile/*`, xác thực bằng token đăng nhập Supabase; giá luôn do server tính.
- Cài `expo-secure-store` (đã có trong `package.json`). Phiên đăng nhập cũ trong AsyncStorage tự được chuyển sang kho an toàn lần mở app đầu tiên.
- Chạy `npm run sync:mobile` trong `web/` mỗi khi sửa `datetime.ts`, `pricing.ts`, `booking-slots.ts`, `cancellation.ts` hoặc `profile.ts`, vì các file này được sao chép sang `mobile/src/shared/`.

## 🗺️ Bản đồ Google và chỉ đường

Khách thấy bản đồ nhúng ở trang cụm sân, nút **Chỉ đường** ở danh sách sân, trang kèo, màn hình đặt sân thành công và app mobile. Nút này mở app Google Maps trên điện thoại (hoặc web) với điểm đến là sân, đường đi tính từ vị trí hiện tại của khách.

- **Không cần làm gì để chạy:** không có API key thì bản đồ vẫn hiện (dạng nhúng không cần khóa) và nút chỉ đường dùng link chính thức của Google Maps.
- **Chủ sân ghim vị trí:** `Cụm sân & Sân con` → nút **Ghim vị trí** (hoặc ngay lúc tạo cụm sân). Có 3 cách: dán link Google Maps (kể cả link rút gọn `maps.app.goo.gl`), dán toạ độ `10.7769, 106.7009`, hoặc bấm **Dùng vị trí hiện tại** khi đang đứng ở sân. Chưa ghim thì bản đồ tìm theo địa chỉ và có thể lệch.
- **Nên có API key (miễn phí):** dùng Maps Embed API chính thức, ổn định hơn dạng nhúng không khóa.
  1. Vào [Google Cloud Console](https://console.cloud.google.com), tạo project, bật **Maps Embed API**.
  2. Tạo **API key**, trong phần *Application restrictions* chọn **HTTP referrers** và chỉ cho phép tên miền web của bạn (vd `https://ten-mien-cua-ban.vn/*`), *API restrictions* chọn riêng **Maps Embed API**.
  3. Thêm biến `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` trên Vercel rồi Redeploy. (Khóa này hiển thị công khai trong trang web nên bắt buộc phải giới hạn theo tên miền.)
- Các cụm sân có sẵn chưa có toạ độ; chủ sân cần vào ghim, hoặc bạn cập nhật `clubs.latitude/longitude` trong database.

## 🔒 Kiểm tra & Bảo mật sau khi Triển khai:
1. **Webhook:** gửi thử `POST /api/payos/webhook` với body `{"orderCode": 1}` → phải nhận **401** (webhook chỉ chấp nhận payload có chữ ký PayOS hợp lệ).
2. **Thanh toán thật:** đặt một khung giờ, quét QR chuyển khoản số tiền nhỏ → trang tự chuyển "Thành công" và chủ sân nhận chuông thông báo. Trên production **không có** nút giả lập thanh toán.
3. **Real-time:** mở 2 tab ẩn danh: tab 1 mở chi tiết kèo, tab 2 xin tham gia → danh sách tự cập nhật. Chỉ chủ kèo và thành viên đã duyệt mới thấy phòng chat.
4. **Hết hạn giữ chỗ:** đặt sân rồi đóng tab, chờ hơn 15 phút → khung giờ tự mở lại (nhờ `pg_cron`).
5. **Tài khoản mẫu:** các tài khoản seed (`@sportarena.vn`) chỉ dành cho môi trường dev. **Xóa hoặc đổi mật khẩu** trước khi mở cho người dùng thật, và dùng một project Supabase riêng cho production.
6. **Mobile:** tạo `mobile/.env` từ `mobile/.env.example`. Ứng dụng không có tài khoản mẫu hay nút đăng nhập nhanh; người dùng đăng nhập hoặc đăng ký ở tab Cá Nhân.

## 🔔 Thông báo đẩy, CSP và kiểm thử đầu-cuối

### Thứ tự triển khai
1. `supabase db push` để áp `20261102000000_push_tokens` (chỉ thêm bảng và hai hàm, không đụng dữ liệu cũ). Web vẫn chạy nếu chưa áp (lúc đó không gửi được đẩy, chỉ ghi log).
2. Đẩy code lên `master` để Vercel deploy. Từ bản này **mọi trang render lúc có request** (không còn cache tĩnh) vì CSP có nonce; trang chủ và danh sách sân sẽ chậm hơn một chút so với trước.
3. Biến môi trường tùy chọn: `EXPO_ACCESS_TOKEN` (chỉ cần nếu bật "Enhanced Security" cho thông báo đẩy trong tài khoản Expo).

### Bật thông báo đẩy cho app mobile
Thông báo đẩy không chạy trên Expo Go (Android) hay máy ảo; cần bản dev build hoặc bản phát hành:
1. `cd mobile && npx eas-cli login && npx eas-cli init` (tạo dự án EAS, ghi `extra.eas.projectId` vào `app.json`).
2. Android: thêm khóa FCM vào EAS (`eas credentials`). iOS: cần tài khoản Apple Developer cho khóa APNs.
3. `npx eas-cli build --profile development --platform android`, cài lên máy thật, đăng nhập: token tự đăng ký.
Chưa có `projectId` thì app bỏ qua êm việc đăng ký, thông báo trong tab Thông Báo vẫn dùng bình thường.

### CSP
Header `Content-Security-Policy` do [src/proxy.ts](web/src/proxy.ts) tạo cho từng request. Nếu thêm dịch vụ bên thứ ba (bản đồ, phân tích, chat...) mà bị chặn, console trình duyệt sẽ báo `Content Security Policy`; thêm đúng nguồn vào [src/lib/csp.ts](web/src/lib/csp.ts) (đừng thêm `unsafe-inline` cho script).

### Kiểm thử đầu-cuối
`cd web && npm run e2e:install` (một lần) rồi `npm run e2e`. Bộ test tự build, chạy bản production với Supabase giả nên không cần `.env.local` và không chạm database thật. CI chạy cùng lệnh này ở job `e2e`.

