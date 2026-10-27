-- ==============================================================================
-- Migration: 20261105000000_ticket_ai_replies.sql
-- Trợ lý AI trả lời phiếu hỗ trợ: đánh dấu tin nhắn do AI soạn để giao diện ghi rõ "Trợ lý AI"
-- và để đếm số lần AI đã trả lời trong một phiếu (giới hạn chi phí, chuyển cho quản trị khi vượt).
-- Tin nhắn AI vẫn là is_staff = TRUE (phía hỗ trợ), sender_id để trống.
-- ==============================================================================
ALTER TABLE public.ticket_messages
  ADD COLUMN IF NOT EXISTS is_ai BOOLEAN NOT NULL DEFAULT FALSE;
