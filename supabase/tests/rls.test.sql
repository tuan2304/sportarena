-- Kiểm thử bảo mật (RLS, quyền cột, trigger) cho Postgres.
-- Chạy bằng: npm run db:test --prefix web   (hoặc bash supabase/tests/run.sh)
-- Mỗi ca gọi t(người dùng, vai trò, câu lệnh, kết quả mong đợi, mô tả).
--   expect = 'ERR' : câu lệnh BẮT BUỘC bị từ chối (tấn công phải thất bại)
--   expect = giá trị: câu lệnh chạy được và trả về đúng giá trị đó

CREATE TABLE test_results (ok boolean NOT NULL, label text NOT NULL, detail text);

CREATE OR REPLACE FUNCTION t(uid uuid, r text, q text, expect text, label text) RETURNS void AS $$
DECLARE res text; failed boolean := false; passed boolean;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', COALESCE(uid::text, ''), true);
  EXECUTE 'SET LOCAL ROLE ' || r;
  BEGIN EXECUTE q INTO res; EXCEPTION WHEN OTHERS THEN failed := true; res := SQLERRM; END;
  EXECUTE 'RESET ROLE';
  IF expect = 'ERR' THEN passed := failed; ELSE passed := (NOT failed) AND res IS NOT DISTINCT FROM expect; END IF;
  INSERT INTO test_results VALUES (passed, label, 'got=' || left(coalesce(res, 'NULL'), 70) || ' expect=' || expect);
END $$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------- Dữ liệu nền
INSERT INTO auth.users(id, raw_user_meta_data) VALUES
 ('a0000000-0000-0000-0000-00000000000a', '{"full_name":"Owner","role":"owner"}'),
 ('b0000000-0000-0000-0000-00000000000b', '{"full_name":"Bao","role":"admin"}'),
 ('c0000000-0000-0000-0000-00000000000c', '{"full_name":"Chi"}'),
 ('d0000000-0000-0000-0000-00000000000d', '{"full_name":"Dung"}'),
 ('e0000000-0000-0000-0000-00000000000e', '{"full_name":"Em"}');

SELECT t(NULL,'postgres',$$SELECT role FROM profiles WHERE id='b0000000-0000-0000-0000-00000000000b'$$,'player','đăng ký với role=admin chỉ thành player');
SELECT t(NULL,'postgres',$$SELECT role FROM profiles WHERE id='a0000000-0000-0000-0000-00000000000a'$$,'owner','đăng ký role=owner vẫn được');

INSERT INTO clubs(id, owner_id, name, address) VALUES ('11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-00000000000a','CLB','addr');
INSERT INTO courts(id, club_id, name, sport_type, base_price_per_hour) VALUES ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','San1','pickleball',100000);
INSERT INTO bookings(id, court_id, user_id, start_time, end_time, total_price, deposit_amount, status)
 VALUES ('33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222','b0000000-0000-0000-0000-00000000000b', now()+interval '1 day', now()+interval '1 day 1 hour', 100000, 30000, 'pending');
INSERT INTO matches(id, booking_id, creator_id, title, sport_type, required_players)
 VALUES ('44444444-4444-4444-4444-444444444444','33333333-3333-3333-3333-333333333333','b0000000-0000-0000-0000-00000000000b','Keo','pickleball',3);
INSERT INTO match_participants(id, match_id, user_id) VALUES
 ('50000000-0000-0000-0000-00000000000c','44444444-4444-4444-4444-444444444444','c0000000-0000-0000-0000-00000000000c'),
 ('50000000-0000-0000-0000-00000000000d','44444444-4444-4444-4444-444444444444','d0000000-0000-0000-0000-00000000000d'),
 ('50000000-0000-0000-0000-00000000000e','44444444-4444-4444-4444-444444444444','e0000000-0000-0000-0000-00000000000e');

-- ---------------------------------------------------------------- 1. Hồ sơ
SELECT t('b0000000-0000-0000-0000-00000000000b','authenticated',$$UPDATE profiles SET role='admin' WHERE id=auth.uid() RETURNING 'x'$$,'ERR','tự nâng role admin bị chặn');
SELECT t('b0000000-0000-0000-0000-00000000000b','authenticated',$$UPDATE profiles SET rating=5 WHERE id=auth.uid() RETURNING 'x'$$,'ERR','tự sửa rating bị chặn');
SELECT t('b0000000-0000-0000-0000-00000000000b','authenticated',$$UPDATE profiles SET full_name='Bao2' WHERE id=auth.uid() RETURNING full_name$$,'Bao2','sửa tên của mình (hợp lệ)');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$WITH x AS (UPDATE profiles SET full_name='Hack' WHERE id='d0000000-0000-0000-0000-00000000000d' RETURNING 1) SELECT count(*)::text FROM x$$,'0','sửa hồ sơ người khác không ảnh hưởng dòng nào');

-- ---------------------------------------------------------------- 2. Đơn đặt / thanh toán / kèo
SELECT t('b0000000-0000-0000-0000-00000000000b','authenticated',$$UPDATE bookings SET status='confirmed' WHERE id='33333333-3333-3333-3333-333333333333' RETURNING 'x'$$,'ERR','tự xác nhận đơn không cần trả tiền bị chặn');
SELECT t('b0000000-0000-0000-0000-00000000000b','authenticated',$$INSERT INTO bookings(court_id,user_id,start_time,end_time,total_price,deposit_amount,status) VALUES ('22222222-2222-2222-2222-222222222222','b0000000-0000-0000-0000-00000000000b',now()+interval '3 day',now()+interval '3 day 1 hour',0,0,'confirmed') RETURNING 'x'$$,'ERR','tự chèn đơn giá 0đ đã xác nhận bị chặn');
SELECT t('b0000000-0000-0000-0000-00000000000b','authenticated',$$UPDATE matches SET current_players=1, status='open' WHERE id='44444444-4444-4444-4444-444444444444' RETURNING 'x'$$,'ERR','tự sửa bảng matches bị chặn');
SELECT t('b0000000-0000-0000-0000-00000000000b','authenticated',$$INSERT INTO payments(booking_id,user_id,order_code,amount,status) VALUES ('33333333-3333-3333-3333-333333333333','b0000000-0000-0000-0000-00000000000b',1,0,'paid') RETURNING 'x'$$,'ERR','tự chèn payment đã paid bị chặn');
SELECT t(NULL,'anon',$$SELECT count(*)::text FROM bookings$$,'0','khách chưa đăng nhập không đọc được đơn đặt');

