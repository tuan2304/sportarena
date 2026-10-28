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

-- ---------------------------------------------------------------- 18. Ngôn ngữ của thông báo
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT 'ok' FROM (SELECT set_my_locale('en')) x$$,'ok','người dùng đặt được ngôn ngữ của mình');
SELECT t(NULL,'postgres',$$SELECT locale FROM profiles WHERE id='c0000000-0000-0000-0000-00000000000c'$$,'en','ngôn ngữ được lưu vào đúng hồ sơ');
SELECT t(NULL,'postgres',$$SELECT coalesce(locale,'(trống)') FROM profiles WHERE id='d0000000-0000-0000-0000-00000000000d'$$,'(trống)','hồ sơ người khác không bị đổi');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT set_my_locale('fr')::text$$,'ERR','ngôn ngữ lạ bị từ chối');
SELECT t(NULL,'anon',$$SELECT set_my_locale('en')::text$$,'ERR','khách không đặt được ngôn ngữ');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT locale FROM profiles WHERE id=auth.uid()$$,'ERR','app không đọc trực tiếp cột locale');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$UPDATE profiles SET locale='vi' WHERE id=auth.uid() RETURNING 'x'$$,'ERR','app không ghi trực tiếp cột locale');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$UPDATE notifications SET title_en='hack' WHERE id='77777777-7777-7777-7777-777777777777' RETURNING 'x'$$,'ERR','người dùng không sửa được bản dịch của thông báo');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT title_en IS NULL FROM notifications WHERE id='77777777-7777-7777-7777-777777777777'$$,'true','đọc được cột bản dịch của thông báo của mình');

-- ---------------------------------------------------------------- 19. Kèo theo khung giờ: qua giờ kết thúc thì hết nhận người
-- Kèo đã qua giờ (đơn đặt sân 3 tiếng trước, kéo dài 1 tiếng) và một người xin vào từ trước đó (chèn bằng quyền hệ thống)
INSERT INTO bookings(id, court_id, user_id, start_time, end_time, total_price, deposit_amount, status)
 VALUES ('33333333-3333-3333-3333-333333333335','22222222-2222-2222-2222-222222222222','a0000000-0000-0000-0000-00000000000a', now()-interval '3 hour', now()-interval '2 hour', 100000, 30000, 'confirmed');
INSERT INTO matches(id, booking_id, creator_id, title, sport_type, required_players)
 VALUES ('44444444-4444-4444-4444-444444444445','33333333-3333-3333-3333-333333333335','a0000000-0000-0000-0000-00000000000a','Keo da qua gio','pickleball',3);
INSERT INTO match_participants(id, match_id, user_id) VALUES
 ('50000000-0000-0000-0000-0000000000f1','44444444-4444-4444-4444-444444444445','c0000000-0000-0000-0000-00000000000c');

SELECT t(NULL,'anon',$$SELECT (m.court_id = '22222222-2222-2222-2222-222222222222' AND m.end_time < now() AND m.start_time < m.end_time)::text FROM matches m WHERE m.id='44444444-4444-4444-4444-444444444445'$$,'true','kèo tự lấy sân và giờ từ đơn đặt sân, khách đọc được dù không đọc được đơn');
SELECT t(NULL,'anon',$$SELECT count(*)::text FROM bookings$$,'0','khách vẫn không đọc được đơn đặt (chỉ lộ sân và giờ của kèo)');
UPDATE bookings SET end_time = end_time + interval '30 minute' WHERE id='33333333-3333-3333-3333-333333333335';
SELECT t(NULL,'postgres',$$SELECT (m.end_time = b.end_time)::text FROM matches m JOIN bookings b ON b.id = m.booking_id WHERE m.id='44444444-4444-4444-4444-444444444445'$$,'true','đơn đổi giờ kết thúc thì kèo đổi theo');
SELECT t('d0000000-0000-0000-0000-00000000000d','authenticated',$$SELECT public.match_has_ended('44444444-4444-4444-4444-444444444445')::text$$,'true','kèo đã qua giờ kết thúc được nhận ra là đã kết thúc');
SELECT t('d0000000-0000-0000-0000-00000000000d','authenticated',$$SELECT public.match_has_ended('44444444-4444-4444-4444-444444444444')::text$$,'false','kèo chưa tới giờ chưa kết thúc');
SELECT t('d0000000-0000-0000-0000-00000000000d','authenticated',$$SELECT public.match_has_ended('00000000-0000-0000-0000-000000000000')::text$$,'false','kèo không tồn tại không bị coi là đã kết thúc');
SELECT t('d0000000-0000-0000-0000-00000000000d','authenticated',$$INSERT INTO match_participants(match_id,user_id,status) VALUES ('44444444-4444-4444-4444-444444444445','d0000000-0000-0000-0000-00000000000d','pending') RETURNING 'x'$$,'ERR','xin vào kèo đã qua giờ kết thúc bị chặn (mobile insert trực tiếp)');
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$WITH x AS (INSERT INTO match_participants(match_id,user_id,status) VALUES ('44444444-4444-4444-4444-444444444444','a0000000-0000-0000-0000-00000000000a','pending') RETURNING 1) SELECT count(*)::text FROM x$$,'1','xin vào kèo chưa tới giờ vẫn được');
SELECT t(NULL,'postgres',$$UPDATE match_participants SET status='accepted' WHERE id='50000000-0000-0000-0000-0000000000f1' RETURNING 'x'$$,'ERR','duyệt thêm người vào kèo đã qua giờ bị chặn (MATCH_ENDED)');
SELECT t(NULL,'postgres',$$UPDATE match_participants SET status='rejected' WHERE id='50000000-0000-0000-0000-0000000000f1' RETURNING status$$,'rejected','từ chối yêu cầu của kèo đã qua giờ để dọn danh sách chờ vẫn được');

