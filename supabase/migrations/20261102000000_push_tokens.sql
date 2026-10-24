-- ==============================================================================
-- Migration: 20261102000000_push_tokens.sql
-- Description: Thông báo đẩy cho ứng dụng mobile.
--
-- Mỗi thiết bị đăng ký một Expo push token. Bảng khóa hoàn toàn với app (không có quyền đọc/ghi trực tiếp, kể cả
-- của chính mình), chỉ đi qua hai hàm dưới đây và service_role của máy chủ web (đọc token để gửi thông báo):
--   register_push_token(token, platform)  gắn token vào người đang đăng nhập; đăng nhập tài khoản khác trên cùng máy
--                                         thì token chuyển sang tài khoản đó (một thiết bị chỉ báo cho một người)
--   unregister_push_token(token)          gỡ token của chính mình khi đăng xuất
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE CHECK (token ~ '^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]{10,}\]$'),
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON public.push_tokens(user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_tokens FROM anon, authenticated;
GRANT ALL ON public.push_tokens TO service_role;

CREATE OR REPLACE FUNCTION public.register_push_token(p_token TEXT, p_platform TEXT)
RETURNS VOID AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Cần đăng nhập';
  END IF;

  INSERT INTO public.push_tokens (user_id, token, platform)
  VALUES (auth.uid(), p_token, p_platform)
  ON CONFLICT (token) DO UPDATE
    SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.unregister_push_token(p_token TEXT)
RETURNS VOID AS $$
  DELETE FROM public.push_tokens WHERE token = p_token AND user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.register_push_token(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.unregister_push_token(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_push_token(TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unregister_push_token(TEXT) TO authenticated, service_role;
