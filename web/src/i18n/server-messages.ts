/**
 * Bản dịch tiếng Anh của các thông báo lỗi do server trả về (viết sẵn bằng tiếng Việt trong code nghiệp vụ, và có test
 * dựa trên đúng câu chữ đó nên không đổi ở nguồn). Khóa là đúng câu tiếng Việt; Server Action gọi tr() (lib/localize-error)
 * để dịch ngay trước khi trả về. Câu có chèn số/tên khớp theo mẫu ở EN_PATTERNS.
 * Có test quét mã nguồn để báo nếu thiếu bản dịch cho một câu lỗi mới.
 */
export const EN_EXACT: Record<string, string> = {
  // --- Đăng nhập / đăng ký / quyền
  'Vui lòng đăng nhập': 'Please log in',
  'Chưa đăng nhập': 'Not logged in',
  'Vui lòng nhập đầy đủ email và mật khẩu': 'Please enter both email and password',
  'Email hoặc mật khẩu không chính xác': 'Incorrect email or password',
  'Vui lòng điền các thông tin bắt buộc (họ tên, email, mật khẩu)': 'Please fill in the required fields (full name, email, password)',
  'Mật khẩu phải có ít nhất 8 ký tự': 'Password must be at least 8 characters',
  'Không thể tạo tài khoản. Vui lòng thử lại.': 'Could not create the account. Please try again.',
  'Bạn không phải chủ của cụm sân này': 'You are not the owner of this venue',
  'Chỉ quản trị nền tảng mới được thực hiện thao tác này': 'Only platform administrators can do this',

  // --- Đặt sân
  'Vui lòng đăng nhập để tiến hành đặt sân': 'Please log in to book a court',
  'Không tìm thấy đơn đặt sân': 'Booking not found',
  'Không thể cập nhật trạng thái đơn': 'Could not update the booking status',
  'Tính năng giả lập thanh toán không khả dụng': 'Payment simulation is not available',
  'Không tìm thấy giao dịch của bạn': 'We could not find your transaction',
  'Giao dịch này là giao dịch thật, không thể giả lập': 'This is a real transaction and cannot be simulated',
  'Thời gian đặt sân không hợp lệ': 'Invalid booking time',
  'Giờ kết thúc phải sau giờ bắt đầu': 'The end time must be after the start time',
  'Không thể đặt khung giờ đã qua': 'You cannot book a time slot in the past',
  'Không tìm thấy thông tin sân con': 'Court not found',
  'Sân này đang tạm ngưng hoạt động để bảo trì': 'This court is temporarily closed for maintenance',
  'Không tìm thấy cụm sân của sân này': 'Venue not found for this court',
  'Cụm sân này đang tạm ngưng nhận đặt': 'This venue is not accepting bookings right now',
  'Sân này tạm thời không nhận đặt do cụm sân chưa gia hạn gói. Vui lòng chọn sân khác.':
    'This court is not accepting bookings because the venue has not renewed its plan. Please choose another court.',
  'Cấu hình thanh toán của cụm sân đang gặp sự cố. Vui lòng thử lại sau hoặc liên hệ chủ sân.':
    "The venue's payment setup has a problem. Please try again later or contact the owner.",
  'Cụm sân này chưa kết nối thanh toán online nên chưa nhận đặt sân. Vui lòng liên hệ chủ sân.':
    'This venue has not set up online payment yet, so it cannot take bookings. Please contact the owner.',
  'Khung giờ này vừa có người đặt hoặc đang giữ chỗ. Vui lòng chọn khung giờ khác!':
    'This time slot was just booked or is being held by someone else. Please choose another slot.',
  'Không thể tạo đơn đặt sân. Vui lòng thử lại.': 'Could not create the booking. Please try again.',
  'Không thể tạo kèo ghép. Vui lòng thử lại.': 'Could not create the match. Please try again.',
  'Không thể khởi tạo thanh toán. Vui lòng thử lại.': 'Could not start the payment. Please try again.',
  'Không thể tạo mã thanh toán. Vui lòng thử lại.': 'Could not create the payment code. Please try again.',
  'Không thể lưu giao dịch thanh toán. Vui lòng thử lại.': 'Could not save the payment. Please try again.',
  'Cổng thanh toán đang gặp sự cố, vui lòng thử lại sau ít phút.': 'The payment gateway has a problem. Please try again in a few minutes.',
  'Hệ thống thanh toán chưa được cấu hình.': 'The payment system has not been configured.',

  // --- Hủy đơn / hoàn cọc / chuyển khoản thủ công
  'Không thể hủy đơn. Vui lòng thử lại.': 'Could not cancel the booking. Please try again.',
  'Không thể lưu chính sách. Vui lòng thử lại.': 'Could not save the policy. Please try again.',
  'Đơn vừa được cập nhật ở nơi khác. Vui lòng tải lại trang.': 'This booking was just updated elsewhere. Please reload the page.',
  'Bạn không có quyền thao tác đơn đặt sân này': 'You are not allowed to manage this booking',
  'Không thể cập nhật. Vui lòng thử lại.': 'Could not update. Please try again.',
  'Đơn này không còn ở trạng thái chờ hoàn cọc': 'This booking is no longer waiting for a deposit refund',
  'Đơn này đã hủy hoặc đã hoàn thành nên không thể hủy nữa.': 'This booking is already cancelled or completed, so it cannot be cancelled again.',
  'Đơn đã đến giờ chơi nên không thể tự hủy. Hãy liên hệ chủ sân nếu có sự cố.':
    'The play time has started, so you cannot cancel it yourself. Please contact the owner if something went wrong.',
  'Đơn này không còn ở trạng thái chờ cọc': 'This booking is no longer waiting for a deposit',
  'Đơn đã hết hạn giữ chỗ. Vui lòng đặt lại.': 'The hold on this booking has expired. Please book again.',
  'Đơn này không thanh toán bằng chuyển khoản thủ công': 'This booking is not paid by manual bank transfer',
  'Không thể ghi nhận. Vui lòng thử lại.': 'Could not record this. Please try again.',

  // --- Kèo
  'Vui lòng đăng nhập để tạo bài ghép kèo': 'Please log in to create a match',
  'Vui lòng nhập tên kèo': 'Please enter a match title',
  'Không tìm thấy thông tin đơn đặt sân tương ứng': 'We could not find the matching booking',
  'Bạn chỉ có thể tạo ghép kèo cho đơn đặt sân của chính mình': 'You can only create a match for your own booking',
  'Đơn đặt sân này không còn hiệu lực để mở kèo': 'This booking is no longer valid for opening a match',
  'Khung giờ này đã kết thúc, không thể mở kèo': 'This time slot has ended, so a match cannot be opened',
  'Đơn đặt sân này đã được mở ghép kèo trước đó': 'A match has already been opened for this booking',
  'Vui lòng đăng nhập để gửi yêu cầu tham gia': 'Please log in to request to join',
  'Không tìm thấy thông tin kèo thể thao': 'Match not found',
  'Bạn là chủ tạo kèo này nên không cần gửi yêu cầu tham gia': 'You are the host of this match, so there is no need to request to join',
  'Kèo này hiện đã đóng hoặc đã đủ người tham gia': 'This match is closed or already full',
  'Bạn đã gửi yêu cầu tham gia rồi, vui lòng chờ chủ kèo duyệt': 'You have already requested to join. Please wait for the host to approve.',
  'Bạn đã là thành viên chính thức của kèo này': 'You are already a member of this match',
  'Yêu cầu trước đó của bạn đã bị từ chối bởi chủ kèo': 'Your earlier request was declined by the host',
  'Không thể gửi lại yêu cầu tham gia': 'Could not send the request again',
  'Không thể gửi yêu cầu tham gia': 'Could not send the join request',
  'Trạng thái không hợp lệ': 'Invalid status',
  'Không tìm thấy thông tin người tham gia': 'Participant not found',
  'Chỉ chủ phòng mới có quyền duyệt thành viên': 'Only the host can approve members',
  'Yêu cầu này đã được xử lý trước đó': 'This request has already been handled',
  'Kèo này đã đóng, không thể duyệt thêm thành viên': 'This match is closed, so no more members can be approved',
  'Kèo đã đủ người, không thể duyệt thêm': 'The match is full, so no more members can be approved',
  'Không thể cập nhật yêu cầu': 'Could not update the request',
  'Bạn chưa tham gia kèo này': 'You have not joined this match',
  'Không thể rời kèo': 'Could not leave the match',
  'Chỉ chủ phòng mới có thể hủy kèo này': 'Only the host can cancel this match',

  // --- Chat, đánh giá, hồ sơ, bản đồ, ảnh
  'Nội dung tin nhắn không được để trống': 'The message cannot be empty',
  'Tin nhắn tối đa 1000 ký tự': 'Messages can be at most 1000 characters',
  'Vui lòng đăng nhập để gửi tin nhắn': 'Please log in to send messages',
  'Chỉ chủ kèo và thành viên đã được duyệt mới nhắn tin được': 'Only the host and approved members can send messages',
  'Không thể gửi tin nhắn': 'Could not send the message',
  'Điểm đánh giá phải từ 1 đến 5 sao': 'The rating must be between 1 and 5 stars',
  'Nhận xét tối đa 1000 ký tự': 'Reviews can be at most 1000 characters',
  'Vui lòng đăng nhập để gửi đánh giá': 'Please log in to leave a review',
  'Bạn cần đặt sân và chơi tại cụm sân này trước khi đánh giá': 'You need to book and play at this venue before reviewing it',
  'Không thể gửi đánh giá': 'Could not submit the review',
  'Không thể lưu hồ sơ. Vui lòng thử lại.': 'Could not save your profile. Please try again.',
  'Họ tên phải từ 2 đến 60 ký tự': 'Full name must be 2 to 60 characters',
  'Họ tên không được chứa ký tự < hoặc >': 'Full name cannot contain < or >',
  'Số điện thoại không đúng định dạng (ví dụ 0912345678)': 'Invalid phone number format (for example 0912345678)',
  'Trình độ không hợp lệ': 'Invalid skill level',
  'Hãy dán link Google Maps hoặc toạ độ': 'Paste a Google Maps link or coordinates',
  'Nội dung quá dài': 'The text is too long',
  'Không đọc được toạ độ từ nội dung này. Hãy dán link Google Maps của sân (nút Chia sẻ → Sao chép liên kết) hoặc toạ độ dạng 10.7769, 106.7009.':
    'Could not read coordinates from this. Paste the Google Maps link of the court (Share → Copy link) or coordinates like 10.7769, 106.7009.',
  'Không mở được link này. Hãy thử dán toạ độ trực tiếp.': 'Could not open this link. Try pasting the coordinates directly.',
  'Không tìm thấy cụm sân': 'Venue not found',
  'Không thể lưu ảnh. Vui lòng thử lại.': 'Could not save the photos. Please try again.',
  'Ảnh đại diện không hợp lệ': 'Invalid profile photo',
  'Không thể lưu ảnh đại diện. Vui lòng thử lại.': 'Could not save the profile photo. Please try again.',
  'Chỉ nhận ảnh JPG, PNG hoặc WebP': 'Only JPG, PNG or WebP images are accepted',
  'File ảnh trống': 'The image file is empty',
  'Danh sách ảnh không hợp lệ': 'Invalid image list',
  'Có ảnh không thuộc kho ảnh của cụm sân này': "Some images do not belong to this venue's gallery",

  // --- Hỗ trợ
  'Vui lòng đăng nhập để gửi yêu cầu hỗ trợ': 'Please log in to send a support request',
  'Không gửi được yêu cầu. Vui lòng thử lại.': 'Could not send the request. Please try again.',
  'Không tìm thấy yêu cầu hỗ trợ': 'Support request not found',
  'Bạn không có quyền trả lời yêu cầu này': 'You are not allowed to reply to this request',
  'Yêu cầu này đã đóng. Hãy tạo yêu cầu mới nếu bạn cần thêm hỗ trợ.': 'This request is closed. Please create a new one if you need more help.',
  'Không gửi được tin nhắn. Vui lòng thử lại.': 'Could not send the message. Please try again.',
  'Bạn không có quyền đổi trạng thái này': 'You are not allowed to change this status',
  'Không cập nhật được trạng thái': 'Could not update the status',
  'Vui lòng mô tả vấn đề bạn gặp': 'Please describe the problem',
  'Vui lòng nhập nội dung': 'Please enter some text',
  'Loại thông báo không hợp lệ': 'Invalid notification type',
  'Đối tượng nhận không hợp lệ': 'Invalid audience',
  'Tiêu đề từ 3 đến 120 ký tự': 'The title must be 3 to 120 characters',
  'Nội dung từ 3 đến 1000 ký tự': 'The content must be 3 to 1000 characters',
  'Đường dẫn chỉ được là địa chỉ trong web, ví dụ /clubs hoặc /matches': 'The link must be an address inside the site, for example /clubs or /matches',
}