-- ---------------------------------------------------------------- 3. Thành viên kèo & thông báo
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$UPDATE match_participants SET status='accepted' WHERE id='50000000-0000-0000-0000-00000000000c' RETURNING 'x'$$,'ERR','tự duyệt chính mình vào kèo bị chặn');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$INSERT INTO notifications(user_id,title,message) VALUES ('b0000000-0000-0000-0000-00000000000b','spam','spam') RETURNING 'x'$$,'ERR','spam thông báo bị chặn');
SELECT t(NULL,'anon',$$INSERT INTO notifications(user_id,title,message) VALUES ('b0000000-0000-0000-0000-00000000000b','spam','spam') RETURNING 'x'$$,'ERR','khách spam thông báo bị chặn');
INSERT INTO notifications(id,user_id,title,message) VALUES ('77777777-7777-7777-7777-777777777777','c0000000-0000-0000-0000-00000000000c','Tieu de','Noi dung');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$UPDATE notifications SET is_read=true WHERE id='77777777-7777-7777-7777-777777777777' RETURNING is_read::text$$,'true','đánh dấu đã đọc thông báo của mình');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$UPDATE notifications SET title='doi' WHERE id='77777777-7777-7777-7777-777777777777' RETURNING 'x'$$,'ERR','sửa nội dung thông báo bị chặn');

-- ---------------------------------------------------------------- 4. Trigger đếm người trong kèo (service_role/superuser)
UPDATE match_participants SET status='accepted' WHERE id='50000000-0000-0000-0000-00000000000c';
SELECT t(NULL,'postgres',$$SELECT current_players||'/'||status FROM matches WHERE id='44444444-4444-4444-4444-444444444444'$$,'2/open','duyệt 1 người → 2 người, còn mở');
UPDATE match_participants SET status='accepted' WHERE id='50000000-0000-0000-0000-00000000000d';
SELECT t(NULL,'postgres',$$SELECT current_players||'/'||status FROM matches WHERE id='44444444-4444-4444-4444-444444444444'$$,'3/full','duyệt đủ người → full');
SELECT t(NULL,'postgres',$$UPDATE match_participants SET status='accepted' WHERE id='50000000-0000-0000-0000-00000000000e' RETURNING 'x'$$,'ERR','duyệt quá số người cần bị chặn (MATCH_FULL)');
UPDATE match_participants SET status='left' WHERE id='50000000-0000-0000-0000-00000000000d';
SELECT t(NULL,'postgres',$$SELECT current_players||'/'||status FROM matches WHERE id='44444444-4444-4444-4444-444444444444'$$,'2/open','một người rời → mở lại kèo');

-- ---------------------------------------------------------------- 5. Chat chỉ cho thành viên
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$WITH x AS (INSERT INTO match_messages(match_id,user_id,content) VALUES ('44444444-4444-4444-4444-444444444444','c0000000-0000-0000-0000-00000000000c','hi') RETURNING 1) SELECT count(*)::text FROM x$$,'1','thành viên đã duyệt chat được');
SELECT t('e0000000-0000-0000-0000-00000000000e','authenticated',$$INSERT INTO match_messages(match_id,user_id,content) VALUES ('44444444-4444-4444-4444-444444444444','e0000000-0000-0000-0000-00000000000e','hi') RETURNING 'x'$$,'ERR','người ngoài kèo gửi chat bị chặn');
SELECT t('e0000000-0000-0000-0000-00000000000e','authenticated',$$SELECT count(*)::text FROM match_messages$$,'0','người ngoài kèo không đọc được chat');
SELECT t(NULL,'anon',$$SELECT count(*)::text FROM match_messages$$,'0','khách không đọc được chat');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT count(*)::text FROM match_messages$$,'1','thành viên đọc được chat');
SELECT t('b0000000-0000-0000-0000-00000000000b','authenticated',$$INSERT INTO match_messages(match_id,user_id,content) VALUES ('44444444-4444-4444-4444-444444444444','b0000000-0000-0000-0000-00000000000b',repeat('x',1001)) RETURNING 'x'$$,'ERR','tin nhắn quá 1000 ký tự bị chặn');

-- ---------------------------------------------------------------- 6. Đánh giá chỉ cho người đã chơi
SELECT t('b0000000-0000-0000-0000-00000000000b','authenticated',$$INSERT INTO club_reviews(club_id,user_id,rating) VALUES ('11111111-1111-1111-1111-111111111111','b0000000-0000-0000-0000-00000000000b',5) RETURNING 'x'$$,'ERR','đánh giá khi chưa từng chơi bị chặn');
INSERT INTO bookings(court_id,user_id,start_time,end_time,total_price,deposit_amount,status) VALUES ('22222222-2222-2222-2222-222222222222','b0000000-0000-0000-0000-00000000000b',now()-interval '3 day',now()-interval '3 day' + interval '1 hour',100000,30000,'confirmed');
SELECT t('b0000000-0000-0000-0000-00000000000b','authenticated',$$WITH x AS (INSERT INTO club_reviews(club_id,user_id,rating,comment) VALUES ('11111111-1111-1111-1111-111111111111','b0000000-0000-0000-0000-00000000000b',5,'ok') RETURNING 1) SELECT count(*)::text FROM x$$,'1','đánh giá sau khi đã chơi được');
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$INSERT INTO club_reviews(club_id,user_id,rating) VALUES ('11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-00000000000a',5) RETURNING 'x'$$,'ERR','chủ sân tự đánh giá cụm sân của mình bị chặn');

-- ---------------------------------------------------------------- 7. Hết hạn giữ chỗ
INSERT INTO bookings(id,court_id,user_id,start_time,end_time,total_price,deposit_amount,status,expires_at) VALUES ('66666666-6666-6666-6666-666666666666','22222222-2222-2222-2222-222222222222','c0000000-0000-0000-0000-00000000000c',now()+interval '5 day',now()+interval '5 day 1 hour',100000,30000,'pending',now()-interval '1 minute');
INSERT INTO payments(booking_id,user_id,order_code,amount) VALUES ('66666666-6666-6666-6666-666666666666','c0000000-0000-0000-0000-00000000000c',99,30000);
SELECT t(NULL,'postgres',$$SELECT public.expire_pending_bookings()::text$$,'1','expire_pending_bookings hủy đúng 1 đơn quá hạn');
SELECT t(NULL,'postgres',$$SELECT status FROM bookings WHERE id='66666666-6666-6666-6666-666666666666'$$,'cancelled','đơn quá hạn chuyển cancelled');
SELECT t(NULL,'postgres',$$SELECT status FROM payments WHERE order_code=99$$,'cancelled','payment của đơn quá hạn chuyển cancelled');
SELECT t(NULL,'postgres',$$SELECT count(*)::text FROM notifications WHERE user_id='c0000000-0000-0000-0000-00000000000c' AND title LIKE 'Hết hạn%'$$,'1','người đặt nhận thông báo hết hạn');
SELECT t(NULL,'postgres',$$WITH x AS (INSERT INTO bookings(court_id,user_id,start_time,end_time,total_price,deposit_amount,status) SELECT court_id,'d0000000-0000-0000-0000-00000000000d',start_time,end_time,total_price,deposit_amount,'pending' FROM bookings WHERE id='66666666-6666-6666-6666-666666666666' RETURNING 1) SELECT count(*)::text FROM x$$,'1','khung giờ vừa nhả đặt lại được');
SELECT t(NULL,'postgres',$$WITH x AS (INSERT INTO bookings(court_id,user_id,start_time,end_time,total_price,deposit_amount,status) SELECT court_id,'e0000000-0000-0000-0000-00000000000e',start_time,end_time,total_price,deposit_amount,'pending' FROM bookings WHERE user_id='d0000000-0000-0000-0000-00000000000d' RETURNING 1) SELECT count(*)::text FROM x$$,'ERR','đặt trùng khung giờ đang giữ chỗ bị ràng buộc GiST chặn');

