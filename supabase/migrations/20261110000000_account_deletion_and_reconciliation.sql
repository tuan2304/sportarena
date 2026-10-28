-- ==============================================================================
-- Migration: 20261110000000_account_deletion_and_reconciliation.sql
-- Description: Xóa tài khoản + xuất dữ liệu cá nhân, và đối soát thanh toán cho quản trị.
--
-- 1. XÓA TÀI KHOẢN (Apple 5.1.1(v), Google Play, Nghị định 13/2023/NĐ-CP)
--    Mọi bảng đều ON DELETE CASCADE từ profiles, nên xóa thẳng người dùng sẽ kéo theo đơn đặt, thanh toán và cả cụm sân
--    (cùng sổ sách tiền cọc của người khác). Vì vậy tách làm hai bước:
--      anonymize_user()  xóa dữ liệu cá nhân, GIỮ các dòng tài chính (đơn, thanh toán, thuê bao) đã bỏ tên;
--      máy chủ web sau đó xóa hẳn tài khoản đăng nhập nếu không còn dòng nào phải giữ, ngược lại xóa mềm.
--    Chứng từ giao dịch phải được lưu theo luật kế toán, và Nghị định 13 cho phép giữ dữ liệu khi luật yêu cầu.
--    account_deletion_blockers() chặn xóa khi còn việc dang dở (đơn sắp tới, tiền cọc chưa hoàn).
--
-- 2. XUẤT DỮ LIỆU: export_user_data() gom dữ liệu của một người thành một JSON (quyền truy cập, Điều 14 Nghị định 13).
--
-- 3. ĐỐI SOÁT: hai thao tác cho quản trị xử lý khoản tiền lệch sổ (đánh dấu đã hoàn tiền; xác nhận lại đơn kẹt).
--
-- Mọi hàm chỉ service_role gọi được: máy chủ web kiểm tra danh tính/quyền trước.
-- ==============================================================================

-- Dấu vết đã xóa: không có quyền đọc cho anon/authenticated (cột không nằm trong các GRANT theo cột của profiles)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ==============================================================================
-- 1a. Những việc dang dở khiến chưa nên xóa tài khoản. Trả về mảng mã lý do (rỗng = xóa được).
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.account_deletion_blockers(p_user UUID)
RETURNS TEXT[] AS $$
DECLARE
  r TEXT[] := '{}';
