<div align="center">

<img src="web/public/brand/logo-mark.svg" alt="" width="72" height="72" />

# SportArena

**Đặt sân thể thao và ghép kèo giao lưu theo thời gian thực.**

Chọn giờ trống, cọc bằng mã VietQR, rủ thêm người chơi vào kèo. Mỗi chủ sân nhận tiền thẳng vào tài khoản của mình.

`Next.js 16` · `React 19` · `Tailwind v4` · `Supabase` · `PayOS` · `Expo`

**Tiếng Việt** · [English](README.en.md)

</div>

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/clubs-light.png" alt="Danh sách cụm sân, giao diện sáng"></td>
    <td width="50%"><img src="docs/screenshots/clubs-dark.png" alt="Danh sách cụm sân, giao diện tối"></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/matches-light.png" alt="Kèo giao lưu, giao diện sáng"></td>
    <td><img src="docs/screenshots/matches-dark.png" alt="Kèo giao lưu, giao diện tối"></td>
  </tr>
</table>

## Tính năng

**Người chơi**
- Tìm cụm sân theo môn (bóng đá, cầu lông, pickleball, tennis, bóng rổ) và khu vực, xem bản đồ và chỉ đường.
- Chọn khung giờ trên lịch, hệ thống tự tính giá theo khung giờ và tiền cọc, giữ chỗ 15 phút có đồng hồ đếm ngược.
- Cọc bằng mã QR, trạng thái cập nhật ngay khi chuyển khoản xong, không cần tải lại trang.
- Mở kèo giao lưu ngay lúc đặt sân: chọn trình độ, chia tiền sân, chủ kèo duyệt từng người, chat trong kèo.
- Tự hủy đơn theo chính sách của cụm sân: hủy sớm được hoàn cọc, hủy muộn mất cọc, chủ sân hủy thì luôn hoàn đủ. Theo dõi trạng thái hoàn cọc ngay trong đơn.
- Hồ sơ người chơi: ảnh đại diện, trình độ, số điện thoại và trang hồ sơ công khai có thống kê.
- Thông báo realtime, đánh giá sân, gửi yêu cầu hỗ trợ.
- Đặt sân (kèm mở kèo ghép ngay lúc đặt), thanh toán cọc, hủy đơn, đổi ảnh đại diện, xem hồ sơ người chơi và nhận thông báo đẩy ngay trên ứng dụng mobile.
- Giao diện web có **tiếng Việt và tiếng Anh**: đổi bằng nút ngôn ngữ trên thanh đầu trang, mặc định theo trình duyệt (khu vực chủ sân và quản trị hiện mới có tiếng Việt).

**Chủ sân**
- Quản lý cụm sân, sân con, giờ mở cửa và vị trí; tải ảnh sân trực tiếp (JPG, PNG, WebP), chọn ảnh bìa.
- Bảng giá linh hoạt theo khung giờ và ngày trong tuần, tự đặt phần trăm cọc cho từng sân.
- Lịch đặt realtime, nhận thông báo khi có khách cọc.
- Hai cách nhận cọc, tiền luôn về thẳng tài khoản ngân hàng của chủ sân: kết nối PayOS riêng (tự xác nhận) hoặc khai báo tài khoản để khách chuyển khoản theo VietQR rồi chủ sân xác nhận thủ công.
- Tự đặt chính sách hủy sân (số giờ hủy miễn phí) và quản lý danh sách đơn cần hoàn cọc.
- Gói Free và Pro cho cụm sân.

**Quản trị nền tảng**
- Thống kê vận hành: người dùng, cụm sân, lượt đặt, giá trị giao dịch, doanh thu thuê gói, biểu đồ theo ngày.
- Hộp thư hỗ trợ (ticket) giữa quản trị với chủ sân và người chơi.
- Gửi thông báo cập nhật hoặc bảo trì tới từng nhóm người dùng.

**Giao diện**: sáng và tối, đủ tương phản chữ, dùng được trên điện thoại, có ứng dụng mobile bằng Expo.

## Điểm kỹ thuật đáng chú ý