-- ---------------------------------------------------------------- 8. Hàm đặc quyền & lịch bận
SELECT t('b0000000-0000-0000-0000-00000000000b','authenticated',$$SELECT public.expire_pending_bookings()::text$$,'ERR','người dùng không gọi được expire_pending_bookings');
SELECT t('b0000000-0000-0000-0000-00000000000b','authenticated',$$SELECT public.next_payos_order_code()::text$$,'ERR','người dùng không gọi được next_payos_order_code');
SELECT t(NULL,'service_role',$$SELECT public.next_payos_order_code()::text$$,'10000000','service_role lấy được orderCode');
SELECT t(NULL,'anon',$$SELECT count(*)::text FROM public.get_busy_slots(ARRAY['22222222-2222-2222-2222-222222222222']::uuid[])$$,'2','khách xem được lịch bận (chỉ khung giờ còn hiệu lực)');

-- ---------------------------------------------------------------- 9. Giai đoạn 11-12: PayOS riêng, thuê bao, đối soát
INSERT INTO auth.users(id, raw_user_meta_data) VALUES ('f0000000-0000-0000-0000-00000000000f', '{"full_name":"Owner 2","role":"owner"}');

-- 9a. Khóa PayOS: không ai ngoài service_role đọc/ghi được
INSERT INTO club_payment_settings(club_id, payos_client_id, payos_api_key_enc, payos_checksum_key_enc, verified_at)
  VALUES ('11111111-1111-1111-1111-111111111111', 'cid', 'v1.x.y.z', 'v1.x.y.z', now());
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$SELECT count(*)::text FROM club_payment_settings$$,'ERR','chính chủ sân cũng không đọc được bảng khóa PayOS');
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$INSERT INTO club_payment_settings(club_id,payos_client_id,payos_api_key_enc,payos_checksum_key_enc) VALUES ('11111111-1111-1111-1111-111111111111','x','y','z') RETURNING 'x'$$,'ERR','chủ sân không tự ghi bảng khóa PayOS');
SELECT t(NULL,'anon',$$SELECT count(*)::text FROM club_payment_settings$$,'ERR','khách không đọc được bảng khóa PayOS');
SELECT t(NULL,'service_role',$$SELECT count(*)::text FROM club_payment_settings$$,'1','server (service_role) đọc được bảng khóa PayOS');

-- 9b. Chủ sân không tự nâng gói hay tự bật cờ nhận thanh toán
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$UPDATE clubs SET plan='pro' WHERE id='11111111-1111-1111-1111-111111111111' RETURNING 'x'$$,'ERR','chủ sân tự nâng lên gói pro bị chặn');
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$UPDATE clubs SET plan_until=now()+interval '5 year' WHERE id='11111111-1111-1111-1111-111111111111' RETURNING 'x'$$,'ERR','chủ sân tự kéo dài hạn gói bị chặn');
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$UPDATE clubs SET accepts_online_payment=true WHERE id='11111111-1111-1111-1111-111111111111' RETURNING 'x'$$,'ERR','chủ sân tự bật cờ nhận thanh toán bị chặn');
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$WITH x AS (UPDATE clubs SET name='CLB moi' WHERE id='11111111-1111-1111-1111-111111111111' RETURNING 1) SELECT count(*)::text FROM x$$,'1','chủ sân vẫn sửa được thông tin cụm sân');
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$WITH x AS (UPDATE clubs SET latitude=10.8031, longitude=106.7358 WHERE id='11111111-1111-1111-1111-111111111111' RETURNING 1) SELECT count(*)::text FROM x$$,'1','chủ sân ghim được vị trí bản đồ của cụm sân mình');
SELECT t('f0000000-0000-0000-0000-00000000000f','authenticated',$$WITH x AS (UPDATE clubs SET latitude=1, longitude=1 WHERE id='11111111-1111-1111-1111-111111111111' RETURNING 1) SELECT count(*)::text FROM x$$,'0','chủ sân khác không sửa được vị trí cụm sân này');
SELECT t('f0000000-0000-0000-0000-00000000000f','authenticated',$$INSERT INTO clubs(owner_id,name,address,plan) VALUES ('f0000000-0000-0000-0000-00000000000f','Lau','x','pro') RETURNING 'x'$$,'ERR','tạo cụm sân kèm plan=pro bị chặn');
SELECT t('f0000000-0000-0000-0000-00000000000f','authenticated',$$WITH x AS (INSERT INTO clubs(owner_id,name,address) VALUES ('f0000000-0000-0000-0000-00000000000f','Hop le','x') RETURNING 1) SELECT count(*)::text FROM x$$,'1','tạo cụm sân bình thường vẫn được');
SELECT t(NULL,'postgres',$$SELECT plan||'/'||accepts_online_payment::text FROM clubs WHERE name='Hop le'$$,'free/false','cụm sân mới mặc định gói free, chưa nhận thanh toán');

-- 9c. Thuê bao: áp một lần, cộng dồn hạn, chủ sân chỉ xem được của mình
INSERT INTO subscription_payments(id, club_id, user_id, order_code, amount, months) VALUES
 ('a1000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-00000000000a',5001,199000,1),
 ('a1000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-00000000000a',5002,597000,3);
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$SELECT count(*)::text FROM subscription_payments$$,'2','chủ sân xem được giao dịch thuê bao của mình');
SELECT t('e0000000-0000-0000-0000-00000000000e','authenticated',$$SELECT count(*)::text FROM subscription_payments$$,'0','người khác không xem được giao dịch thuê bao');
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$UPDATE subscription_payments SET status='paid' WHERE id='a1000000-0000-0000-0000-000000000001' RETURNING 'x'$$,'ERR','chủ sân tự đánh dấu đã trả thuê bao bị chặn');
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$INSERT INTO subscription_payments(club_id,user_id,order_code,amount,months,status) VALUES ('11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-00000000000a',9,0,1,'paid') RETURNING 'x'$$,'ERR','chủ sân tự chèn giao dịch thuê bao đã trả bị chặn');
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$SELECT count(*)::text FROM apply_subscription_payment('a1000000-0000-0000-0000-000000000001'::uuid)$$,'ERR','chủ sân không gọi được hàm áp thuê bao');
SELECT t(NULL,'service_role',$$SELECT count(*)::text FROM apply_subscription_payment('a1000000-0000-0000-0000-000000000001'::uuid,'ref1')$$,'1','áp thuê bao lần đầu thành công');
SELECT t(NULL,'postgres',$$SELECT (plan='pro' AND plan_until > now()+interval '29 days' AND plan_until < now()+interval '31 days')::text FROM clubs WHERE id='11111111-1111-1111-1111-111111111111'$$,'true','gói pro, hạn khoảng 30 ngày');
SELECT t(NULL,'service_role',$$SELECT count(*)::text FROM apply_subscription_payment('a1000000-0000-0000-0000-000000000001'::uuid,'ref1')$$,'0','webhook gọi lặp không cộng hạn lần nữa');
SELECT t(NULL,'service_role',$$SELECT count(*)::text FROM apply_subscription_payment('a1000000-0000-0000-0000-000000000002'::uuid,'ref2')$$,'1','áp tiếp gói 3 tháng');
SELECT t(NULL,'postgres',$$SELECT (plan_until > now()+interval '119 days' AND plan_until < now()+interval '121 days')::text FROM clubs WHERE id='11111111-1111-1111-1111-111111111111'$$,'true','hạn được cộng dồn (30 + 90 ngày)');

