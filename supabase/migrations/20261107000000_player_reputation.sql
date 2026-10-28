-- ==============================================================================
-- Migration: 20261107000000_player_reputation.sql
-- Description: Điểm uy tín người chơi (số lần không đến, hủy muộn) để chủ kèo duyệt người dễ hơn.
--
-- Ba loại sự kiện, mỗi loại ghi ngay trên dòng dữ liệu gốc:
--   bookings.late_cancel        người đặt tự hủy đơn đã xác nhận khi còn ít giờ hơn chính sách hủy miễn phí của cụm sân
--   bookings.no_show_at         chủ sân báo người đặt không đến sân
--   match_participants.no_show_at  chủ kèo báo thành viên đã được duyệt nhưng không đến
--   match_participants.left_late   thành viên đã được duyệt rời kèo khi còn dưới 2 giờ nữa là tới giờ chơi (hoặc đã qua giờ)
--
-- Các cột này chỉ server (service_role) ghi: người dùng không có quyền UPDATE bookings/match_participants.
-- Chỉ left_late do trigger tự đặt, vì rời kèo không đi qua server.
-- get_player_reputation() trả về số đếm công khai (không lộ đơn nào, sân nào), cùng mức công khai với bảng profiles.
-- ==============================================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS late_cancel BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS no_show_at TIMESTAMPTZ;

ALTER TABLE public.match_participants
  ADD COLUMN IF NOT EXISTS no_show_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS left_late BOOLEAN NOT NULL DEFAULT FALSE;

-- Chỉ đếm sự kiện trong 180 ngày gần nhất nên các cột phục vụ truy vấn theo người dùng cần chỉ mục từng phần
CREATE INDEX IF NOT EXISTS idx_bookings_user_reputation
  ON public.bookings (user_id, start_time)
  WHERE no_show_at IS NOT NULL OR late_cancel;
CREATE INDEX IF NOT EXISTS idx_match_participants_reputation
  ON public.match_participants (user_id)
  WHERE no_show_at IS NOT NULL OR left_late;

-- Rời kèo sát giờ: tự đánh dấu khi một thành viên đã được duyệt chuyển sang 'left'
CREATE OR REPLACE FUNCTION public.flag_late_leave()
RETURNS TRIGGER AS $$
DECLARE
  v_start TIMESTAMPTZ;
BEGIN
  IF NEW.status = 'left' AND OLD.status = 'accepted' THEN
    SELECT start_time INTO v_start FROM public.matches WHERE id = NEW.match_id;
    IF v_start IS NOT NULL AND v_start - INTERVAL '2 hours' <= NOW() THEN
      NEW.left_late := TRUE;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_flag_late_leave ON public.match_participants;
CREATE TRIGGER trg_flag_late_leave
BEFORE UPDATE OF status ON public.match_participants
FOR EACH ROW EXECUTE FUNCTION public.flag_late_leave();

-- Số đếm uy tín của một nhóm người dùng (tối đa 100 người mỗi lần gọi).
--   played        số buổi đã diễn ra và có mặt (đơn đã xác nhận/hoàn thành đã qua giờ + kèo đã được duyệt đã kết thúc)
--   no_shows      số buổi không đến trong 180 ngày gần nhất
--   late_cancels  số lần hủy/rời muộn trong 180 ngày gần nhất
-- Điểm và hạng được tính ở web/mobile từ ba số này (lib/reputation.ts) để chỉnh công thức không cần migration.
CREATE OR REPLACE FUNCTION public.get_player_reputation(p_user_ids UUID[])
RETURNS TABLE (user_id UUID, played INTEGER, no_shows INTEGER, late_cancels INTEGER) AS $$
  WITH ids AS (
    SELECT DISTINCT u AS id FROM unnest(p_user_ids[1:100]) AS u
  ),
  window_start AS (SELECT NOW() - INTERVAL '180 days' AS ts)
  SELECT
    ids.id,
    (
      SELECT COUNT(*)::INTEGER FROM public.bookings b
      WHERE b.user_id = ids.id AND b.status IN ('confirmed', 'completed')
        AND b.end_time <= NOW() AND b.no_show_at IS NULL
    ) + (
      SELECT COUNT(*)::INTEGER FROM public.match_participants p
      JOIN public.matches m ON m.id = p.match_id
      WHERE p.user_id = ids.id AND p.status = 'accepted'
        AND m.end_time <= NOW() AND p.no_show_at IS NULL
    ),
    (
      SELECT COUNT(*)::INTEGER FROM public.bookings b, window_start w
      WHERE b.user_id = ids.id AND b.no_show_at IS NOT NULL AND b.start_time >= w.ts
    ) + (
      SELECT COUNT(*)::INTEGER FROM public.match_participants p
      JOIN public.matches m ON m.id = p.match_id, window_start w
      WHERE p.user_id = ids.id AND p.no_show_at IS NOT NULL AND m.start_time >= w.ts
    ),
    (
      SELECT COUNT(*)::INTEGER FROM public.bookings b, window_start w
      WHERE b.user_id = ids.id AND b.late_cancel AND b.start_time >= w.ts
    ) + (
      SELECT COUNT(*)::INTEGER FROM public.match_participants p
      JOIN public.matches m ON m.id = p.match_id, window_start w
      WHERE p.user_id = ids.id AND p.left_late AND m.start_time >= w.ts
    )
  FROM ids;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.get_player_reputation(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_player_reputation(UUID[]) TO anon, authenticated, service_role;