- **Không bao giờ trùng lịch.** Chặn ở tầng Postgres bằng exclusion constraint trên khoảng thời gian, nên hai người bấm cùng lúc thì chỉ một người giữ được chỗ. Chỗ giữ quá hạn được nhả tự động bằng pg_cron.
- **Thanh toán đáng tin cậy.** Webhook PayOS kiểm tra chữ ký theo đúng kênh của từng đơn, đối chiếu số tiền, xử lý lặp an toàn (idempotent) và trả mã lỗi để PayOS tự gọi lại khi cần.
- **Mỗi chủ sân một kênh thanh toán.** Khóa PayOS được mã hóa AES-256-GCM trước khi lưu, chỉ server đọc được và không bao giờ trả về trình duyệt.
- **Bảo mật nhiều lớp.** Mọi bảng bật Row Level Security, người dùng không có quyền ghi trực tiếp vào bảng nghiệp vụ, mọi thao tác ghi đi qua Server Action có kiểm tra quyền. Các quy tắc đó có bộ test SQL riêng chạy trong Docker.
- **Realtime.** Lịch đặt, kèo, chat, thông báo và ticket cập nhật qua Supabase Realtime.
- **Múi giờ Việt Nam nhất quán.** Hiển thị và thống kê đều tính theo giờ Việt Nam, kể cả khi máy chủ chạy UTC.
- **Kiểm thử và CI.** Hơn 150 test Vitest cho logic nghiệp vụ, bộ test RLS bằng SQL, GitHub Actions chạy typecheck, lint, test, build, kiểm thử đầu-cuối bằng Playwright (kèm kiểm tra CSP có nonce) và kiểm tra mobile ở mỗi lần push.

## Công nghệ

| Lớp | Công nghệ |
| :-- | :-- |
| Web | Next.js 16 (App Router, Server Actions), React 19, Tailwind CSS v4, shadcn/ui trên Base UI |
| Dữ liệu | Supabase: Postgres, Auth, RLS, Realtime |
| Thanh toán | PayOS v2 (VietQR) |
| Mobile | Expo, React Native |
| Kiểm thử | Vitest, test SQL trong Docker |
| Hạ tầng | Vercel hoặc Docker, GitHub Actions |

## Cấu trúc

```
web/        Ứng dụng Next.js (trang, Server Actions, webhook, giao diện, logic có test)
mobile/     Ứng dụng Expo
supabase/   Migration (schema, RLS, hàm SQL) và bộ test bảo mật
docs/       Ảnh minh họa
```