-- ---------------------------------------------------------------- 20. Ghi nhận cọc trong một transaction (settle_booking_payment)
-- 20a. Tiền về sau khi đơn hết hạn nhưng sân còn trống: giành lại sân, mở lại kèo
INSERT INTO bookings(id,court_id,user_id,start_time,end_time,total_price,deposit_amount,status) VALUES ('f1000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','c0000000-0000-0000-0000-00000000000c',now()+interval '40 day',now()+interval '40 day 1 hour',100000,30000,'cancelled');
INSERT INTO payments(booking_id,user_id,order_code,amount,status,metadata) VALUES ('f1000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-00000000000c',2001,30000,'cancelled','{"channel":"club","club_id":"11111111-1111-1111-1111-111111111111"}');
SELECT t(NULL,'service_role',$$SELECT public.settle_booking_payment((SELECT id FROM payments WHERE order_code=2001), 'TF2001')$$,'confirmed','settle_booking_payment xác nhận cọc đến muộn khi sân còn trống');
SELECT t(NULL,'postgres',$$SELECT b.status||'/'||p.status||'/'||p.payos_transaction_id FROM bookings b JOIN payments p ON p.booking_id=b.id WHERE p.order_code=2001$$,'confirmed/paid/TF2001','booking confirmed, payment paid cùng một lúc, lưu mã giao dịch');
SELECT t(NULL,'service_role',$$SELECT public.settle_booking_payment((SELECT id FROM payments WHERE order_code=2001), 'TF2001')$$,'already_paid','gọi lặp (webhook gửi lại) không xử lý lần hai');

-- 20b. Tiền về muộn mà sân đã có người khác đặt: payment ghi paid + needs_refund, booking giữ cancelled, metadata kênh còn nguyên
INSERT INTO bookings(id,court_id,user_id,start_time,end_time,total_price,deposit_amount,status) VALUES ('f1000000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','c0000000-0000-0000-0000-00000000000c',now()+interval '41 day',now()+interval '41 day 1 hour',100000,30000,'cancelled');
INSERT INTO payments(booking_id,user_id,order_code,amount,status,metadata) VALUES ('f1000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-00000000000c',2002,30000,'cancelled','{"channel":"club","club_id":"11111111-1111-1111-1111-111111111111"}');
INSERT INTO bookings(id,court_id,user_id,start_time,end_time,total_price,deposit_amount,status) VALUES ('f1000000-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222','d0000000-0000-0000-0000-00000000000d',now()+interval '41 day',now()+interval '41 day 1 hour',100000,30000,'confirmed');
SELECT t(NULL,'service_role',$$SELECT public.settle_booking_payment((SELECT id FROM payments WHERE order_code=2002), 'TF2002')$$,'slot_taken','tiền về khi sân đã có người đặt → slot_taken');
SELECT t(NULL,'postgres',$$SELECT b.status||'/'||p.status||'/'||(p.metadata->>'needs_refund')||'/'||(p.metadata->>'channel') FROM bookings b JOIN payments p ON p.booking_id=b.id WHERE p.order_code=2002$$,'cancelled/paid/true/club','slot_taken: giữ bằng chứng hoàn tiền, booking vẫn cancelled, không mất metadata kênh');

-- 20c. Quyền gọi: chỉ service_role
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT public.settle_booking_payment((SELECT id FROM payments WHERE order_code=1005), 'x')$$,'ERR','người dùng không tự ghi nhận cọc được');
SELECT t(NULL,'anon',$$SELECT public.settle_booking_payment('00000000-0000-0000-0000-000000000000', 'x')$$,'ERR','khách không gọi được settle_booking_payment');
SELECT t(NULL,'service_role',$$SELECT public.settle_booking_payment('00000000-0000-0000-0000-000000000000', 'x')$$,'already_paid','payment không tồn tại thì không đổi gì');

-- ---------------------------------------------------------------- 21. Xóa tài khoản & xuất dữ liệu
INSERT INTO auth.users(id, raw_user_meta_data) VALUES
 ('f8000000-0000-0000-0000-00000000000f', '{"full_name":"Phuc"}'),
 ('90000000-0000-0000-0000-000000000009', '{"full_name":"Chin"}'),
 ('80000000-0000-0000-0000-000000000008', '{"full_name":"Tam"}'),
 ('70000000-0000-0000-0000-000000000007', '{"full_name":"Bay"}');