-- 9d. Sổ đối soát: chỉ tính cọc thật qua kênh nền tảng
INSERT INTO bookings(id,court_id,user_id,start_time,end_time,total_price,deposit_amount,status) VALUES
 ('b1000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','c0000000-0000-0000-0000-00000000000c',now()+interval '20 day',now()+interval '20 day 1 hour',1,1,'confirmed'),
 ('b1000000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','c0000000-0000-0000-0000-00000000000c',now()+interval '21 day',now()+interval '21 day 1 hour',1,1,'confirmed'),
 ('b1000000-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222','c0000000-0000-0000-0000-00000000000c',now()+interval '22 day',now()+interval '22 day 1 hour',1,1,'confirmed'),
 ('b1000000-0000-0000-0000-000000000004','22222222-2222-2222-2222-222222222222','c0000000-0000-0000-0000-00000000000c',now()+interval '23 day',now()+interval '23 day 1 hour',1,1,'confirmed'),
 ('b1000000-0000-0000-0000-000000000005','22222222-2222-2222-2222-222222222222','c0000000-0000-0000-0000-00000000000c',now()+interval '24 day',now()+interval '24 day 1 hour',1,1,'confirmed'),
 ('b1000000-0000-0000-0000-000000000006','22222222-2222-2222-2222-222222222222','c0000000-0000-0000-0000-00000000000c',now()+interval '25 day',now()+interval '25 day 1 hour',1,1,'confirmed');
INSERT INTO payments(booking_id,user_id,order_code,amount,status,metadata) VALUES
 ('b1000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-00000000000c',1001,100000,'paid','{"channel":"platform"}'),
 ('b1000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-00000000000c',1002,50000,'paid','{"channel":"club"}'),
 ('b1000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-00000000000c',1003,30000,'paid','{"channel":"platform","simulated":true}'),
 ('b1000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-00000000000c',1004,20000,'paid','{"channel":"platform","needs_refund":true}'),
 ('b1000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-00000000000c',1005,10000,'pending','{"channel":"platform"}'),
 ('b1000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-00000000000c',1006,5000,'paid','{}');
SELECT t(NULL,'postgres',$$SELECT (to_regclass('public.payouts') IS NULL)::text$$,'true','bảng payouts đã được gỡ');
SELECT t(NULL,'service_role',$$SELECT * FROM club_balances()$$,'ERR','hàm đối soát club_balances đã được gỡ');
SELECT t(NULL,'service_role',$$SELECT (public.platform_stats(now() - interval '30 days', now() + interval '1 day') ? 'owed_total')::text$$,'false','platform_stats không còn trả owed_total');

-- ---------------------------------------------------------------- 10. Trang quản trị: ticket, thông báo, thống kê
INSERT INTO auth.users(id, raw_user_meta_data) VALUES ('99999999-9999-9999-9999-999999999999', '{"full_name":"Quan tri"}');
UPDATE profiles SET role = 'admin' WHERE id = '99999999-9999-9999-9999-999999999999';
SELECT t(NULL,'postgres',$$SELECT public.is_admin('99999999-9999-9999-9999-999999999999')::text$$,'true','is_admin nhận ra tài khoản quản trị');
SELECT t(NULL,'postgres',$$SELECT public.is_admin('c0000000-0000-0000-0000-00000000000c')::text$$,'false','is_admin từ chối người chơi');

-- 10a. Ticket
INSERT INTO support_tickets(id, user_id, subject, category) VALUES ('d1000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-00000000000c','Khong nhan duoc coc','payment');
INSERT INTO ticket_messages(ticket_id, sender_id, sender_name, body) VALUES ('d1000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-00000000000c','Chi','Em da chuyen khoan nhung don chua xac nhan');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT count(*)::text FROM support_tickets$$,'1','người dùng xem được phiếu của mình');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT count(*)::text FROM ticket_messages$$,'1','người dùng xem được tin nhắn trong phiếu của mình');
SELECT t('d0000000-0000-0000-0000-00000000000d','authenticated',$$SELECT count(*)::text FROM support_tickets$$,'0','người khác không thấy phiếu');
SELECT t('d0000000-0000-0000-0000-00000000000d','authenticated',$$SELECT count(*)::text FROM ticket_messages$$,'0','người khác không đọc được tin nhắn trong phiếu');
SELECT t(NULL,'anon',$$SELECT count(*)::text FROM support_tickets$$,'0','khách không thấy phiếu');
SELECT t('99999999-9999-9999-9999-999999999999','authenticated',$$SELECT count(*)::text FROM support_tickets$$,'1','quản trị thấy mọi phiếu');
SELECT t('99999999-9999-9999-9999-999999999999','authenticated',$$SELECT count(*)::text FROM ticket_messages$$,'1','quản trị đọc được mọi tin nhắn');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$INSERT INTO support_tickets(user_id,subject) VALUES ('c0000000-0000-0000-0000-00000000000c','Tu tao phieu truc tiep') RETURNING 'x'$$,'ERR','tự tạo phiếu trực tiếp bị chặn (phải qua server)');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$INSERT INTO ticket_messages(ticket_id,sender_id,is_staff,sender_name,body) VALUES ('d1000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-00000000000c',true,'Ho tro','Gia mao nhan vien') RETURNING 'x'$$,'ERR','giả mạo tin nhắn của nhân viên hỗ trợ bị chặn');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$UPDATE support_tickets SET status='resolved' WHERE id='d1000000-0000-0000-0000-000000000001' RETURNING 'x'$$,'ERR','tự đổi trạng thái phiếu bị chặn');
SELECT t(NULL,'postgres',$$INSERT INTO support_tickets(user_id,subject) VALUES ('c0000000-0000-0000-0000-00000000000c','ab') RETURNING 'x'$$,'ERR','tiêu đề phiếu quá ngắn bị ràng buộc chặn');
SELECT t(NULL,'postgres',$$INSERT INTO ticket_messages(ticket_id,body) VALUES ('d1000000-0000-0000-0000-000000000001', repeat('x', 2001)) RETURNING 'x'$$,'ERR','tin nhắn quá 2000 ký tự bị chặn');

