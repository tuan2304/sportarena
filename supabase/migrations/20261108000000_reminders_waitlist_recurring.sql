-- ==============================================================================
-- Migration: 20261108000000_reminders_waitlist_recurring.sql
-- Description: Nhắc lịch trước giờ chơi, danh sách chờ khi khung giờ được nhả, đặt lịch cố định hằng tuần.
--
-- Cả ba đều được một tác vụ định kỳ (web/src/app/api/cron/tick) xử lý bằng các hàm "claim" bên dưới. Mỗi hàm vừa chọn
-- vừa đánh dấu đã xử lý trong cùng một câu lệnh, nên hai lần chạy chồng nhau (cron chạy trễ, gọi tay) không bao giờ
-- nhắc hay báo trùng cho cùng một người.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. NHẮC LỊCH TRƯỚC GIỜ CHƠI
-- ------------------------------------------------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- Đơn đã xác nhận sắp tới giờ chơi và chưa nhắc. Đơn đặt khi đã còn dưới `p_lead` thì không nhắc (người đặt vừa
-- biết giờ rồi); đơn đó được đánh dấu luôn để lần sau không phải quét lại.
-- Kèm danh sách thành viên đã được duyệt của kèo gắn với đơn để nhắc cả nhóm.
CREATE OR REPLACE FUNCTION public.claim_due_reminders(p_lead INTERVAL DEFAULT INTERVAL '2 hours')
RETURNS TABLE (
  booking_id UUID,
  user_id UUID,
  start_time TIMESTAMPTZ,
  court_name TEXT,
  club_name TEXT,
  match_id UUID,
  match_title TEXT,
  member_ids UUID[]
) AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    UPDATE public.bookings b
    SET reminder_sent_at = NOW()
    WHERE b.status = 'confirmed'
      AND b.reminder_sent_at IS NULL
      AND b.start_time > NOW()
      AND b.start_time <= NOW() + p_lead
    RETURNING b.id, b.user_id, b.start_time, b.court_id, b.created_at
  )
  SELECT
    d.id,
    d.user_id,
    d.start_time,
    c.name,
    cl.name,
    m.id,
    m.title,
    COALESCE(
      (SELECT ARRAY_AGG(p.user_id) FROM public.match_participants p WHERE p.match_id = m.id AND p.status = 'accepted'),
      '{}'::UUID[]
    )
  FROM due d
  JOIN public.courts c ON c.id = d.court_id
  JOIN public.clubs cl ON cl.id = c.club_id
  LEFT JOIN public.matches m ON m.booking_id = d.id AND m.status IN ('open', 'full')
  WHERE d.created_at <= d.start_time - p_lead;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.claim_due_reminders(INTERVAL) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_reminders(INTERVAL) TO service_role;

-- ------------------------------------------------------------------------------
-- 2. DANH SÁCH CHỜ KHUNG GIỜ
-- ------------------------------------------------------------------------------
-- Người chơi muốn một khung giờ đang kín: đăng ký chờ, khi khung giờ trống (có người hủy hoặc hết hạn giữ chỗ) sẽ được
-- báo, ai đăng ký trước được báo trước.
CREATE TABLE IF NOT EXISTS public.slot_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  court_id UUID NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  -- waiting   đang chờ
  -- notified  đã báo khung giờ trống, chờ người này đặt
  -- fulfilled người này đã đặt được
  -- expired   quá giờ chơi, hoặc đã báo mà không đặt trong hạn giữ chỗ nên nhường người kế tiếp
  -- cancelled người này tự rút
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'fulfilled', 'expired', 'cancelled')),
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_waitlist_time_valid CHECK (end_time > start_time)
);

-- Một người chỉ chờ một khung giờ y hệt một lần tại một thời điểm
CREATE UNIQUE INDEX IF NOT EXISTS uq_slot_waitlist_active
  ON public.slot_waitlist (user_id, court_id, start_time, end_time)
  WHERE status IN ('waiting', 'notified');
CREATE INDEX IF NOT EXISTS idx_slot_waitlist_pending
  ON public.slot_waitlist (court_id, start_time)
  WHERE status IN ('waiting', 'notified');
CREATE INDEX IF NOT EXISTS idx_slot_waitlist_user ON public.slot_waitlist (user_id);

ALTER TABLE public.slot_waitlist ENABLE ROW LEVEL SECURITY;

-- Người dùng chỉ đọc danh sách chờ của mình; mọi thao tác ghi đi qua server (service_role) để kiểm tra khung giờ
-- thật sự đang kín, giới hạn số lượng và chống spam
DROP POLICY IF EXISTS "Users can view own waitlist" ON public.slot_waitlist;
CREATE POLICY "Users can view own waitlist"
  ON public.slot_waitlist FOR SELECT
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.slot_waitlist FROM anon, authenticated;
GRANT SELECT ON public.slot_waitlist TO authenticated;
GRANT ALL ON public.slot_waitlist TO service_role;