UPDATE profiles SET phone_number = '0912345678' WHERE id = 'f8000000-0000-0000-0000-00000000000f';

-- Phúc: đơn cũ đã hoàn thành có cọc, một đánh giá, một thông báo, tin nhắn chat, một lời xin vào kèo
INSERT INTO bookings(id,court_id,user_id,start_time,end_time,total_price,deposit_amount,status,note) VALUES ('e1000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','f8000000-0000-0000-0000-00000000000f',now()-interval '60 day',now()-interval '60 day'+interval '1 hour',100000,30000,'completed','ghi chu rieng');
INSERT INTO payments(booking_id,user_id,order_code,amount,status) VALUES ('e1000000-0000-0000-0000-000000000001','f8000000-0000-0000-0000-00000000000f',2101,30000,'paid');
INSERT INTO club_reviews(club_id,user_id,rating,comment) VALUES ('11111111-1111-1111-1111-111111111111','f8000000-0000-0000-0000-00000000000f',5,'tot');
INSERT INTO notifications(user_id,title,message) VALUES ('f8000000-0000-0000-0000-00000000000f','a','b');
INSERT INTO match_participants(id,match_id,user_id,message) VALUES ('50000000-0000-0000-0000-0000000000f2','44444444-4444-4444-4444-444444444444','f8000000-0000-0000-0000-00000000000f','cho minh vao voi');

INSERT INTO zalo_identities(zalo_id,user_id) VALUES ('8801','f8000000-0000-0000-0000-00000000000f');
INSERT INTO slot_waitlist(user_id,court_id,start_time,end_time) VALUES ('f8000000-0000-0000-0000-00000000000f','22222222-2222-2222-2222-222222222222',now()+interval '85 day',now()+interval '85 day 1 hour');
INSERT INTO recurring_bookings(id,user_id,court_id,weekday,start_time,end_time,starts_on,status,note) VALUES ('e1000000-0000-0000-0000-0000000000a1','f8000000-0000-0000-0000-00000000000f','22222222-2222-2222-2222-222222222222',2,'19:00','20:00',current_date,'pending','ghi chu lich');
SELECT t(NULL,'service_role',$$SELECT public.account_deletion_blockers('f8000000-0000-0000-0000-00000000000f')::text$$,'{}','người không còn việc dang dở thì không bị chặn xóa');
SELECT t(NULL,'service_role',$$SELECT (jsonb_array_length(public.export_user_data('f8000000-0000-0000-0000-00000000000f')->'bookings')::text)||'/'||(public.export_user_data('f8000000-0000-0000-0000-00000000000f')->'profile'->>'phone_number')$$,'1/0912345678','xuất dữ liệu có đơn đặt và số điện thoại của chính người đó');
SELECT t(NULL,'service_role',$$SELECT (public.export_user_data('f8000000-0000-0000-0000-00000000000f')::text LIKE '%c0000000-0000-0000-0000-00000000000c%')::text$$,'false','xuất dữ liệu của người này không lẫn dữ liệu người khác');
SELECT t(NULL,'service_role',$$SELECT public.anonymize_user('f8000000-0000-0000-0000-00000000000f')::text$$,'true','còn sổ sách tài chính → báo phải xóa mềm tài khoản đăng nhập');
SELECT t(NULL,'postgres',$$SELECT full_name||'/'||COALESCE(phone_number,'NULL')||'/'||COALESCE(avatar_url,'NULL')||'/'||(deleted_at IS NOT NULL)::text FROM profiles WHERE id='f8000000-0000-0000-0000-00000000000f'$$,'Người dùng đã xóa/NULL/NULL/true','hồ sơ bị bỏ tên, số điện thoại và ảnh bị xóa');
SELECT t(NULL,'postgres',$$SELECT (SELECT count(*) FROM notifications WHERE user_id='f8000000-0000-0000-0000-00000000000f')||'/'||(SELECT count(*) FROM club_reviews WHERE user_id='f8000000-0000-0000-0000-00000000000f')$$,'0/0','thông báo và đánh giá của người đó bị xóa');
SELECT t(NULL,'postgres',$$SELECT status||'/'||COALESCE(message,'NULL') FROM match_participants WHERE id='50000000-0000-0000-0000-0000000000f2'$$,'left/NULL','rời kèo và xóa lời nhắn xin vào');
SELECT t(NULL,'postgres',$$SELECT b.status||'/'||COALESCE(b.note,'NULL')||'/'||p.status FROM bookings b JOIN payments p ON p.booking_id=b.id WHERE b.id='e1000000-0000-0000-0000-000000000001'$$,'completed/NULL/paid','đơn và cọc được giữ làm chứng từ, ghi chú riêng bị xóa');