-- 10b. Thông báo cập nhật
INSERT INTO announcements(id, title, body, audience) VALUES ('a2000000-0000-0000-0000-000000000001','Cap nhat moi','Noi dung thong bao cho chu san','owners');
INSERT INTO announcements(id, title, body, audience) VALUES ('a2000000-0000-0000-0000-000000000002','Bao tri he thong','Noi dung gui toi tat ca','all');
INSERT INTO announcements(id, title, body, audience) VALUES ('a2000000-0000-0000-0000-000000000003','Uu dai nguoi choi','Noi dung gui nguoi choi','players');
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$SELECT count(*)::text FROM announcements$$,'ERR','người dùng không đọc được bảng thông báo hệ thống (chỉ server)');
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$SELECT public.broadcast_announcement('a2000000-0000-0000-0000-000000000001'::uuid)::text$$,'ERR','người dùng không gọi được hàm gửi thông báo');
SELECT t(NULL,'service_role',$$SELECT public.broadcast_announcement('a2000000-0000-0000-0000-000000000001'::uuid)::text$$,'3','gửi cho chủ sân: 2 chủ sân + 1 quản trị');
SELECT t(NULL,'postgres',$$SELECT count(*)::text FROM notifications WHERE title='Cap nhat moi'$$,'3','đã tạo đúng 3 thông báo trong chuông');
SELECT t(NULL,'service_role',$$SELECT public.broadcast_announcement('a2000000-0000-0000-0000-000000000001'::uuid)::text$$,'ERR','gửi lần hai bị chặn (không tạo thông báo trùng)');
SELECT t(NULL,'service_role',$$SELECT public.broadcast_announcement('a2000000-0000-0000-0000-000000000002'::uuid)::text$$,'7','gửi cho tất cả: mọi hồ sơ (7 tài khoản)');
SELECT t(NULL,'service_role',$$SELECT public.broadcast_announcement('a2000000-0000-0000-0000-000000000003'::uuid)::text$$,'4','gửi cho người chơi: đúng 4 người chơi');
SELECT t(NULL,'postgres',$$SELECT sent_count::text FROM announcements WHERE id='a2000000-0000-0000-0000-000000000003'$$,'4','ghi lại số người đã nhận');
SELECT t('d0000000-0000-0000-0000-00000000000d','authenticated',$$SELECT count(*)::text FROM notifications WHERE title='Cap nhat moi'$$,'0','người chơi không nhận thông báo dành riêng cho chủ sân');
SELECT t('f0000000-0000-0000-0000-00000000000f','authenticated',$$SELECT count(*)::text FROM notifications WHERE title='Cap nhat moi'$$,'1','chủ sân nhận được thông báo của mình');

-- 10c. Thống kê
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$SELECT public.platform_stats(now() - interval '30 days', now() + interval '1 day')::text$$,'ERR','người dùng không gọi được hàm thống kê');
SELECT t(NULL,'service_role',$$SELECT (public.platform_stats(now() - interval '30 days', now() + interval '1 day')->'deposits'->>'collected')$$,'175000','cọc thật đã thu (bỏ giả lập)');
SELECT t(NULL,'service_role',$$SELECT (public.platform_stats(now() - interval '30 days', now() + interval '1 day')->'deposits'->>'platform_channel')$$,'125000','cọc qua kênh nền tảng');
SELECT t(NULL,'service_role',$$SELECT (public.platform_stats(now() - interval '30 days', now() + interval '1 day')->'deposits'->>'club_channel')$$,'50000','cọc qua kênh riêng của chủ sân');
SELECT t(NULL,'service_role',$$SELECT (public.platform_stats(now() - interval '30 days', now() + interval '1 day')->'deposits'->>'needs_refund')$$,'20000','cọc cần hoàn tiền');
SELECT t(NULL,'service_role',$$SELECT (public.platform_stats(now() - interval '30 days', now() + interval '1 day')->'subscriptions'->>'revenue')$$,'796000','doanh thu thuê bao (199k + 597k)');
SELECT t(NULL,'service_role',$$SELECT (public.platform_stats(now() - interval '30 days', now() + interval '1 day')->>'open_tickets')$$,'1','số phiếu đang chờ xử lý');
SELECT t(NULL,'service_role',$$SELECT (jsonb_array_length(public.platform_stats(now() - interval '30 days', now() + interval '1 day')->'daily') BETWEEN 31 AND 33)::text$$,'true','chuỗi theo ngày có đủ số ngày của khoảng');
SELECT t(NULL,'service_role',$$SELECT (jsonb_array_length(public.platform_stats(now() - interval '30 days', now() + interval '1 day')->'top_clubs') >= 1)::text$$,'true','có cụm sân trong bảng xếp hạng');
SELECT t(NULL,'service_role',$$SELECT (public.platform_stats(now() + interval '10 days', now() + interval '11 days')->'deposits'->>'collected')$$,'0','khoảng không có giao dịch cho kết quả 0');

-- ---------------------------------------------------------------- 11. Quyền đọc theo cột của profiles
UPDATE profiles SET phone_number = '0901234567' WHERE id = 'b0000000-0000-0000-0000-00000000000b';
SELECT t(NULL,'anon',$$SELECT * FROM profiles$$,'ERR','khách không SELECT * được bảng profiles');
SELECT t(NULL,'anon',$$SELECT phone_number FROM profiles$$,'ERR','khách không đọc được số điện thoại');
SELECT t(NULL,'anon',$$SELECT role FROM profiles$$,'ERR','khách không đọc được cột role');
SELECT t(NULL,'anon',$$SELECT full_name FROM profiles WHERE id='c0000000-0000-0000-0000-00000000000c'$$,'Chi','khách vẫn thấy tên hiển thị công khai');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT phone_number FROM profiles WHERE id='b0000000-0000-0000-0000-00000000000b'$$,'ERR','người dùng không đọc được số điện thoại người khác');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT phone_number FROM profiles WHERE id=auth.uid()$$,'ERR','quyền cột áp cho cả số của chính mình (không có đường đọc trực tiếp)');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT * FROM profiles$$,'ERR','người dùng không SELECT * được bảng profiles');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT full_name FROM profiles WHERE id='d0000000-0000-0000-0000-00000000000d'$$,'Dung','người dùng đọc được tên người khác');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT role FROM profiles WHERE id=auth.uid()$$,'player','người dùng đọc được role của mình');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$WITH x AS (UPDATE profiles SET phone_number='0987654321' WHERE id=auth.uid() RETURNING 1) SELECT count(*)::text FROM x$$,'1','người dùng vẫn cập nhật được số điện thoại của mình');
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$SELECT phone_number FROM public.get_booking_contacts(ARRAY['33333333-3333-3333-3333-333333333333']::uuid[])$$,'0901234567','chủ sân lấy được số điện thoại khách đặt sân của mình');
SELECT t('f0000000-0000-0000-0000-00000000000f','authenticated',$$SELECT count(*)::text FROM public.get_booking_contacts(ARRAY['33333333-3333-3333-3333-333333333333']::uuid[])$$,'0','chủ sân khác không lấy được số điện thoại khách');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT count(*)::text FROM public.get_booking_contacts(ARRAY['33333333-3333-3333-3333-333333333333']::uuid[])$$,'0','người chơi không lấy được số điện thoại qua hàm chủ sân');
SELECT t(NULL,'anon',$$SELECT count(*)::text FROM public.get_booking_contacts(ARRAY['33333333-3333-3333-3333-333333333333']::uuid[])$$,'ERR','khách không gọi được hàm lấy số điện thoại');