/** Câu có chèn số/tên: khớp theo mẫu, $1.. là phần bắt được */
export const EN_PATTERNS: Array<[RegExp, string]> = [
  [/^Bạn thao tác quá nhanh\. Vui lòng thử lại sau (\d+) giây\.$/, "You're doing that too fast. Please try again in $1 seconds."],
  [/^Bạn thao tác quá nhanh\. Vui lòng thử lại sau (\d+) phút\.$/, "You're doing that too fast. Please try again in $1 minutes."],
  [/^Chỉ nhận đặt trước tối đa (\d+) ngày$/, 'Bookings can be made at most $1 days ahead'],
  [/^Mỗi đơn đặt tối đa (\d+) giờ$/, 'Each booking can be at most $1 hours'],
  [/^Khung giờ nằm ngoài giờ mở cửa \((.+)\)$/, 'The time slot is outside opening hours ($1)'],
  [
    /^Bạn đang giữ chỗ (\d+) đơn chưa cọc\. Hãy hoàn tất hoặc chờ hết hạn rồi đặt thêm\.$/,
    'You are already holding $1 bookings without a deposit. Finish them or wait for them to expire before booking more.',
  ],
  [/^Ảnh quá lớn, tối đa (\d+) MB$/, 'The image is too large (maximum $1 MB)'],
  [/^Mỗi cụm sân tối đa (\d+) ảnh$/, 'Each venue can have at most $1 photos'],
  [
    /^Bạn đang có (\d+) yêu cầu chưa giải quyết\. Vui lòng chờ hỗ trợ trả lời hoặc đóng bớt yêu cầu cũ\.$/,
    'You already have $1 unresolved requests. Please wait for support to reply or close some old ones.',
  ],
  [/^Tiêu đề cần ít nhất (\d+) ký tự$/, 'The title needs at least $1 characters'],
  [/^Tiêu đề tối đa (\d+) ký tự$/, 'The title can be at most $1 characters'],
  [/^Nội dung tối đa (\d+) ký tự$/, 'The content can be at most $1 characters'],
  [/^Không tìm thấy đơn thanh toán (\d+)$/, 'Payment order $1 not found'],
  [/^Số giờ phải là số nguyên từ (\d+) đến (\d+)$/, 'Hours must be a whole number from $1 to $2'],
]

export function translateServerMessage(message: string, locale: string): string {
  if (locale !== 'en') return message
  const exact = EN_EXACT[message]
  if (exact !== undefined) return exact
  for (const [pattern, replacement] of EN_PATTERNS) {
    if (pattern.test(message)) return message.replace(pattern, replacement)
  }
  return message
}