BEGIN
  -- Quản trị là vai trò gán tay: xóa nhầm sẽ làm nền tảng mất người quản trị
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user AND role = 'admin') THEN
    r := array_append(r, 'admin');
  END IF;

  -- Với tư cách khách: còn đơn sắp tới (đã xác nhận, hoặc đang giữ chỗ chưa hết hạn)
  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.user_id = p_user AND b.end_time > NOW()
      AND (b.status = 'confirmed' OR (b.status = 'pending' AND b.expires_at > NOW()))
  ) THEN
    r := array_append(r, 'active_bookings');
  END IF;

  -- Với tư cách khách: tiền cọc đang chờ được hoàn (xóa rồi thì không còn cách liên lạc để trả)
  IF EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.user_id = p_user AND p.status = 'paid' AND COALESCE((p.metadata->>'needs_refund')::boolean, FALSE)
  ) OR EXISTS (
    SELECT 1 FROM public.bookings b WHERE b.user_id = p_user AND b.refund_status = 'pending'
  ) THEN
    r := array_append(r, 'refund_owed');
  END IF;

  -- Với tư cách chủ sân: còn khách sắp tới tại cụm sân của mình
  IF EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.courts ct ON ct.id = b.court_id
    JOIN public.clubs c ON c.id = ct.club_id
    WHERE c.owner_id = p_user AND b.end_time > NOW()
      AND (b.status = 'confirmed' OR (b.status = 'pending' AND b.expires_at > NOW()))
  ) THEN
    r := array_append(r, 'club_active_bookings');
  END IF;

  -- Với tư cách chủ sân: còn khoản cọc phải hoàn cho khách
  IF EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.courts ct ON ct.id = b.court_id
    JOIN public.clubs c ON c.id = ct.club_id
    WHERE c.owner_id = p_user AND b.refund_status = 'pending'
  ) OR EXISTS (
    SELECT 1
    FROM public.payments p
    JOIN public.bookings b ON b.id = p.booking_id
    JOIN public.courts ct ON ct.id = b.court_id
    JOIN public.clubs c ON c.id = ct.club_id
    WHERE c.owner_id = p_user AND p.status = 'paid' AND COALESCE((p.metadata->>'needs_refund')::boolean, FALSE)
  ) THEN
    r := array_append(r, 'club_refunds_pending');
  END IF;

  RETURN r;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.account_deletion_blockers(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_deletion_blockers(UUID) TO service_role;

-- ==============================================================================
-- 1b. Xóa dữ liệu cá nhân của một người, giữ lại sổ sách tài chính đã bỏ tên.
--     Trả về TRUE nếu còn dòng phải giữ (đơn, thanh toán, thuê bao, cụm sân) → nơi gọi phải XÓA MỀM tài khoản
--     đăng nhập vì xóa cứng sẽ kéo theo các dòng đó. FALSE → xóa cứng được.
--     Chạy trong một transaction: lỗi giữa chừng thì không đổi gì.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.anonymize_user(p_user UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_retained BOOLEAN;
BEGIN
  -- Khóa hồ sơ để hai lần xóa đồng thời không chồng lên nhau
  PERFORM 1 FROM public.profiles WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;

  -- Kiểm tra lại ngay trong transaction (nơi gọi đã kiểm tra, nhưng trạng thái có thể vừa đổi)
  IF array_length(public.account_deletion_blockers(p_user), 1) IS NOT NULL THEN
    RAISE EXCEPTION 'DELETION_BLOCKED';
  END IF;

  -- Cụm sân của chủ sân: ngừng nhận khách và xóa thông tin nhận tiền (khóa PayOS, tài khoản ngân hàng).
  -- Cụm sân/sân con vẫn được giữ vì đơn đặt cũ của khách trỏ vào đó.
  UPDATE public.clubs
  SET is_active = FALSE, accepts_online_payment = FALSE, accepts_manual_transfer = FALSE
  WHERE owner_id = p_user;
  UPDATE public.courts SET is_active = FALSE
  WHERE club_id IN (SELECT id FROM public.clubs WHERE owner_id = p_user);
  DELETE FROM public.club_payment_settings WHERE club_id IN (SELECT id FROM public.clubs WHERE owner_id = p_user);
  DELETE FROM public.club_bank_accounts WHERE club_id IN (SELECT id FROM public.clubs WHERE owner_id = p_user);

  -- Ghi chú tự do của đơn có thể chứa thông tin cá nhân; các cột tiền/giờ giữ nguyên làm chứng từ
  UPDATE public.bookings SET note = NULL WHERE user_id = p_user AND note IS NOT NULL;

  -- Rời mọi kèo (trigger đếm lại số người và mở lại kèo nếu cần), xóa lời nhắn xin vào
  UPDATE public.match_participants
  SET status = 'left', message = NULL
  WHERE user_id = p_user AND (status IN ('pending', 'accepted') OR message IS NOT NULL);

  -- Nội dung người dùng tự viết
  DELETE FROM public.match_messages WHERE user_id = p_user;
  DELETE FROM public.club_reviews WHERE user_id = p_user;
  DELETE FROM public.support_tickets WHERE user_id = p_user; -- kéo theo ticket_messages
  DELETE FROM public.notifications WHERE user_id = p_user;
  DELETE FROM public.push_tokens WHERE user_id = p_user;
  DELETE FROM public.rate_limits WHERE key LIKE '%:' || p_user::text;

  -- Đăng nhập Zalo (tài khoản xóa mềm vẫn còn dòng auth.users, nên phải gỡ liên kết để người đó đăng ký lại được),
  -- danh sách chờ khung giờ, và lịch cố định (tác vụ định kỳ không được tạo thêm đơn cho tài khoản đã xóa)
  DELETE FROM public.zalo_identities WHERE user_id = p_user;
  DELETE FROM public.slot_waitlist WHERE user_id = p_user;
  UPDATE public.recurring_bookings
  SET status = CASE WHEN status IN ('pending', 'active') THEN 'cancelled' ELSE status END, note = NULL
  WHERE user_id = p_user;

  UPDATE public.profiles
  SET full_name = 'Người dùng đã xóa',
      phone_number = NULL,
      avatar_url = NULL,
      deleted_at = NOW()
  WHERE id = p_user;

  v_retained :=
    EXISTS (SELECT 1 FROM public.bookings WHERE user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.payments WHERE user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.subscription_payments WHERE user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.clubs WHERE owner_id = p_user);
  RETURN v_retained;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.anonymize_user(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonymize_user(UUID) TO service_role;

-- ==============================================================================
-- 2. Xuất toàn bộ dữ liệu của một người thành một JSON. Mỗi nhóm tối đa 5000 dòng gần nhất để không phình vô hạn.
--    Không đưa token đẩy, mã QR/liên kết thanh toán, hay khóa PayOS (bí mật hệ thống, không phải dữ liệu của người đó).
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.export_user_data(p_user UUID)
RETURNS JSONB AS $$
  SELECT jsonb_build_object(
    'exported_at', NOW(),
    'profile', (
      SELECT to_jsonb(x) FROM (
        SELECT id, full_name, phone_number, avatar_url, role, skill_level, rating, created_at, updated_at
        FROM public.profiles WHERE id = p_user
      ) x
    ),
    'bookings', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (
        SELECT b.id, c.name AS club_name, ct.name AS court_name, b.start_time, b.end_time, b.total_price,
               b.deposit_amount, b.status, b.is_open_match, b.note, b.created_at, b.cancelled_at, b.cancelled_by,
               b.refund_amount, b.refund_status, b.refunded_at
        FROM public.bookings b
        JOIN public.courts ct ON ct.id = b.court_id
        JOIN public.clubs c ON c.id = ct.club_id
        WHERE b.user_id = p_user
        ORDER BY b.created_at DESC LIMIT 5000
      ) x
    ), '[]'::jsonb),
    'payments', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (
        SELECT id, booking_id, order_code, amount, status, payment_method, paid_at, created_at
        FROM public.payments WHERE user_id = p_user
        ORDER BY created_at DESC LIMIT 5000
      ) x
    ), '[]'::jsonb),
    'subscription_payments', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (
        SELECT id, club_id, order_code, amount, months, status, paid_at, created_at
        FROM public.subscription_payments WHERE user_id = p_user
        ORDER BY created_at DESC LIMIT 5000
      ) x
    ), '[]'::jsonb),
    'matches_created', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (
        SELECT id, booking_id, title, description, sport_type, skill_level, required_players, current_players,
               cost_sharing_type, cost_per_person, status, created_at
        FROM public.matches WHERE creator_id = p_user
        ORDER BY created_at DESC LIMIT 5000
      ) x
    ), '[]'::jsonb),
    'match_participations', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.joined_at DESC) FROM (
        SELECT id, match_id, status, message, joined_at
        FROM public.match_participants WHERE user_id = p_user
        ORDER BY joined_at DESC LIMIT 5000
      ) x
    ), '[]'::jsonb),
    'match_messages', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (
        SELECT id, match_id, content, created_at
        FROM public.match_messages WHERE user_id = p_user
        ORDER BY created_at DESC LIMIT 5000
      ) x
    ), '[]'::jsonb),
    'club_reviews', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (
        SELECT id, club_id, rating, comment, created_at, updated_at
        FROM public.club_reviews WHERE user_id = p_user
        ORDER BY created_at DESC LIMIT 5000
      ) x
    ), '[]'::jsonb),
    'support_tickets', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (
        SELECT t.id, t.subject, t.category, t.status, t.created_at,
               COALESCE((
                 SELECT jsonb_agg(jsonb_build_object('from', m.sender_name, 'staff', m.is_staff, 'body', m.body, 'at', m.created_at) ORDER BY m.created_at)
                 FROM public.ticket_messages m WHERE m.ticket_id = t.id
               ), '[]'::jsonb) AS messages
        FROM public.support_tickets t WHERE t.user_id = p_user
        ORDER BY t.created_at DESC LIMIT 1000
      ) x
    ), '[]'::jsonb),
    'notifications', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (
        SELECT id, title, message, type, link, is_read, created_at
        FROM public.notifications WHERE user_id = p_user
        ORDER BY created_at DESC LIMIT 5000
      ) x
    ), '[]'::jsonb),
    'clubs_owned', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (
        SELECT c.id, c.name, c.description, c.address, c.ward, c.district, c.city, c.open_time, c.close_time,
               c.is_active, c.plan, c.plan_until, c.free_cancel_hours, c.created_at,
               (SELECT to_jsonb(ba) FROM (
                  SELECT bank_bin, account_number, account_name FROM public.club_bank_accounts WHERE club_id = c.id
                ) ba) AS bank_account
        FROM public.clubs c WHERE c.owner_id = p_user
        ORDER BY c.created_at DESC LIMIT 1000
      ) x
    ), '[]'::jsonb)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.export_user_data(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.export_user_data(UUID) TO service_role;

-- ==============================================================================
-- 3a. Đối soát: quản trị đã chuyển trả cọc cho khách → đóng khoản "cần hoàn tiền".
--     Chuyển payment sang 'refunded' (khỏi doanh thu và khỏi danh sách cần hoàn) và ghi ai, khi nào, ghi chú gì.
--     Trả về 'refunded', hoặc 'not_found' nếu payment không còn ở trạng thái cần hoàn (đã xử lý bởi người khác).
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_mark_payment_refunded(p_payment_id UUID, p_admin UUID, p_note TEXT DEFAULT NULL)
RETURNS TEXT AS $$
BEGIN
  UPDATE public.payments
  SET status = 'refunded',
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'refunded_at', NOW(),
        'refunded_by', p_admin,
        'refund_note', left(COALESCE(p_note, ''), 500)
      )
  WHERE id = p_payment_id
    AND status = 'paid'
    AND COALESCE((metadata->>'needs_refund')::boolean, FALSE);

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;
  RETURN 'refunded';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.admin_mark_payment_refunded(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mark_payment_refunded(UUID, UUID, TEXT) TO service_role;

-- ==============================================================================
-- 3b. Đối soát: payment đã 'paid' nhưng đơn chưa được xác nhận (đơn còn pending, hoặc bị cron hết hạn hủy).
--     Xác nhận lại đơn và mở lại kèo; nếu sân đã có người khác đặt thì chuyển sang diện cần hoàn tiền.
--     Trả về 'confirmed' | 'slot_taken' | 'not_stuck' (không còn ở trạng thái kẹt, vd. đã được xử lý trước đó).
--     Đơn do khách/chủ sân chủ động hủy (cancelled_by có giá trị) KHÔNG phải kẹt: khoản cọc của chúng đi theo luồng hoàn cọc.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_repair_paid_payment(p_payment_id UUID, p_admin UUID)
RETURNS TEXT AS $$
DECLARE
  v_booking_id UUID;
  v_stamp JSONB := jsonb_build_object('reconciled_at', NOW(), 'reconciled_by', p_admin);
BEGIN
  SELECT p.booking_id INTO v_booking_id
  FROM public.payments p
  JOIN public.bookings b ON b.id = p.booking_id
  WHERE p.id = p_payment_id
    AND p.status = 'paid'
    AND NOT COALESCE((p.metadata->>'needs_refund')::boolean, FALSE)
    AND (b.status = 'pending' OR (b.status = 'cancelled' AND b.cancelled_by IS NULL))
  FOR UPDATE OF p;

  IF NOT FOUND THEN
    RETURN 'not_stuck';
  END IF;

  BEGIN
    UPDATE public.bookings SET status = 'confirmed' WHERE id = v_booking_id AND status IN ('pending', 'cancelled');
    UPDATE public.matches SET status = 'open' WHERE booking_id = v_booking_id AND status = 'cancelled';
    UPDATE public.payments SET metadata = COALESCE(metadata, '{}'::jsonb) || v_stamp WHERE id = p_payment_id;
    RETURN 'confirmed';
  EXCEPTION WHEN exclusion_violation THEN
    UPDATE public.payments
    SET metadata = COALESCE(metadata, '{}'::jsonb) || v_stamp
                   || jsonb_build_object('needs_refund', true, 'reason', 'slot_taken_after_expiry')
    WHERE id = p_payment_id;
    RETURN 'slot_taken';
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.admin_repair_paid_payment(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_repair_paid_payment(UUID, UUID) TO service_role;
