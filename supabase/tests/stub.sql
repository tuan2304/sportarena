-- Dựng tối thiểu những thứ Supabase có sẵn (role, schema auth, publication) để chạy migration trên Postgres thường.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), raw_user_meta_data jsonb DEFAULT '{}'::jsonb, phone text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

CREATE PUBLICATION supabase_realtime;

-- Supabase cấp sẵn toàn quyền trên schema public cho 3 role này; migration sẽ thu hồi bớt
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- Schema storage tối thiểu của Supabase (bảng bucket/object, hàm foldername) để kiểm thử chính sách lưu trữ
CREATE SCHEMA storage;
CREATE TABLE storage.buckets (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, public BOOLEAN DEFAULT FALSE,
  file_size_limit BIGINT, allowed_mime_types TEXT[]
);
CREATE TABLE storage.objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT REFERENCES storage.buckets(id),
  name TEXT NOT NULL,
  owner UUID
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(name TEXT) RETURNS TEXT[] LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE parts TEXT[];
BEGIN
  parts := string_to_array(name, '/');
  RETURN parts[1:array_length(parts, 1) - 1];
END $$;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO anon, authenticated, service_role;