SELECT t(NULL,'postgres',$$SELECT (SELECT count(*) FROM zalo_identities WHERE user_id='f8000000-0000-0000-0000-00000000000f')||'/'||(SELECT count(*) FROM slot_waitlist WHERE user_id='f8000000-0000-0000-0000-00000000000f')||'/'||(SELECT status||'/'||COALESCE(note,'NULL') FROM recurring_bookings WHERE id='e1000000-0000-0000-0000-0000000000a1')$$,'0/0/cancelled/NULL','gỡ liên kết Zalo, rút khỏi danh sách chờ, hủy lịch cố định đang chờ duyệt');

DELETE FROM recurring_bookings WHERE id='e1000000-0000-0000-0000-0000000000a1';
SELECT t(NULL,'service_role',$$SELECT public.anonymize_user('90000000-0000-0000-0000-000000000009')::text$$,'false','không có sổ sách nào → cho phép xóa cứng tài khoản');

-- Việc dang dở thì chặn: đơn sắp tới, cọc chờ hoàn, vai trò quản trị, chủ sân còn khách
INSERT INTO bookings(id,court_id,user_id,start_time,end_time,total_price,deposit_amount,status) VALUES ('e1000000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','80000000-0000-0000-0000-000000000008',now()+interval '80 day',now()+interval '80 day 1 hour',100000,30000,'confirmed');
SELECT t(NULL,'service_role',$$SELECT public.account_deletion_blockers('80000000-0000-0000-0000-000000000008')::text$$,'{active_bookings}','còn đơn sắp tới thì bị chặn xóa');
SELECT t(NULL,'service_role',$$SELECT public.anonymize_user('80000000-0000-0000-0000-000000000008')$$,'ERR','anonymize_user tự kiểm tra lại và từ chối khi còn việc dang dở');
INSERT INTO bookings(id,court_id,user_id,start_time,end_time,total_price,deposit_amount,status,cancelled_by,cancelled_at,refund_amount,refund_status) VALUES ('e1000000-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222','70000000-0000-0000-0000-000000000007',now()+interval '81 day',now()+interval '81 day 1 hour',100000,30000,'cancelled','owner',now(),30000,'pending');
SELECT t(NULL,'service_role',$$SELECT public.account_deletion_blockers('70000000-0000-0000-0000-000000000007')::text$$,'{refund_owed}','đang chờ được hoàn cọc thì bị chặn xóa');
SELECT t(NULL,'service_role',$$SELECT (public.account_deletion_blockers('a0000000-0000-0000-0000-00000000000a') @> ARRAY['club_active_bookings'])::text$$,'true','chủ sân còn khách sắp tới thì bị chặn xóa');
SELECT t(NULL,'service_role',$$SELECT (public.account_deletion_blockers('99999999-9999-9999-9999-999999999999') @> ARRAY['admin'])::text$$,'true','tài khoản quản trị không tự xóa được');

SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT public.anonymize_user('d0000000-0000-0000-0000-00000000000d')$$,'ERR','người dùng không gọi trực tiếp anonymize_user được');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT public.export_user_data('d0000000-0000-0000-0000-00000000000d')$$,'ERR','người dùng không đọc dữ liệu người khác qua export_user_data');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT public.account_deletion_blockers('d0000000-0000-0000-0000-00000000000d')$$,'ERR','người dùng không gọi trực tiếp account_deletion_blockers');
SELECT t(NULL,'anon',$$SELECT public.export_user_data('d0000000-0000-0000-0000-00000000000d')$$,'ERR','khách không xuất được dữ liệu');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT deleted_at FROM profiles LIMIT 1$$,'ERR','cột deleted_at không đọc được từ phía app');

-- ---------------------------------------------------------------- 22. Đối soát thanh toán
-- 22a. Đóng khoản cần hoàn tiền (payment 2002 ở mục 20b đang needs_refund)
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT public.admin_mark_payment_refunded((SELECT id FROM payments WHERE order_code=2002), 'b0000000-0000-0000-0000-00000000000b', 'x')$$,'ERR','người dùng không tự đánh dấu đã hoàn tiền');
SELECT t(NULL,'service_role',$$SELECT public.admin_mark_payment_refunded((SELECT id FROM payments WHERE order_code=2002), 'b0000000-0000-0000-0000-00000000000b', 'CK ngay 1')$$,'refunded','đánh dấu đã hoàn tiền');
SELECT t(NULL,'postgres',$$SELECT status||'/'||(metadata->>'refund_note')||'/'||(metadata->>'channel') FROM payments WHERE order_code=2002$$,'refunded/CK ngay 1/club','payment thành refunded, ghi chú và kênh còn nguyên');
SELECT t(NULL,'service_role',$$SELECT public.admin_mark_payment_refunded((SELECT id FROM payments WHERE order_code=2002), 'b0000000-0000-0000-0000-00000000000b', 'lan 2')$$,'not_found','đánh dấu lần hai không đổi gì');
SELECT t(NULL,'service_role',$$SELECT public.admin_mark_payment_refunded((SELECT id FROM payments WHERE order_code=2101), 'b0000000-0000-0000-0000-00000000000b', 'x')$$,'not_found','payment bình thường (không needs_refund) không bị đánh dấu hoàn nhầm');