-- 11b. Các truy vấn công khai của giao diện vẫn chạy được với quyền cột mới
SELECT t(NULL,'anon',$$SELECT count(*)::text FROM club_reviews r JOIN profiles p ON p.id = r.user_id WHERE p.full_name IS NOT NULL$$,'1','khách xem được đánh giá kèm tên người đánh giá');
SELECT t(NULL,'anon',$$SELECT (count(*) > 0)::text FROM matches m JOIN profiles p ON p.id = m.creator_id WHERE p.full_name IS NOT NULL AND p.avatar_url IS NOT NULL$$,'true','khách xem được kèo kèm tên và avatar người tạo');
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$SELECT (count(*) > 0)::text FROM bookings b JOIN courts ct ON ct.id = b.court_id JOIN profiles p ON p.id = b.user_id WHERE p.full_name IS NOT NULL$$,'true','chủ sân xem được đơn đặt kèm tên khách (lịch đặt sân)');

-- 11c. anon không còn quyền ghi ở bất kỳ bảng nào
SELECT t(NULL,'postgres',$$SELECT count(*)::text FROM information_schema.role_table_grants WHERE grantee='anon' AND table_schema='public' AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE')$$,'0','anon không giữ quyền ghi trên bảng nào của schema public');

-- ---------------------------------------------------------------- 12. Giới hạn tần suất
SELECT t(NULL,'service_role',$$SELECT allowed::text FROM rate_limit_hit('t1',3600,2)$$,'true','lần 1 trong ngưỡng được phép');
SELECT t(NULL,'service_role',$$SELECT allowed::text FROM rate_limit_hit('t1',3600,2)$$,'true','lần 2 (đúng ngưỡng) vẫn được phép');
SELECT t(NULL,'service_role',$$SELECT allowed::text FROM rate_limit_hit('t1',3600,2)$$,'false','lần 3 vượt ngưỡng bị chặn');
SELECT t(NULL,'service_role',$$SELECT (retry_after BETWEEN 1 AND 3600)::text FROM rate_limit_hit('t1',3600,2)$$,'true','báo thời gian chờ hợp lệ');
SELECT t(NULL,'service_role',$$SELECT allowed::text FROM rate_limit_hit('t2',3600,2)$$,'true','khóa khác đếm độc lập');
SELECT t(NULL,'service_role',$$SELECT allowed::text FROM rate_limit_hit('t3',0,2)$$,'ERR','cửa sổ không hợp lệ bị từ chối');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT * FROM rate_limit_hit('x',3600,5)$$,'ERR','người dùng không gọi được hàm giới hạn');
SELECT t(NULL,'anon',$$SELECT * FROM rate_limit_hit('x',3600,5)$$,'ERR','khách không gọi được hàm giới hạn');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT count(*)::text FROM rate_limits$$,'ERR','người dùng không đọc được bảng đếm');

-- ---------------------------------------------------------------- 13. Chính sách hủy sân và hoàn cọc
INSERT INTO bookings(id,court_id,user_id,start_time,end_time,total_price,deposit_amount,status)
 VALUES ('b2000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','c0000000-0000-0000-0000-00000000000c',now()+interval '40 day',now()+interval '40 day 1 hour',100000,30000,'confirmed');
SELECT t(NULL,'postgres',$$SELECT free_cancel_hours::text FROM clubs WHERE id='11111111-1111-1111-1111-111111111111'$$,'24','cụm sân mới mặc định hủy miễn phí trước 24 giờ');
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$WITH x AS (UPDATE clubs SET free_cancel_hours=48 WHERE id='11111111-1111-1111-1111-111111111111' RETURNING 1) SELECT count(*)::text FROM x$$,'1','chủ sân đặt được số giờ hủy miễn phí');
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$UPDATE clubs SET free_cancel_hours=500 WHERE id='11111111-1111-1111-1111-111111111111' RETURNING 'x'$$,'ERR','số giờ vượt 168 bị chặn');
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$UPDATE clubs SET free_cancel_hours=-1 WHERE id='11111111-1111-1111-1111-111111111111' RETURNING 'x'$$,'ERR','số giờ âm bị chặn');
SELECT t('f0000000-0000-0000-0000-00000000000f','authenticated',$$WITH x AS (UPDATE clubs SET free_cancel_hours=0 WHERE id='11111111-1111-1111-1111-111111111111' RETURNING 1) SELECT count(*)::text FROM x$$,'0','chủ sân khác không sửa được chính sách hủy');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$WITH x AS (UPDATE clubs SET free_cancel_hours=0 WHERE id='11111111-1111-1111-1111-111111111111' RETURNING 1) SELECT count(*)::text FROM x$$,'0','người chơi không sửa được chính sách hủy');
SELECT t(NULL,'postgres',$$SELECT free_cancel_hours::text FROM clubs WHERE id='11111111-1111-1111-1111-111111111111'$$,'48','chính sách giữ nguyên giá trị chủ sân đặt');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$UPDATE bookings SET status='cancelled', refund_status='refunded', refund_amount=30000 WHERE id='b2000000-0000-0000-0000-000000000001' RETURNING 'x'$$,'ERR','người chơi tự ghi hoàn cọc bị chặn');
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$UPDATE bookings SET refund_status='refunded', refund_amount=30000 WHERE id='b2000000-0000-0000-0000-000000000001' RETURNING 'x'$$,'ERR','chủ sân tự ghi trực tiếp hoàn cọc bị chặn (phải qua server)');
SELECT t(NULL,'postgres',$$UPDATE bookings SET status='cancelled', refund_status='pending', refund_amount=0 WHERE id='b2000000-0000-0000-0000-000000000001' RETURNING 'x'$$,'ERR','đang chờ hoàn cọc mà số tiền 0 bị ràng buộc chặn');
SELECT t(NULL,'postgres',$$UPDATE bookings SET cancelled_by='ai-do' WHERE id='b2000000-0000-0000-0000-000000000001' RETURNING 'x'$$,'ERR','người hủy ngoài player/owner/system bị chặn');
SELECT t(NULL,'postgres',$$UPDATE bookings SET refund_status='sai' WHERE id='b2000000-0000-0000-0000-000000000001' RETURNING 'x'$$,'ERR','trạng thái hoàn cọc lạ bị chặn');
SELECT t(NULL,'service_role',$$WITH x AS (UPDATE bookings SET status='cancelled', cancelled_by='player', cancelled_at=now(), refund_status='pending', refund_amount=30000 WHERE id='b2000000-0000-0000-0000-000000000001' RETURNING 1) SELECT count(*)::text FROM x$$,'1','server ghi được thông tin hủy và hoàn cọc');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT refund_status||'/'||refund_amount::text FROM bookings WHERE id='b2000000-0000-0000-0000-000000000001'$$,'pending/30000','người đặt xem được trạng thái hoàn cọc của mình');
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$SELECT refund_status FROM bookings WHERE id='b2000000-0000-0000-0000-000000000001'$$,'pending','chủ sân xem được đơn cần hoàn cọc của cụm sân mình');
SELECT t('f0000000-0000-0000-0000-00000000000f','authenticated',$$SELECT count(*)::text FROM bookings WHERE refund_status='pending'$$,'0','chủ sân khác không thấy đơn cần hoàn cọc');

