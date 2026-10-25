// Hằng số dùng chung giữa Supabase giả và các kịch bản kiểm thử (tách riêng để import không khởi động server)
export const CLUB_ID = '11111111-1111-4111-8111-111111111111'
export const COURT_ID = '22222222-2222-4222-8222-222222222222'

/** Tài khoản giả: mật khẩu nào cũng được miễn email đúng; vai trò suy ra từ email. */
export const USERS = {
  player: { id: '44444444-4444-4444-8444-444444444441', email: 'nguoi-choi@test.dev', name: 'An Người Chơi', role: 'player' },
  owner: { id: '33333333-3333-4333-8333-333333333333', email: 'chu-san@test.dev', name: 'Bình Chủ Sân', role: 'owner' },
  admin: { id: '44444444-4444-4444-8444-444444444443', email: 'quan-tri@test.dev', name: 'Chi Quản Trị', role: 'admin' },
}