-- 22b. Đơn kẹt: payment đã paid nhưng booking còn pending → xác nhận lại
INSERT INTO bookings(id,court_id,user_id,start_time,end_time,total_price,deposit_amount,status) VALUES ('e2000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','c0000000-0000-0000-0000-00000000000c',now()+interval '82 day',now()+interval '82 day 1 hour',100000,30000,'pending');
INSERT INTO payments(booking_id,user_id,order_code,amount,status,paid_at) VALUES ('e2000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-00000000000c',2201,30000,'paid',now());
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT public.admin_repair_paid_payment((SELECT id FROM payments WHERE order_code=2201), 'b0000000-0000-0000-0000-00000000000b')$$,'ERR','người dùng không tự xác nhận đơn kẹt');
SELECT t(NULL,'service_role',$$SELECT public.admin_repair_paid_payment((SELECT id FROM payments WHERE order_code=2201), 'b0000000-0000-0000-0000-00000000000b')$$,'confirmed','đơn kẹt ở pending được xác nhận');
SELECT t(NULL,'postgres',$$SELECT b.status||'/'||(p.metadata->>'reconciled_by') FROM bookings b JOIN payments p ON p.booking_id=b.id WHERE p.order_code=2201$$,'confirmed/b0000000-0000-0000-0000-00000000000b','booking confirmed, ghi ai đã đối soát');
SELECT t(NULL,'service_role',$$SELECT public.admin_repair_paid_payment((SELECT id FROM payments WHERE order_code=2201), 'b0000000-0000-0000-0000-00000000000b')$$,'not_stuck','gọi lặp không còn kẹt nữa');

-- 22c. Cron hết hạn hủy đơn (cancelled_by trống) khi tiền đã về, và sân đã có người khác đặt → chuyển sang cần hoàn tiền
INSERT INTO bookings(id,court_id,user_id,start_time,end_time,total_price,deposit_amount,status) VALUES ('e2000000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','c0000000-0000-0000-0000-00000000000c',now()+interval '83 day',now()+interval '83 day 1 hour',100000,30000,'cancelled');
INSERT INTO payments(booking_id,user_id,order_code,amount,status,paid_at) VALUES ('e2000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-00000000000c',2202,30000,'paid',now());
INSERT INTO bookings(id,court_id,user_id,start_time,end_time,total_price,deposit_amount,status) VALUES ('e2000000-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222','d0000000-0000-0000-0000-00000000000d',now()+interval '83 day',now()+interval '83 day 1 hour',100000,30000,'confirmed');
SELECT t(NULL,'service_role',$$SELECT public.admin_repair_paid_payment((SELECT id FROM payments WHERE order_code=2202), 'b0000000-0000-0000-0000-00000000000b')$$,'slot_taken','sân đã có người khác → slot_taken');
SELECT t(NULL,'postgres',$$SELECT b.status||'/'||(p.metadata->>'needs_refund') FROM bookings b JOIN payments p ON p.booking_id=b.id WHERE p.order_code=2202$$,'cancelled/true','booking giữ cancelled, payment chuyển sang cần hoàn tiền');

-- 22d. Đơn khách chủ động hủy (cancelled_by có giá trị) không phải kẹt: cọc đi theo luồng hoàn cọc, không được kéo đơn sống lại
INSERT INTO bookings(id,court_id,user_id,start_time,end_time,total_price,deposit_amount,status,cancelled_by,cancelled_at) VALUES ('e2000000-0000-0000-0000-000000000004','22222222-2222-2222-2222-222222222222','c0000000-0000-0000-0000-00000000000c',now()+interval '84 day',now()+interval '84 day 1 hour',100000,30000,'cancelled','player',now());
INSERT INTO payments(booking_id,user_id,order_code,amount,status,paid_at) VALUES ('e2000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-00000000000c',2203,30000,'paid',now());
SELECT t(NULL,'service_role',$$SELECT public.admin_repair_paid_payment((SELECT id FROM payments WHERE order_code=2203), 'b0000000-0000-0000-0000-00000000000b')$$,'not_stuck','đơn khách chủ động hủy không bị coi là kẹt');
SELECT t(NULL,'postgres',$$SELECT status FROM bookings WHERE id='e2000000-0000-0000-0000-000000000004'$$,'cancelled','đơn khách đã hủy vẫn giữ nguyên cancelled');

-- ---------------------------------------------------------------- 21. Điểm uy tín người chơi
-- c: 1 buổi đã chơi; d: 1 buổi không đến (không tính là đã chơi); e: 1 lần hủy muộn
INSERT INTO bookings(id,court_id,user_id,start_time,end_time,total_price,deposit_amount,status) VALUES
 ('f2000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','c0000000-0000-0000-0000-00000000000c',now()-interval '10 day',now()-interval '10 day'+interval '1 hour',100000,0,'confirmed'),
 ('f2000000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','d0000000-0000-0000-0000-00000000000d',now()-interval '9 day',now()-interval '9 day'+interval '1 hour',100000,0,'confirmed'),
 ('f2000000-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222','e0000000-0000-0000-0000-00000000000e',now()-interval '8 day',now()-interval '8 day'+interval '1 hour',100000,0,'cancelled');