-- ---------------------------------------------------------------- 14. Chuyển khoản thủ công
INSERT INTO club_bank_accounts(club_id,bank_bin,account_number,account_name) VALUES ('11111111-1111-1111-1111-111111111111','970422','0123456789','NGUYEN VAN A');
SELECT t(NULL,'postgres',$$SELECT accepts_manual_transfer::text FROM clubs WHERE id='11111111-1111-1111-1111-111111111111'$$,'false','cờ nhận chuyển khoản mặc định tắt');
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$UPDATE clubs SET accepts_manual_transfer=true WHERE id='11111111-1111-1111-1111-111111111111' RETURNING 'x'$$,'ERR','chủ sân không tự bật cờ nhận chuyển khoản');
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$SELECT account_number FROM club_bank_accounts$$,'0123456789','chủ sân xem được tài khoản ngân hàng của mình');
SELECT t('f0000000-0000-0000-0000-00000000000f','authenticated',$$SELECT count(*)::text FROM club_bank_accounts$$,'0','chủ sân khác không thấy tài khoản ngân hàng');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT count(*)::text FROM club_bank_accounts$$,'0','người chơi không đọc được bảng tài khoản ngân hàng');
SELECT t(NULL,'anon',$$SELECT count(*)::text FROM club_bank_accounts$$,'ERR','khách không đọc được bảng tài khoản ngân hàng');
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$UPDATE club_bank_accounts SET account_number='999999' RETURNING 'x'$$,'ERR','chủ sân không tự sửa trực tiếp bảng tài khoản (phải qua server)');
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$INSERT INTO club_bank_accounts(club_id,bank_bin,account_number,account_name) VALUES ((SELECT id FROM clubs WHERE name='Hop le'),'970422','0123456789','X Y') RETURNING 'x'$$,'ERR','chủ sân không tự thêm tài khoản trực tiếp');
SELECT t(NULL,'service_role',$$INSERT INTO club_bank_accounts(club_id,bank_bin,account_number,account_name) VALUES ((SELECT id FROM clubs WHERE name='Hop le'),'12','0123456789','AB') RETURNING 'x'$$,'ERR','BIN sai định dạng bị chặn');
SELECT t(NULL,'service_role',$$INSERT INTO club_bank_accounts(club_id,bank_bin,account_number,account_name) VALUES ((SELECT id FROM clubs WHERE name='Hop le'),'970422','abc123','AB') RETURNING 'x'$$,'ERR','số tài khoản có chữ bị chặn');
SELECT t(NULL,'service_role',$$INSERT INTO club_bank_accounts(club_id,bank_bin,account_number,account_name) VALUES ((SELECT id FROM clubs WHERE name='Hop le'),'970422','0123456789','A') RETURNING 'x'$$,'ERR','tên chủ tài khoản quá ngắn bị chặn');
SELECT t(NULL,'service_role',$$WITH x AS (INSERT INTO club_bank_accounts(club_id,bank_bin,account_number,account_name) VALUES ((SELECT id FROM clubs WHERE name='Hop le'),'970436','0987654321','TRAN THI B') RETURNING 1) SELECT count(*)::text FROM x$$,'1','server thêm được tài khoản hợp lệ');

-- ---------------------------------------------------------------- 15. Kho ảnh (storage)
SELECT t(NULL,'postgres',$$SELECT count(*)::text FROM storage.buckets WHERE id IN ('club-images','avatars')$$,'2','đã tạo hai bucket ảnh');
SELECT t(NULL,'postgres',$$SELECT (NOT ('image/svg+xml' = ANY(allowed_mime_types)) AND file_size_limit <= 5242880)::text FROM storage.buckets WHERE id='club-images'$$,'true','ảnh cụm sân không nhận SVG và giới hạn 5 MB');
SELECT t(NULL,'postgres',$$SELECT (NOT ('image/svg+xml' = ANY(allowed_mime_types)) AND file_size_limit <= 2097152)::text FROM storage.buckets WHERE id='avatars'$$,'true','ảnh đại diện không nhận SVG và giới hạn 2 MB');
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$WITH x AS (INSERT INTO storage.objects(bucket_id,name,owner) VALUES ('club-images','11111111-1111-1111-1111-111111111111/a.jpg',auth.uid()) RETURNING 1) SELECT count(*)::text FROM x$$,'1','chủ sân tải ảnh vào thư mục cụm sân của mình');
SELECT t('f0000000-0000-0000-0000-00000000000f','authenticated',$$INSERT INTO storage.objects(bucket_id,name,owner) VALUES ('club-images','11111111-1111-1111-1111-111111111111/evil.jpg',auth.uid()) RETURNING 'x'$$,'ERR','chủ sân khác không tải ảnh vào cụm sân này');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$INSERT INTO storage.objects(bucket_id,name,owner) VALUES ('club-images','11111111-1111-1111-1111-111111111111/evil.jpg',auth.uid()) RETURNING 'x'$$,'ERR','người chơi không tải ảnh lên cụm sân');
SELECT t(NULL,'anon',$$INSERT INTO storage.objects(bucket_id,name) VALUES ('club-images','11111111-1111-1111-1111-111111111111/evil.jpg') RETURNING 'x'$$,'ERR','khách không tải ảnh lên');
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$INSERT INTO storage.objects(bucket_id,name,owner) VALUES ('club-images','22222222-2222-2222-2222-222222222222/a.jpg',auth.uid()) RETURNING 'x'$$,'ERR','không tải ảnh vào thư mục có id không phải cụm sân của mình');
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$INSERT INTO storage.objects(bucket_id,name,owner) VALUES ('club-images','khong-co-thu-muc.jpg',auth.uid()) RETURNING 'x'$$,'ERR','tải ảnh không nằm trong thư mục cụm sân bị chặn');
SELECT t('f0000000-0000-0000-0000-00000000000f','authenticated',$$WITH x AS (DELETE FROM storage.objects WHERE bucket_id='club-images' RETURNING 1) SELECT count(*)::text FROM x$$,'0','chủ sân khác không xóa được ảnh cụm sân này');
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$WITH x AS (DELETE FROM storage.objects WHERE bucket_id='club-images' RETURNING 1) SELECT count(*)::text FROM x$$,'1','chủ sân xóa được ảnh của cụm sân mình');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$WITH x AS (INSERT INTO storage.objects(bucket_id,name,owner) VALUES ('avatars','c0000000-0000-0000-0000-00000000000c/me.png',auth.uid()) RETURNING 1) SELECT count(*)::text FROM x$$,'1','người dùng tải ảnh đại diện vào thư mục của mình');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$INSERT INTO storage.objects(bucket_id,name,owner) VALUES ('avatars','d0000000-0000-0000-0000-00000000000d/me.png',auth.uid()) RETURNING 'x'$$,'ERR','không tải ảnh đại diện vào thư mục của người khác');
SELECT t('b0000000-0000-0000-0000-00000000000b','authenticated',$$WITH x AS (DELETE FROM storage.objects WHERE bucket_id='avatars' RETURNING 1) SELECT count(*)::text FROM x$$,'0','người khác không xóa được ảnh đại diện của mình');
SELECT t(NULL,'anon',$$INSERT INTO storage.objects(bucket_id,name) VALUES ('avatars','c0000000-0000-0000-0000-00000000000c/x.png') RETURNING 'x'$$,'ERR','khách không tải ảnh đại diện');

