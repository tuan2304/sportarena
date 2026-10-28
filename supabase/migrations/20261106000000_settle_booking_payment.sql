-- ==============================================================================
-- Migration: 20261106000000_settle_booking_payment.sql
-- Ghi nhận khoản cọc đã thanh toán trong MỘT transaction.
--
-- Trước đây settlePayment (web/src/lib/payments.ts) chạy tuần tự 3 lệnh từ ứng dụng: payments → paid,
-- bookings → confirmed, matches → open. Nếu tiến trình chết hoặc timeout giữa lệnh 1 và 2, payment đã là
-- 'paid' nhưng booking vẫn 'pending'; webhook PayOS gọi lại gặp payment 'paid' nên bỏ qua, rồi pg_cron hủy
-- booking trong khi khách đã cọc. Gom vào một hàm để hoặc xong cả ba, hoặc không đổi gì.
-- ==============================================================================

-- Trả về:
--   'confirmed'    vừa ghi nhận cọc và xác nhận đơn (kèo gắn với đơn được mở lại)
--   'already_paid' payment không còn ở pending/cancelled (đã xử lý trước đó, hoặc xử lý song song)
--   'slot_taken'   tiền về sau khi đơn hết hạn mà khung giờ đã có người khác đặt: payment được ghi 'paid' kèm
--                  needs_refund để hoàn tiền thủ công, booking giữ nguyên 'cancelled'
CREATE OR REPLACE FUNCTION public.settle_booking_payment(p_payment_id UUID, p_reference TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  v_booking_id UUID;
  v_reference TEXT := COALESCE(NULLIF(p_reference, ''), 'SIM_' || (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT);
BEGIN
  -- Khối con có EXCEPTION chạy như một savepoint: khi vướng ràng buộc trùng lịch, lệnh UPDATE payments bên trong
  -- cũng được hoàn tác, nên không bao giờ có trạng thái "đã cọc nhưng đơn chưa xác nhận" bị bỏ lại.
  BEGIN
    UPDATE public.payments
    SET status = 'paid', paid_at = NOW(), payos_transaction_id = v_reference
    WHERE id = p_payment_id AND status IN ('pending', 'cancelled')
    RETURNING booking_id INTO v_booking_id;

    IF NOT FOUND THEN
      RETURN 'already_paid';
    END IF;

    UPDATE public.bookings SET status = 'confirmed'
    WHERE id = v_booking_id AND status IN ('pending', 'cancelled');

    UPDATE public.matches SET status = 'open'
    WHERE booking_id = v_booking_id AND status = 'cancelled';
  EXCEPTION WHEN exclusion_violation THEN
    -- Giữ nguyên channel/club_id trong metadata: webhook gọi lại vẫn cần chúng để chọn đúng khóa kiểm chữ ký
    UPDATE public.payments
    SET status = 'paid',
        paid_at = NOW(),
        payos_transaction_id = v_reference,
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('needs_refund', true, 'reason', 'slot_taken_after_expiry')
    WHERE id = p_payment_id AND status IN ('pending', 'cancelled');
    RETURN 'slot_taken';
  END;

  RETURN 'confirmed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.settle_booking_payment(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_booking_payment(UUID, TEXT) TO service_role;