UPDATE bookings SET no_show_at = now() WHERE id='f2000000-0000-0000-0000-000000000002';
UPDATE bookings SET late_cancel = true WHERE id='f2000000-0000-0000-0000-000000000003';

SELECT t(NULL,'anon',$$SELECT played||'/'||no_shows||'/'||late_cancels FROM public.get_player_reputation(ARRAY['c0000000-0000-0000-0000-00000000000c']::uuid[])$$,'1/0/0','uy tín: người đã chơi 1 buổi, khách chưa đăng nhập đọc được số đếm');
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$SELECT played||'/'||no_shows||'/'||late_cancels FROM public.get_player_reputation(ARRAY['d0000000-0000-0000-0000-00000000000d']::uuid[])$$,'0/1/0','uy tín: buổi không đến được đếm và không tính là đã chơi');
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$SELECT played||'/'||no_shows||'/'||late_cancels FROM public.get_player_reputation(ARRAY['e0000000-0000-0000-0000-00000000000e']::uuid[])$$,'0/0/1','uy tín: hủy muộn được đếm');
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$SELECT count(*)::text FROM public.get_player_reputation(ARRAY['c0000000-0000-0000-0000-00000000000c','c0000000-0000-0000-0000-00000000000c','d0000000-0000-0000-0000-00000000000d']::uuid[])$$,'2','uy tín: id trùng chỉ tính một lần');
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$UPDATE bookings SET no_show_at = now() WHERE id='f2000000-0000-0000-0000-000000000001' RETURNING 'x'$$,'ERR','chủ sân không tự ghi cột không đến qua API (chỉ máy chủ ghi)');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$UPDATE bookings SET late_cancel = false WHERE id='f2000000-0000-0000-0000-000000000003' RETURNING 'x'$$,'ERR','người chơi không tự xóa dấu hủy muộn');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$UPDATE match_participants SET left_late = false WHERE id='50000000-0000-0000-0000-00000000000c' RETURNING 'x'$$,'ERR','thành viên không tự sửa cột rời muộn');

-- Rời kèo khi còn dưới 2 giờ là rời muộn; rời kèo còn xa thì không
INSERT INTO bookings(id,court_id,user_id,start_time,end_time,total_price,deposit_amount,status) VALUES
 ('f2000000-0000-0000-0000-000000000004','22222222-2222-2222-2222-222222222222','b0000000-0000-0000-0000-00000000000b',now()+interval '30 minute',now()+interval '90 minute',100000,0,'confirmed');
INSERT INTO matches(id,booking_id,creator_id,title,sport_type,required_players) VALUES
 ('f2000000-0000-0000-0000-0000000000a4','f2000000-0000-0000-0000-000000000004','b0000000-0000-0000-0000-00000000000b','Keo sap toi','pickleball',4);
INSERT INTO match_participants(id,match_id,user_id,status) VALUES
 ('f2000000-0000-0000-0000-0000000000b1','f2000000-0000-0000-0000-0000000000a4','c0000000-0000-0000-0000-00000000000c','pending');
UPDATE match_participants SET status='accepted' WHERE id='f2000000-0000-0000-0000-0000000000b1';
UPDATE match_participants SET status='left' WHERE id='f2000000-0000-0000-0000-0000000000b1';
SELECT t(NULL,'postgres',$$SELECT left_late::text FROM match_participants WHERE id='f2000000-0000-0000-0000-0000000000b1'$$,'true','rời kèo khi còn dưới 2 giờ bị đánh dấu rời muộn');
SELECT t(NULL,'postgres',$$SELECT left_late::text FROM match_participants WHERE id='50000000-0000-0000-0000-00000000000d'$$,'false','thành viên kèo còn xa không bị đánh dấu');
SELECT t(NULL,'anon',$$SELECT played||'/'||no_shows||'/'||late_cancels FROM public.get_player_reputation(ARRAY['c0000000-0000-0000-0000-00000000000c']::uuid[])$$,'1/0/1','uy tín: rời kèo muộn cộng vào số lần hủy muộn');

-- ---------------------------------------------------------------- 22. Nhắc lịch trước giờ chơi
-- Đơn xác nhận cách giờ chơi 100 phút, đặt từ hôm qua, có một thành viên đã duyệt; và đơn f2...04 (đặt vừa xong, còn 30 phút)
INSERT INTO bookings(id,court_id,user_id,start_time,end_time,total_price,deposit_amount,status,created_at) VALUES
 ('f3000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','b0000000-0000-0000-0000-00000000000b',now()+interval '100 minute',now()+interval '160 minute',100000,0,'confirmed',now()-interval '1 day');
INSERT INTO matches(id,booking_id,creator_id,title,sport_type,required_players) VALUES
 ('f3000000-0000-0000-0000-0000000000a1','f3000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-00000000000b','Keo nhac lich','pickleball',4);
