-- ==============================================================================
-- KÈO GHÉP THEO KHUNG GIỜ: hiện giờ/sân của kèo cho mọi người và hết nhận người khi qua giờ kết thúc
-- ==============================================================================
-- Kèo gắn 1-1 với đơn đặt sân nên giờ bắt đầu/kết thúc và sân của kèo là của đơn. Nhưng bảng bookings chỉ cho chủ đơn và
-- chủ sân đọc (RLS), nên người chơi khác nhúng `booking:bookings(...)` vào danh sách kèo chỉ nhận null: card kèo không có giờ,
-- không có sân. Ghi bản sao giờ và sân vào chính bảng matches (đọc công khai) để lộ đúng phần cần thiết mà không lộ
-- giá, ghi chú hay thanh toán của đơn.

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS court_id UUID REFERENCES public.courts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;

-- Điền cho các kèo đã có
UPDATE public.matches m
SET court_id = b.court_id, start_time = b.start_time, end_time = b.end_time
FROM public.bookings b
WHERE b.id = m.booking_id
  AND (m.court_id IS NULL OR m.start_time IS NULL OR m.end_time IS NULL);

ALTER TABLE public.matches
  ALTER COLUMN court_id SET NOT NULL,
  ALTER COLUMN start_time SET NOT NULL,
  ALTER COLUMN end_time SET NOT NULL;

-- Danh sách kèo lọc theo giờ kết thúc (kèo chưa kết thúc)
CREATE INDEX IF NOT EXISTS idx_matches_end_time ON public.matches (end_time);
CREATE INDEX IF NOT EXISTS idx_matches_court ON public.matches (court_id);

-- Kèo mới tự lấy sân và giờ từ đơn đặt sân (nơi gọi không cần và không được tự điền)
CREATE OR REPLACE FUNCTION public.fill_match_slot()
RETURNS TRIGGER AS $$
BEGIN
  SELECT b.court_id, b.start_time, b.end_time
    INTO NEW.court_id, NEW.start_time, NEW.end_time
  FROM public.bookings b
  WHERE b.id = NEW.booking_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_fill_match_slot ON public.matches;
CREATE TRIGGER trg_fill_match_slot
BEFORE INSERT OR UPDATE OF booking_id ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.fill_match_slot();

-- Đơn đổi sân/giờ thì kèo đổi theo
CREATE OR REPLACE FUNCTION public.sync_match_slot()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.matches
  SET court_id = NEW.court_id, start_time = NEW.start_time, end_time = NEW.end_time
  WHERE booking_id = NEW.id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_match_slot ON public.bookings;
CREATE TRIGGER trg_sync_match_slot
AFTER UPDATE OF court_id, start_time, end_time ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.sync_match_slot();

-- Kèo đã qua giờ kết thúc chưa
CREATE OR REPLACE FUNCTION public.match_has_ended(p_match UUID)
RETURNS BOOLEAN AS $$
  SELECT COALESCE((SELECT m.end_time <= NOW() FROM public.matches m WHERE m.id = p_match), FALSE);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.match_has_ended(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_has_ended(UUID) TO anon, authenticated, service_role;

-- Xin tham gia (mobile insert trực tiếp): chỉ vào kèo đang mở, chưa qua giờ kết thúc, không phải kèo của mình
DROP POLICY IF EXISTS "Authenticated users can request to join matches" ON public.match_participants;
CREATE POLICY "Authenticated users can request to join matches"
  ON public.match_participants FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id AND m.status = 'open' AND m.creator_id <> auth.uid()
    )
    AND NOT public.match_has_ended(match_id)
  );

-- Duyệt vào kèo: chặn thêm khi kèo đã qua giờ (từ chối hay rời kèo vẫn được)
CREATE OR REPLACE FUNCTION public.guard_match_capacity()
RETURNS TRIGGER AS $$
DECLARE
  m RECORD;
  accepted_others INTEGER;
BEGIN
  IF NEW.status = 'accepted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'accepted') THEN
    SELECT id, required_players, status, end_time INTO m
    FROM public.matches WHERE id = NEW.match_id FOR UPDATE;

    IF m.status NOT IN ('open', 'full') THEN
      RAISE EXCEPTION 'MATCH_CLOSED' USING ERRCODE = 'P0001';
    END IF;

    IF m.end_time <= NOW() THEN
      RAISE EXCEPTION 'MATCH_ENDED' USING ERRCODE = 'P0001';
    END IF;

    SELECT COUNT(*) INTO accepted_others
    FROM public.match_participants
    WHERE match_id = NEW.match_id AND status = 'accepted' AND id <> NEW.id;

    -- required_players đã gồm cả chủ kèo
    IF 1 + accepted_others >= m.required_players THEN
      RAISE EXCEPTION 'MATCH_FULL' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
