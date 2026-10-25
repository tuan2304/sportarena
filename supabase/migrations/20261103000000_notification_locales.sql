-- ==============================================================================
-- Migration: 20261103000000_notification_locales.sql
-- Description: Thông báo hai ngôn ngữ (Việt - Anh).
--
-- 1. notifications.title_en / message_en: bản tiếng Anh của thông báo (NULL nếu không có, khi đó hiện bản gốc).
--    Bản gốc title/message luôn là tiếng Việt. Máy chủ tự điền hai cột này lúc tạo thông báo; người dùng chỉ đọc.
-- 2. profiles.locale: ngôn ngữ người dùng đã chọn ('vi' / 'en'), để thông báo đẩy gửi đúng ngôn ngữ của người nhận.
--    Cột này không được cấp quyền đọc/ghi trực tiếp cho app: ghi qua set_my_locale(), đọc bằng service_role ở máy chủ.
-- ==============================================================================

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS title_en TEXT,
  ADD COLUMN IF NOT EXISTS message_en TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS locale TEXT CHECK (locale IN ('vi', 'en'));

CREATE OR REPLACE FUNCTION public.set_my_locale(p_locale TEXT)
RETURNS VOID AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Cần đăng nhập';
  END IF;
  IF p_locale NOT IN ('vi', 'en') THEN
    RAISE EXCEPTION 'Ngôn ngữ không hợp lệ';
  END IF;
  UPDATE public.profiles SET locale = p_locale WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.set_my_locale(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_locale(TEXT) TO authenticated, service_role;