INSERT INTO match_participants(id,match_id,user_id,status) VALUES
 ('f3000000-0000-0000-0000-0000000000b1','f3000000-0000-0000-0000-0000000000a1','d0000000-0000-0000-0000-00000000000d','accepted');

SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT count(*)::text FROM public.claim_due_reminders()$$,'ERR','người dùng không gọi được claim_due_reminders');
SELECT t(NULL,'service_role',$$SELECT count(*)||'/'||COALESCE(max(array_length(member_ids,1)),0) FROM public.claim_due_reminders()$$,'1/1','nhắc lịch: chỉ đơn đủ điều kiện, kèm thành viên đã duyệt');
SELECT t(NULL,'service_role',$$SELECT count(*)::text FROM public.claim_due_reminders()$$,'0','nhắc lịch: chạy lại không nhắc trùng');
SELECT t(NULL,'postgres',$$SELECT (reminder_sent_at IS NOT NULL)::text FROM bookings WHERE id='f2000000-0000-0000-0000-000000000004'$$,'true','đơn vừa đặt sát giờ không được nhắc nhưng được đánh dấu để khỏi quét lại');

-- ---------------------------------------------------------------- 23. Danh sách chờ khung giờ
INSERT INTO slot_waitlist(id,user_id,court_id,start_time,end_time,created_at) VALUES
 ('f4000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-00000000000c','22222222-2222-2222-2222-222222222222',now()+interval '50 day',now()+interval '50 day 1 hour',now()-interval '3 minute'),
 ('f4000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-00000000000d','22222222-2222-2222-2222-222222222222',now()+interval '50 day 30 minute',now()+interval '50 day 90 minute',now()-interval '2 minute'),
 ('f4000000-0000-0000-0000-000000000003','e0000000-0000-0000-0000-00000000000e','22222222-2222-2222-2222-222222222222',now()+interval '41 day',now()+interval '41 day 1 hour',now()-interval '1 minute');

SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$INSERT INTO slot_waitlist(user_id,court_id,start_time,end_time) VALUES ('c0000000-0000-0000-0000-00000000000c','22222222-2222-2222-2222-222222222222',now()+interval '60 day',now()+interval '60 day 1 hour') RETURNING 'x'$$,'ERR','người chơi không tự chèn danh sách chờ (đi qua máy chủ)');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT count(*)::text FROM slot_waitlist$$,'1','người chơi chỉ đọc danh sách chờ của mình');
SELECT t(NULL,'anon',$$SELECT count(*)::text FROM slot_waitlist$$,'0','khách không đọc được danh sách chờ');
SELECT t(NULL,'postgres',$$INSERT INTO slot_waitlist(user_id,court_id,start_time,end_time) SELECT user_id,court_id,start_time,end_time FROM slot_waitlist WHERE id='f4000000-0000-0000-0000-000000000001' RETURNING 'x'$$,'ERR','không chờ trùng cùng một khung giờ hai lần');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT count(*)::text FROM public.claim_free_waitlist_entries()$$,'ERR','người dùng không gọi được claim_free_waitlist_entries');
-- Khung giờ 1 trống: người đăng ký sớm nhất được báo; khung giờ 2 chồng lên nên phải chờ; khung giờ 3 vẫn kín
SELECT t(NULL,'service_role',$$SELECT string_agg(id::text, ',') FROM public.claim_free_waitlist_entries()$$,'f4000000-0000-0000-0000-000000000001','danh sách chờ: chỉ báo người đứng đầu của khung giờ đã trống');
SELECT t(NULL,'service_role',$$SELECT count(*)::text FROM public.claim_free_waitlist_entries()$$,'0','danh sách chờ: chạy lại không báo trùng');
-- Người được báo không đặt trong hạn giữ chỗ → nhường người kế tiếp
UPDATE slot_waitlist SET notified_at = now() - interval '20 minute' WHERE id='f4000000-0000-0000-0000-000000000001';
SELECT t(NULL,'service_role',$$SELECT string_agg(id::text, ',') FROM public.claim_free_waitlist_entries()$$,'f4000000-0000-0000-0000-000000000002','danh sách chờ: hết hạn giữ chỗ thì báo người kế tiếp');
SELECT t(NULL,'postgres',$$SELECT status FROM slot_waitlist WHERE id='f4000000-0000-0000-0000-000000000001'$$,'expired','người được báo mà không đặt chuyển sang expired');

-- ---------------------------------------------------------------- 24. Lịch cố định hằng tuần
INSERT INTO recurring_bookings(id,user_id,court_id,weekday,start_time,end_time,starts_on,status) VALUES
 ('f5000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-00000000000c','22222222-2222-2222-2222-222222222222',2,'19:00','20:00',current_date,'pending');

SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$INSERT INTO recurring_bookings(user_id,court_id,weekday,start_time,end_time,starts_on,status) VALUES ('c0000000-0000-0000-0000-00000000000c','22222222-2222-2222-2222-222222222222',3,'19:00','20:00',current_date,'active') RETURNING 'x'$$,'ERR','người chơi không tự tạo lịch cố định đã duyệt');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$UPDATE recurring_bookings SET status='active' WHERE id='f5000000-0000-0000-0000-000000000001' RETURNING 'x'$$,'ERR','người chơi không tự duyệt lịch cố định của mình');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT count(*)::text FROM recurring_bookings$$,'1','người đặt đọc được lịch cố định của mình');
SELECT t('a0000000-0000-0000-0000-00000000000a','authenticated',$$SELECT count(*)::text FROM recurring_bookings$$,'1','chủ sân đọc được yêu cầu lịch cố định ở sân mình');
SELECT t('e0000000-0000-0000-0000-00000000000e','authenticated',$$SELECT count(*)::text FROM recurring_bookings$$,'0','người ngoài không đọc được lịch cố định của người khác');
SELECT t(NULL,'postgres',$$INSERT INTO recurring_bookings(user_id,court_id,weekday,start_time,end_time,starts_on) VALUES ('c0000000-0000-0000-0000-00000000000c','22222222-2222-2222-2222-222222222222',7,'19:00','20:00',current_date) RETURNING 'x'$$,'ERR','thứ trong tuần ngoài 0-6 bị chặn');
SELECT t(NULL,'postgres',$$INSERT INTO recurring_bookings(user_id,court_id,weekday,start_time,end_time,starts_on) VALUES ('c0000000-0000-0000-0000-00000000000c','22222222-2222-2222-2222-222222222222',2,'20:00','19:00',current_date) RETURNING 'x'$$,'ERR','giờ kết thúc phải sau giờ bắt đầu');
-- Mỗi tuần đúng một đơn cho một lịch cố định, kể cả đơn đã hủy
INSERT INTO bookings(id,court_id,user_id,start_time,end_time,total_price,deposit_amount,status,recurring_id) VALUES
 ('f5000000-0000-0000-0000-0000000000b1','22222222-2222-2222-2222-222222222222','c0000000-0000-0000-0000-00000000000c',now()+interval '70 day',now()+interval '70 day 1 hour',100000,0,'cancelled','f5000000-0000-0000-0000-000000000001');
SELECT t(NULL,'postgres',$$INSERT INTO bookings(court_id,user_id,start_time,end_time,total_price,deposit_amount,status,recurring_id) SELECT court_id,user_id,start_time,end_time,total_price,deposit_amount,'confirmed',recurring_id FROM bookings WHERE id='f5000000-0000-0000-0000-0000000000b1' RETURNING 'x'$$,'ERR','không tạo lại đơn của một tuần đã có (kể cả đã hủy)');

-- ---------------------------------------------------------------- 25. Đăng nhập điện thoại / Zalo
INSERT INTO auth.users(id, raw_user_meta_data, phone) VALUES ('f6000000-0000-0000-0000-000000000001', '{}', '84901234567');
SELECT t(NULL,'postgres',$$SELECT phone_number FROM profiles WHERE id='f6000000-0000-0000-0000-000000000001'$$,'+84901234567','đăng ký bằng OTP điện thoại: hồ sơ mang sẵn số điện thoại');
SELECT t('c0000000-0000-0000-0000-00000000000c','authenticated',$$SELECT count(*)::text FROM zalo_identities$$,'ERR','người dùng không đọc được bảng nối tài khoản Zalo');
SELECT t(NULL,'anon',$$INSERT INTO zalo_identities(zalo_id,user_id) VALUES ('123','c0000000-0000-0000-0000-00000000000c') RETURNING 'x'$$,'ERR','khách không ghi được bảng Zalo');
SELECT t(NULL,'service_role',$$INSERT INTO zalo_identities(zalo_id,user_id) VALUES ('123','c0000000-0000-0000-0000-00000000000c') RETURNING zalo_id$$,'123','máy chủ nối được tài khoản Zalo');
SELECT t(NULL,'service_role',$$INSERT INTO zalo_identities(zalo_id,user_id) VALUES ('456','c0000000-0000-0000-0000-00000000000c') RETURNING 'x'$$,'ERR','một tài khoản chỉ nối một Zalo');
SELECT t(NULL,'service_role',$$INSERT INTO zalo_identities(zalo_id,user_id) VALUES ('abc','d0000000-0000-0000-0000-00000000000d') RETURNING 'x'$$,'ERR','zalo_id phải là số');

-- ---------------------------------------------------------------- Tổng kết
SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS ket_qua, label AS ca_kiem_thu, CASE WHEN ok THEN '' ELSE detail END AS chi_tiet FROM test_results ORDER BY ok, label;
DO $$
DECLARE failed int; total int;
BEGIN
  SELECT count(*) FILTER (WHERE NOT ok), count(*) INTO failed, total FROM test_results;
  RAISE NOTICE 'TONG KET: %/% ca dat', total - failed, total;
  IF failed > 0 THEN RAISE EXCEPTION '% ca kiem thu that bai', failed; END IF;
END $$;