-- ---------------------------------------------------------------- 16. Công cụ hồ sơ người chơi
UPDATE profiles SET phone_number = '0912345678' WHERE id = 'c0000000-0000-0000-0000-00000000000c';
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT phone_number FROM get_my_profile()$$,'0912345678','người dùng đọc lại được số điện thoại của chính mình');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT count(*)::text FROM get_my_profile()$$,'1','get_my_profile chỉ trả đúng một dòng của mình');
SELECT t('d0000000-0000-0000-0000-00000000000d','authenticated',$$SELECT count(*)::text FROM get_my_profile() WHERE id = 'c0000000-0000-0000-0000-00000000000c'$$,'0','không đọc được hồ sơ của người khác qua get_my_profile');
SELECT t('d0000000-0000-0000-0000-00000000000d','authenticated',$$SELECT coalesce(phone_number,'(trống)') FROM get_my_profile()$$,'(trống)','số điện thoại người khác không lọt vào kết quả của mình');
SELECT t(NULL,'anon',$$SELECT count(*)::text FROM get_my_profile()$$,'ERR','khách không gọi được get_my_profile');
SELECT t(NULL,'anon',$$SELECT matches_created::text FROM player_public_stats('b0000000-0000-0000-0000-00000000000b')$$,'1','khách xem được số kèo đã tạo của một người chơi');
SELECT t(NULL,'anon',$$SELECT matches_joined::text FROM player_public_stats('c0000000-0000-0000-0000-00000000000c')$$,'1','số kèo đã tham gia chỉ tính thành viên đã được duyệt');
SELECT t(NULL,'anon',$$SELECT bookings_played::text FROM player_public_stats('b0000000-0000-0000-0000-00000000000b')$$,'1','số lần đã chơi tính đơn đã hoàn thành hoặc đã qua giờ');
SELECT t(NULL,'anon',$$SELECT (matches_created + matches_joined + bookings_played)::text FROM player_public_stats('99999999-9999-9999-9999-999999999998')$$,'0','người không tồn tại trả về toàn số 0');
SELECT t(NULL,'anon',$$SELECT count(*)::text FROM player_public_stats('a0000000-0000-0000-0000-00000000000a')$$,'1','hàm thống kê chỉ trả một dòng con số, không lộ dữ liệu đơn');

-- ---------------------------------------------------------------- 17. Thông báo đẩy (push token)
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT register_push_token('ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]','android')::text$$,'','đăng ký push token cho chính mình');
SELECT t(NULL,'postgres',$$SELECT user_id::text FROM push_tokens WHERE token='ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]'$$,'c0000000-0000-0000-0000-00000000000c','token gắn đúng người đăng nhập');
SELECT t('d0000000-0000-0000-0000-00000000000d','authenticated',$$SELECT register_push_token('ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]','ios')::text$$,'','đăng nhập tài khoản khác trên cùng máy thì token chuyển sang tài khoản đó');
SELECT t(NULL,'postgres',$$SELECT user_id::text FROM push_tokens WHERE token='ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]'$$,'d0000000-0000-0000-0000-00000000000d','token chỉ thuộc một người tại một thời điểm');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT 'ok' FROM (SELECT unregister_push_token('ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]')) x$$,'ok','gỡ token của người khác không báo lỗi');
SELECT t(NULL,'postgres',$$SELECT count(*)::text FROM push_tokens WHERE token='ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]'$$,'1','nhưng không xóa được token không phải của mình');
SELECT t('d0000000-0000-0000-0000-00000000000d','authenticated',$$SELECT 'ok' FROM (SELECT unregister_push_token('ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]')) x$$,'ok','gỡ token của chính mình khi đăng xuất');
SELECT t(NULL,'postgres',$$SELECT count(*)::text FROM push_tokens$$,'0','token đã được gỡ');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT register_push_token('khong-phai-expo-token','android')::text$$,'ERR','token sai định dạng bị từ chối');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT register_push_token('ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]','windows')::text$$,'ERR','nền tảng lạ bị từ chối');
SELECT t(NULL,'anon',$$SELECT register_push_token('ExponentPushToken[cccccccccccccccccccccc]','ios')::text$$,'ERR','khách không đăng ký được push token');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT count(*)::text FROM push_tokens$$,'ERR','người dùng không đọc trực tiếp được bảng push_tokens');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$INSERT INTO push_tokens(user_id,token,platform) VALUES ('d0000000-0000-0000-0000-00000000000d','ExponentPushToken[dddddddddddddddddddddd]','ios') RETURNING 'x'$$,'ERR','không chèn trực tiếp token cho người khác');

-- ---------------------------------------------------------------- Tổng kết
SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS ket_qua, label AS ca_kiem_thu, CASE WHEN ok THEN '' ELSE detail END AS chi_tiet FROM test_results ORDER BY ok, label;
DO $$
DECLARE failed int; total int;
BEGIN
  SELECT count(*) FILTER (WHERE NOT ok), count(*) INTO failed, total FROM test_results;
  RAISE NOTICE 'TONG KET: %/% ca dat', total - failed, total;
  IF failed > 0 THEN RAISE EXCEPTION '% ca kiem thu that bai', failed; END IF;
END $$;
