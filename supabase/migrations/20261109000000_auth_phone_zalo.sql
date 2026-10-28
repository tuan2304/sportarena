-- ==============================================================================
-- Migration: 20261109000000_auth_phone_zalo.sql
-- Description: Đăng nhập bằng OTP điện thoại và Zalo (Google/Apple dùng sẵn của Supabase Auth, không cần bảng riêng).
--
-- 1. Người đăng ký bằng số điện thoại có hồ sơ mang sẵn số đó (profiles.phone_number).
-- 2. Zalo không phải nhà cung cấp có sẵn của Supabase nên web tự làm luồng OAuth và nối tài khoản Zalo với một user
--    Supabase qua bảng zalo_identities. Bảng khóa hoàn toàn với app, chỉ máy chủ (service_role) đọc ghi.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  requested_role TEXT := COALESCE(NEW.raw_user_meta_data->>'role', 'player');
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, role, phone_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
    CASE WHEN requested_role IN ('player', 'owner') THEN requested_role ELSE 'player' END,
    CASE WHEN COALESCE(NEW.phone, '') <> '' THEN '+' || NEW.phone ELSE NULL END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TABLE IF NOT EXISTS public.zalo_identities (
  zalo_id TEXT PRIMARY KEY CHECK (zalo_id ~ '^[0-9]{1,40}$'),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.zalo_identities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.zalo_identities FROM anon, authenticated;
GRANT ALL ON public.zalo_identities TO service_role;