Tài liệu đi kèm: [Luồng hoạt động](#luồng-hoạt-động) (có sơ đồ), [Quy chuẩn thiết kế](DESIGN.md), [Hướng dẫn triển khai](DEPLOYMENT.md).

## Chạy thử

Cần Node.js 20 trở lên và một project [Supabase](https://supabase.com) miễn phí. Chưa cần khóa PayOS: môi trường dev có chế độ giả lập thanh toán.

```bash
git clone https://github.com/tuan2304/pickleball-booking.git
cd pickleball-booking/web
npm install
cp .env.example .env.local        # điền 3 biến Supabase ở đầu file
```

Tạo schema trên project Supabase của bạn (cần [Supabase CLI](https://supabase.com/docs/guides/cli)), rồi chạy:

```bash
supabase link --project-ref <project-ref>
supabase db push
npm run dev                       # http://localhost:3000
```

Các lệnh khác, chạy trong `web/`:

| Lệnh | Việc làm |
| :-- | :-- |
| `npm run check` | Typecheck, lint và test, giống CI |
| `npm run db:test` | Áp migration lên Postgres tạm trong Docker và chạy test RLS |
| `npm run build` | Build production |

Ứng dụng mobile: `cd mobile && npm install`, sao chép `.env.example` thành `.env` rồi điền thêm `EXPO_PUBLIC_API_URL` (địa chỉ máy chủ web, dùng để giữ chỗ, hủy đơn và báo đã chuyển khoản), sau đó `npm start`. Phiên đăng nhập được lưu trong Keychain/Keystore. Logic tính giá, giờ, hủy đơn và hồ sơ được dùng chung với web qua `npm run sync:mobile` (trong `web/`); một test sẽ báo lỗi nếu hai bản lệch nhau.

## Luồng hoạt động

Phần này giải thích người dùng đi qua những bước nào và hệ thống xử lý gì phía sau. Các sơ đồ Mermaid tự hiển thị trên GitHub. Trong VS Code, mở file rồi nhấn `Ctrl+Shift+V` (cần extension *Markdown Preview Mermaid Support*).

### Kiến trúc

```mermaid
flowchart LR
    subgraph Client["Người dùng"]
        W["Web<br/>Next.js 16 + Tailwind"]
        M["Mobile<br/>Expo / React Native"]
    end

    subgraph Server["Next.js (Vercel)"]
        SA["Server Actions<br/>booking · matches · chat · reviews"]
        WH["/api/payos/webhook"]
    end

    subgraph Supa["Supabase"]
        AUTH["Auth"]
        DB[("PostgreSQL<br/>+ RLS")]
        RT["Realtime"]
    end

    PAYOS["PayOS<br/>(VietQR, kênh của từng chủ sân)"]

    W -->|gọi| SA
    W <-.->|"lắng nghe thay đổi"| RT
    M --> DB
    M <-.-> RT
    SA --> DB
    SA --> PAYOS
    PAYOS -->|"báo đã chuyển khoản"| WH
    WH --> DB
    DB --> RT
    W --> AUTH
```

Web không phải hỏi lại server liên tục. Khi database đổi (có cọc, có người xin vào kèo, có tin nhắn mới), Supabase Realtime đẩy thay đổi xuống trình duyệt và giao diện tự cập nhật.

### Đặt sân, cọc, xác nhận

Đây là luồng quan trọng nhất của sản phẩm.

```mermaid
sequenceDiagram
    autonumber
    actor P as Người chơi
    participant UI as Trang chi tiết sân
    participant SA as Server Action<br/>createBooking
    participant DB as PostgreSQL
    participant PO as PayOS
    participant WH as Webhook
    participant RT as Realtime
    actor O as Chủ sân

    P->>UI: Chọn sân con, ngày, các ô giờ trống
    UI-->>P: Hiện tổng tiền + tiền cọc (tính trực tiếp)
    P->>UI: Bấm "Giữ chỗ"
    UI->>SA: createBooking(court, start, end)

    SA->>DB: Lấy giá cơ bản + bảng giá theo khung giờ
    SA->>SA: Tính tổng tiền, tiền cọc (% do chủ sân đặt)
    SA->>DB: INSERT booking (status = pending, hết hạn sau 15')

    alt Trùng giờ với người khác
        DB-->>SA: Lỗi 23P01 (Exclusion Constraint)
        SA-->>UI: "Khung giờ vừa có người đặt"
    else Giờ còn trống
        DB-->>SA: Tạo thành công
        SA->>PO: Tạo link thanh toán + mã QR (kênh PayOS của chủ sân)
        PO-->>SA: qrCode, checkoutUrl
        SA->>DB: INSERT payment (pending)
        SA-->>UI: Chuyển sang /bookings/[id]
    end

    UI-->>P: Hiện QR + đồng hồ đếm ngược 15:00
    P->>PO: Quét QR, chuyển khoản
    PO->>WH: POST webhook (đã nhận tiền)
    WH->>WH: Kiểm tra chữ ký + đối chiếu số tiền
    WH->>DB: payment → paid · booking → confirmed
    WH->>DB: INSERT notifications (cho người chơi & chủ sân)
    DB->>RT: Phát sự kiện thay đổi
    RT-->>UI: Trang tự chuyển "Đặt sân thành công"
    RT-->>O: Chuông báo "Có đơn đặt sân mới"
```

**Vòng đời của một đơn đặt sân**

```mermaid
stateDiagram-v2
    [*] --> pending: Người chơi giữ chỗ
    pending --> confirmed: Nhận đủ tiền cọc
    pending --> cancelled: Hết 15 phút chưa cọc
    confirmed --> completed: Chủ sân đánh dấu đã chơi xong
    confirmed --> cancelled: Chủ sân / người chơi hủy
    completed --> [*]
    cancelled --> [*]

    note right of pending
        Giờ này đã bị KHÓA,
        người khác không đặt được
    end note
    note right of cancelled
        Giờ được nhả ra,
        ai cũng đặt lại được
    end note
```

**Vì sao không bao giờ trùng lịch?** Không kiểm tra bằng code, vì hai người bấm cùng lúc sẽ lọt qua. Database có ràng buộc:

```sql
EXCLUDE USING gist (court_id WITH =, during WITH &&)
WHERE (status IN ('pending', 'confirmed'))
```

Cùng một sân, khoảng giờ giao nhau và đơn còn hiệu lực thì Postgres từ chối. Ai bấm trước được giữ chỗ, người sau nhận thông báo lỗi thân thiện.

**Cách tính giá**

```mermaid
flowchart TD
    A["Giờ bắt đầu + thứ trong tuần"] --> B{"Có bảng giá<br/>khớp khung giờ & thứ?"}
    B -- Có --> C["Dùng giá của khung đó<br/>(giờ vàng, cuối tuần...)"]
    B -- Không --> D["Dùng giá cơ bản của sân"]
    C --> E["Tổng tiền = số giờ × đơn giá"]
    D --> E
    E --> F["Tiền cọc = Tổng × % cọc của sân"]
    F --> G["Còn lại: trả trực tiếp tại sân"]
```

### Ghép kèo

Người chơi đã có sân nhưng thiếu người thì mở một kèo để mọi người cùng tham gia.

```mermaid
flowchart TD
    S1["Đặt sân mới<br/>(bật công tắc 'Mở ghép kèo')"] --> M
    S2["Đơn có sẵn trong<br/>'Lịch đặt của tôi' → Mở kèo"] --> M
    M["Tạo kèo: tên, trình độ, số người cần,<br/>cách chia tiền"] --> C{"Chia tiền thế nào?"}
    C -- "Chia đều" --> C1["Chi phí/người = Tổng tiền sân ÷ số người"]
    C -- "Chủ bao trọn" --> C2["Chi phí/người = 0 đ"]
    C1 --> L
    C2 --> L
    L["Kèo hiện ở trang /matches<br/>(trạng thái: open)"]

    L --> J["Người khác bấm 'Xin tham gia'"]
    J --> N1["Chủ kèo nhận thông báo"]
    N1 --> D{"Chủ kèo duyệt?"}
    D -- Duyệt --> A["accepted<br/>số người +1"]
    D -- Từ chối --> R["rejected<br/>báo người xin"]
    A --> F{"Đủ người chưa?"}
    F -- Đủ --> FULL["Kèo chuyển 'full'"]
    F -- Chưa --> L
    A --> CH["Vào phòng chat của kèo"]
```

**Trạng thái người tham gia**

```mermaid
stateDiagram-v2
    [*] --> pending: Gửi yêu cầu
    pending --> accepted: Chủ kèo duyệt
    pending --> rejected: Chủ kèo từ chối
    accepted --> left: Tự rời kèo
    left --> pending: Xin tham gia lại
    rejected --> [*]
```

### Realtime: màn hình nào nghe bảng nào

| Màn hình | Bảng được lắng nghe | Kết quả người dùng thấy |
| :-- | :-- | :-- |
| `/bookings/[id]` | `bookings` | Đang chờ cọc tự chuyển sang "Thành công" |
| `/owner/schedule` | `bookings` | Lịch của chủ sân thêm đơn mới ngay lập tức |
| `/matches/[id]` | `match_participants`, `matches` | Danh sách thành viên và số chỗ trống tự đổi |
| Hộp chat trong kèo | `match_messages` | Tin nhắn mới hiện ngay, không cần F5 |
| Phần đánh giá sân | `club_reviews` | Đánh giá mới hiện ngay |
| Chuông thông báo | `notifications` | Số đỏ tăng và có popup |

### Bản đồ trang

```mermaid
flowchart LR
    HOME["/ Trang chủ"] --> CLUBS["/clubs<br/>Khám phá sân"]
    HOME --> MATCHES["/matches<br/>Kèo giao lưu"]
    HOME --> LOGIN["/login · /register"]

    CLUBS --> CD["/clubs/[id]<br/>Chi tiết + chọn giờ + đánh giá"]
    CD --> BK["/bookings/[id]<br/>QR + đếm ngược 15'"]
    BK --> MB["/my-bookings<br/>Sân đã đặt · Kèo tham gia"]
    MB -.->|"Mở kèo"| MATCHES
    MATCHES --> MD["/matches/[id]<br/>Chi tiết + duyệt + chat"]

    LOGIN -->|"role = owner"| OD["/owner/dashboard"]
    OD --> OC["/owner/clubs<br/>Quản lý cụm & sân con"]
    OD --> OP["/owner/pricing<br/>Bảng giá theo khung giờ"]
    OD --> OS["/owner/schedule<br/>Lịch đặt (lưới + bảng)"]
    LOGIN -->|"role = admin"| AD["/admin<br/>Thống kê · hỗ trợ · thông báo"]
```

### Cơ sở dữ liệu

```mermaid
erDiagram
    PROFILES ||--o{ CLUBS : "sở hữu (owner)"
    CLUBS ||--o{ COURTS : "có nhiều sân con"
    COURTS ||--o{ COURT_PRICING_RULES : "bảng giá khung giờ"
    COURTS ||--o{ BOOKINGS : "được đặt"
    PROFILES ||--o{ BOOKINGS : "đặt"
    BOOKINGS ||--o| MATCHES : "mở thành kèo (1-1)"
    BOOKINGS ||--o{ PAYMENTS : "thanh toán cọc"
    MATCHES ||--o{ MATCH_PARTICIPANTS : "người tham gia"
    MATCHES ||--o{ MATCH_MESSAGES : "chat"
    CLUBS ||--o{ CLUB_REVIEWS : "được đánh giá"
    PROFILES ||--o{ NOTIFICATIONS : "nhận"

    PROFILES {
        uuid id PK
        text role "player / owner / admin"
        text skill_level
    }
    COURTS {
        uuid id PK
        text sport_type
        numeric base_price_per_hour
        int deposit_percentage "% cọc"
    }
    BOOKINGS {
        uuid id PK
        timestamptz start_time
        timestamptz end_time
        text status "pending / confirmed / completed / cancelled"
        timestamptz expires_at "+15 phút"
    }
    MATCHES {
        uuid id PK
        int required_players
        int current_players
        text cost_sharing_type "split / host_covers"
    }
    PAYMENTS {
        uuid id PK
        bigint order_code "mã đơn PayOS"
        text status "pending / paid / ..."
    }
```

Sơ đồ chỉ vẽ các bảng lõi. Ngoài ra còn các bảng cho thông báo, chat, đánh giá, khóa PayOS của từng chủ sân, thuê bao, hỗ trợ (ticket) và thông báo hệ thống. Tất cả đều bật Row Level Security, và `profiles` giới hạn quyền đọc theo cột: khách chỉ thấy thông tin hiển thị công khai, số điện thoại chỉ chủ sân xem được qua hàm riêng.

## Hướng phát triển

- Hoàn cọc tự động qua API của nhà cung cấp thanh toán (hiện chủ sân tự chuyển trả rồi xác nhận).
- Thêm cổng thanh toán tự động khác (MoMo, VNPay...) bên cạnh PayOS và chuyển khoản thủ công.
- Mobile: chủ sân dùng ứng dụng để duyệt đơn và quản lý lịch (hiện app dành cho người chơi), thông báo đẩy có hành động nhanh (duyệt/từ chối người xin vào kèo).
- Dịch tiếng Anh cho khu vực chủ sân và quản trị, thông báo trong chuông (hiện lưu sẵn bằng tiếng Việt) và app mobile.
- Kiểm thử đầu-cuối cho luồng có đăng nhập thật (đặt sân, mở kèo) cần một Supabase thử nghiệm thay cho bản giả hiện tại.