-- Khung giờ này có đơn đang giữ chỗ hoặc đã xác nhận chồng lên không
CREATE OR REPLACE FUNCTION public.slot_is_busy(p_court UUID, p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.court_id = p_court
      AND b.during && tstzrange(p_start, p_end, '[)')
      AND (b.status = 'confirmed' OR (b.status = 'pending' AND b.expires_at > NOW()))
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.slot_is_busy(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.slot_is_busy(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- Chọn những người chờ mà khung giờ đã trống để báo, theo thứ tự đăng ký. Người được báo có `p_hold` để đặt; hết hạn
-- mà chưa đặt thì chuyển sang 'expired' để người kế tiếp được báo. Hai người chờ khung giờ chồng nhau không bao giờ
-- được báo cùng lúc (tránh tranh nhau), trừ khi người trước đã hết hạn.
CREATE OR REPLACE FUNCTION public.claim_free_waitlist_entries(p_hold INTERVAL DEFAULT INTERVAL '15 minutes')
RETURNS TABLE (id UUID, user_id UUID, court_id UUID, start_time TIMESTAMPTZ, end_time TIMESTAMPTZ) AS $$
DECLARE
  r public.slot_waitlist%ROWTYPE;
BEGIN
  UPDATE public.slot_waitlist w SET status = 'expired'
  WHERE w.status = 'waiting' AND w.start_time <= NOW();

  UPDATE public.slot_waitlist w SET status = 'expired'
  WHERE w.status = 'notified' AND (w.start_time <= NOW() OR w.notified_at <= NOW() - p_hold);

  FOR r IN
    SELECT * FROM public.slot_waitlist w
    WHERE w.status = 'waiting' AND NOT public.slot_is_busy(w.court_id, w.start_time, w.end_time)
    ORDER BY w.created_at, w.id
    FOR UPDATE SKIP LOCKED
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.slot_waitlist o
      WHERE o.status = 'notified' AND o.court_id = r.court_id
        AND tstzrange(o.start_time, o.end_time, '[)') && tstzrange(r.start_time, r.end_time, '[)')
    ) THEN
      CONTINUE;
    END IF;

    UPDATE public.slot_waitlist w SET status = 'notified', notified_at = NOW() WHERE w.id = r.id;
    id := r.id;
    user_id := r.user_id;
    court_id := r.court_id;
    start_time := r.start_time;
    end_time := r.end_time;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.claim_free_waitlist_entries(INTERVAL) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_free_waitlist_entries(INTERVAL) TO service_role;

-- ------------------------------------------------------------------------------
-- 3. LỊCH CỐ ĐỊNH HẰNG TUẦN ("thứ 3 hằng tuần 19h")
-- ------------------------------------------------------------------------------
-- Người chơi gửi yêu cầu, chủ sân duyệt. Sau khi duyệt, tác vụ định kỳ tự tạo các đơn đặt sân cho 4 tuần tới (đơn
-- 'confirmed', cọc 0đ vì khách cố định thường trả tại sân) và cứ thế cuốn chiếu theo thời gian.
-- Giờ lưu theo giờ Việt Nam (cột TIME) để không lệch khi đổi múi giờ máy chủ.
CREATE TABLE IF NOT EXISTS public.recurring_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  court_id UUID NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0 = Chủ nhật ... 6 = Thứ bảy (giờ VN)
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE,
  -- pending    chờ chủ sân duyệt
  -- active     đang chạy, tác vụ định kỳ tự tạo đơn
  -- rejected   chủ sân từ chối
  -- cancelled  người chơi hoặc chủ sân kết thúc lịch cố định
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected', 'cancelled')),
  note TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_recurring_time_valid CHECK (end_time > start_time),
  CONSTRAINT check_recurring_range_valid CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE INDEX IF NOT EXISTS idx_recurring_user ON public.recurring_bookings (user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_court ON public.recurring_bookings (court_id);
CREATE INDEX IF NOT EXISTS idx_recurring_active ON public.recurring_bookings (court_id) WHERE status = 'active';

DROP TRIGGER IF EXISTS update_recurring_bookings_updated_at ON public.recurring_bookings;
CREATE TRIGGER update_recurring_bookings_updated_at
BEFORE UPDATE ON public.recurring_bookings
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.recurring_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users and club owners can view recurring bookings" ON public.recurring_bookings;
CREATE POLICY "Users and club owners can view recurring bookings"
  ON public.recurring_bookings FOR SELECT
  USING (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM public.courts c
      JOIN public.clubs cl ON cl.id = c.club_id
      WHERE c.id = recurring_bookings.court_id AND cl.owner_id = auth.uid()
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.recurring_bookings FROM anon, authenticated;
GRANT SELECT ON public.recurring_bookings TO authenticated;
GRANT ALL ON public.recurring_bookings TO service_role;

-- Đơn sinh ra từ lịch cố định. Mỗi tuần đúng một dòng; kể cả đơn bị hủy hay bị bỏ qua (trùng lịch) vẫn giữ lại để
-- tác vụ định kỳ không tạo lại đúng tuần đó lần nữa.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS recurring_id UUID REFERENCES public.recurring_bookings(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_bookings_recurring_slot
  ON public.bookings (recurring_id, start_time)
  WHERE recurring_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_recurring ON public.bookings (recurring_id) WHERE recurring_id IS NOT NULL;

-- Cho phép bảng dùng chung trong Realtime để màn hình chủ sân cập nhật yêu cầu mới
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'recurring_bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.recurring_bookings;
  END IF;
EXCEPTION WHEN undefined_object THEN
  RAISE NOTICE 'Bỏ qua Realtime cho recurring_bookings: publication supabase_realtime chưa có';
END $$;
