import { DEFAULT_FREE_CANCEL_HOURS, HOLD_MINUTES, HOLD_MINUTES_MANUAL } from '@/lib/constants'
import { BODY_MAX } from '@/lib/support'

/**
 * Trợ lý hỗ trợ của SportArena, chạy hoàn toàn trong app: không gọi API ngoài, không tốn token, không gửi nội dung
 * phiếu đi đâu cả. Đây là bộ so khớp câu hỏi với kho câu trả lời có sẵn (không sinh văn bản mới), nên nó không thể
 * bịa chính sách: câu trả lời gửi đi luôn là một câu trong FAQ_ENTRIES do người viết.
 *
 * Cách làm: bỏ dấu và chuẩn hóa chữ, tách từ (cả từ đơn lẫn cặp từ liền kề như "huy_don"), rồi chấm mỗi mục FAQ bằng
 * độ phủ có trọng số: bao nhiêu phần "nội dung" của câu hỏi được mục đó giải thích, từ hiếm nặng hơn từ phổ biến.
 * Chỉ trả lời khi một mục vượt trội rõ ràng; mơ hồ, lạ, hay dính đến tiền/khiếu nại/lỗi thì chuyển cho quản trị.
 * Nghiêng về chuyển người hơn là đoán: trả lời sai tệ hơn là trả lời chậm.
 *
 * Thêm hiểu biết mới = thêm một mục vào FAQ_ENTRIES (và một ca trong support-faq.test.ts).
 */

export type AiDecision =
  | { action: 'reply'; reply: string }
  | { action: 'escalate'; reason: string }

type Lang = 'vi' | 'en'

export interface FaqEntry {
  id: string
  /** Cách người dùng hay hỏi, cả tiếng Việt (có dấu hay không đều được) lẫn tiếng Anh. Càng đúng chủ đề càng tốt. */
  phrases: string[]
  vi: string
  en: string
}

const CLOSING: Record<Lang, string> = {
  vi: 'Nếu vẫn chưa giải quyết được, bạn cứ trả lời tin nhắn này để nhân viên hỗ trợ tiếp nhận.',
  en: "If this doesn't solve it, just reply to this message and our support team will pick it up.",
}

/** Chỉ ghi những điều đã có thật trong hệ thống. Cái gì không có ở đây thì trợ lý phải chuyển cho quản trị. */
export const FAQ_ENTRIES: readonly FaqEntry[] = [
  {
    id: 'how-to-book',
    phrases: [
      'cách đặt sân', 'làm sao để đặt sân', 'đặt sân như thế nào', 'hướng dẫn đặt sân', 'muốn đặt sân', 'chọn giờ đặt sân',
      'how to book a court', 'how do i book', 'book a court', 'reserve a court', 'booking steps',
    ],
    vi: 'Để đặt sân: vào trang Khám phá, chọn cụm sân và sân con, bấm vào khung giờ còn trống trên lịch (có thể chọn nhiều giờ liền nhau), hệ thống tự tính giá theo khung giờ và ngày trong tuần rồi bấm Giữ chỗ để sang bước cọc. Khung giờ đã qua hoặc đã có người đặt sẽ bị khóa nên không chọn nhầm được.',
    en: 'To book: open Explore, pick a club and a court, then tap an available time slot on the calendar (you can pick consecutive hours). The price is calculated automatically from the time slot and day of week; tap Hold slot to continue to the deposit step. Past slots and slots someone else booked are locked, so you cannot pick them by mistake.',
  },
  {
    id: 'deposit-amount',
    phrases: [
      'tiền cọc bao nhiêu', 'cọc bao nhiêu phần trăm', 'tính tiền cọc', 'giá sân tính thế nào', 'tại sao phải đặt cọc', 'cọc là gì',
      'how much is the deposit', 'deposit percentage', 'how is the price calculated', 'why is a deposit required',
    ],
    vi: 'Tiền cọc = tổng tiền sân × phần trăm cọc do chủ sân đặt cho từng sân (xem trong hộp thoại chi tiết của sân). Giá tính theo bảng giá của khung giờ và ngày trong tuần, và hiện sẵn ở thanh dưới cùng ngay khi bạn chọn giờ. Phần còn lại bạn trả trực tiếp cho sân khi đến chơi.',
    en: "The deposit is the court's total price times the deposit percentage that the owner sets for each court (shown in the court's detail dialog). The price follows the owner's rate table for the time slot and day of week, and appears in the bottom bar as soon as you pick a time. You pay the rest directly at the venue when you play.",
  },
  {
    id: 'hold-timer',
    phrases: [
      'giữ chỗ bao lâu', 'đồng hồ đếm ngược', 'hết giờ giữ chỗ', 'đơn tự hủy', 'quá hạn thanh toán cọc', 'thời gian giữ chỗ', 'đơn hết hạn giữ chỗ',
      'how long is the slot held', 'countdown timer', 'booking expired', 'booking expiry', 'hold time',
    ],
    vi: `Sau khi bạn bấm Giữ chỗ, khung giờ được giữ ${HOLD_MINUTES} phút nếu cụm sân nhận cọc qua PayOS (có đồng hồ đếm ngược trong đơn), hoặc tối đa ${HOLD_MINUTES_MANUAL} phút nếu cụm sân nhận chuyển khoản thủ công. Hết thời gian mà chưa cọc thì đơn tự hủy và khung giờ được nhả cho người khác; bạn có thể đặt lại nếu giờ đó còn trống.`,
    en: `After you tap Hold slot, the time is held for ${HOLD_MINUTES} minutes if the venue takes deposits through PayOS (a countdown shows in your booking), or up to ${HOLD_MINUTES_MANUAL} minutes if the venue accepts manual bank transfer. If the deposit is not paid in time the booking is cancelled automatically and the slot is released; you can book again if it is still free.`,
  },
  {
    id: 'pay-deposit',
    phrases: [
      'thanh toán cọc như thế nào', 'cách đặt cọc', 'quét mã qr', 'mã vietqr', 'chuyển khoản cọc', 'trả tiền cọc bằng gì', 'cách trả tiền cọc',
      'how to pay the deposit', 'pay deposit', 'scan qr code', 'vietqr', 'bank transfer deposit', 'payment methods',
    ],
    vi: 'Sau khi giữ chỗ, bạn cọc bằng cách quét mã QR VietQR bằng app ngân hàng bất kỳ. Với cụm sân dùng PayOS, trạng thái đơn tự cập nhật ngay khi chuyển khoản xong, không cần tải lại trang. Với cụm sân nhận chuyển khoản thủ công, bạn chuyển khoản theo QR rồi bấm báo đã chuyển khoản, chủ sân đối chiếu và xác nhận. Tiền cọc chuyển thẳng vào tài khoản của chủ sân.',
    en: 'After holding a slot, pay the deposit by scanning the VietQR code with any banking app. For venues using PayOS the booking status updates by itself as soon as the transfer completes, with no need to reload. For venues that accept manual transfers, transfer using the QR and then tap that you have transferred; the owner checks and confirms it. The deposit goes straight to the venue owner\'s bank account.',
  },
  {
    id: 'cancel-policy',
    phrases: [
      'hủy đơn', 'hủy sân', 'hủy đặt sân', 'chính sách hủy', 'hủy có được hoàn cọc không', 'hủy muộn có mất cọc không', 'muốn hủy lịch đặt', 'cách hủy đơn', 'hủy trước giờ chơi', 'đặt nhầm giờ hủy được không', 'hủy trước mấy tiếng',
      'cancel booking', 'cancel my booking', 'get my money back', 'cancel after paying the deposit', 'cancellation policy', 'will i get my deposit back', 'how to cancel', 'late cancellation lose deposit',
    ],
    vi: `Bạn tự hủy trong chi tiết đơn đặt. Chính sách do từng cụm sân đặt (số giờ hủy miễn phí trước giờ chơi, mặc định ${DEFAULT_FREE_CANCEL_HOURS} giờ): hủy sớm hơn mốc đó thì được hoàn cọc, hủy muộn hơn thì mất cọc, còn nếu chủ sân hủy thì luôn hoàn đủ. Mốc áp dụng cho đơn của bạn hiện trong chi tiết đơn.`,
    en: `You cancel from your booking's detail page. The policy is set by each venue (free-cancellation hours before the playing time, ${DEFAULT_FREE_CANCEL_HOURS} hours by default): cancelling earlier than that gets your deposit back, cancelling later forfeits it, and if the owner cancels you always get a full refund. The cutoff that applies to your booking is shown on its detail page.`,
  },
  {
    id: 'refund-status',
    phrases: [
      'khi nào được hoàn cọc', 'hoàn cọc bao lâu', 'trạng thái hoàn cọc', 'xem hoàn cọc ở đâu', 'ai hoàn tiền cọc', 'chưa thấy hoàn cọc',
      'chủ sân bao lâu chuyển lại tiền cọc', 'bao lâu nhận lại tiền cọc', 'when will i be refunded', 'refund status', 'how long does a refund take', 'who refunds the deposit', 'where to see refund',
    ],
    vi: 'SportArena không giữ tiền cọc: tiền chuyển thẳng vào tài khoản chủ sân, nên khi đơn được hoàn cọc thì chính chủ sân chuyển lại cho bạn rồi xác nhận trong đơn. Bạn xem trạng thái hoàn cọc ngay trong chi tiết đơn; thời gian nhận tiền phụ thuộc vào lúc chủ sân chuyển và ngân hàng của bạn.',
    en: 'SportArena does not hold deposits: the money goes straight to the venue owner\'s account, so when a booking qualifies for a refund the owner transfers it back to you and confirms it in the booking. You can see the refund status on the booking\'s detail page; how soon the money arrives depends on when the owner sends it and on your bank.',
  },
  {
    id: 'open-match',
    phrases: [
      'ghép kèo là gì', 'mở kèo giao lưu', 'rủ thêm người chơi', 'tạo kèo ghép', 'cách mở kèo', 'chia tiền sân với người chơi', 'chủ kèo là gì', 'ghép kèo hoạt động như nào', 'rủ bạn bè vào sân đã đặt', 'kèo giao lưu hoạt động thế nào',
      'what is an open match', 'create a match', 'invite more players', 'split the court cost', 'how to open a match',
    ],
    vi: 'Kèo giao lưu giúp bạn rủ thêm người vào sân đã đặt. Bạn có thể bật mở kèo ngay lúc đặt sân (hoặc từ đơn của mình): chọn trình độ, số người cần, cách chia tiền sân. Kèo mang đúng giờ và sân của đơn đặt; người khác gửi yêu cầu tham gia, bạn là chủ kèo duyệt từng người và chat trong kèo. Hết giờ kết thúc thì kèo tự biến mất khỏi danh sách.',
    en: 'An open match lets you invite more players to a court you booked. You can switch it on while booking (or from your booking): choose the skill level, how many players you need and how the court cost is split. The match carries the exact time and court of your booking; other players send join requests, and as host you approve each one and chat in the match. Once the end time passes the match disappears from the list.',
  },
  {
    id: 'join-match',
    phrases: [
      'xin vào kèo', 'tham gia kèo', 'gửi yêu cầu tham gia kèo', 'chủ kèo chưa duyệt', 'bao lâu được duyệt vào kèo', 'rời kèo',
      'join a match', 'request to join', 'host has not approved', 'leave a match', 'join request pending',
    ],
    vi: 'Để vào một kèo, mở kèo trong mục Kèo và bấm xin tham gia (có thể kèm lời nhắn). Chủ kèo sẽ duyệt hoặc từ chối, bạn nhận thông báo khi có kết quả; chủ kèo cũng duyệt được ngay trên thông báo đẩy. Kèo đã đủ người hoặc đã qua giờ kết thúc thì không nhận thêm. Bạn có thể rời kèo bất cứ lúc nào và xin lại sau.',
    en: 'To join a match, open it under Matches and tap request to join (you can add a note). The host approves or declines and you get a notification with the result; hosts can also respond right from the push notification. Matches that are full or already past their end time do not accept more players. You can leave a match any time and ask to join again later.',
  },
  {
    id: 'forgot-password',
    phrases: [
      'quên mật khẩu', 'đặt lại mật khẩu', 'không nhớ mật khẩu', 'lấy lại mật khẩu', 'đổi mật khẩu', 'email đặt lại mật khẩu không đến',
      'forgot password', 'reset password', 'change password', 'cannot remember password', 'password reset email not arriving',
    ],
    vi: 'Ở trang đăng nhập bấm Quên mật khẩu rồi nhập email đã đăng ký, hệ thống gửi thư có liên kết đặt lại (cả web lẫn app mobile). Liên kết mở được trên máy khác và chỉ đổi được mật khẩu trong vòng một giờ; đổi xong các thiết bị khác bị đăng xuất. Nếu chưa thấy thư, hãy kiểm tra thư mục Spam; để tránh bị lạm dụng, mỗi email và mỗi địa chỉ mạng chỉ yêu cầu được vài lần mỗi giờ.',
    en: 'On the sign-in page tap Forgot password and enter your registered email; we send a reset link (works on both web and the mobile app). The link opens on any device and only lets you change the password within one hour; after changing it your other devices are signed out. If the email does not show up, check your Spam folder; to prevent abuse each email and each network address can only request a few resets per hour.',
  },
  {
    id: 'edit-profile',
    phrases: [
      'đổi ảnh đại diện', 'sửa thông tin cá nhân', 'cập nhật hồ sơ', 'đổi số điện thoại', 'đổi tên hiển thị', 'đổi trình độ', 'chỉnh sửa hồ sơ',
      'change avatar', 'change profile picture', 'edit profile', 'update phone number', 'change my name', 'change skill level',
    ],
    vi: 'Ảnh đại diện, tên, số điện thoại và trình độ đổi được trong trang hồ sơ cá nhân (tab Cá nhân trên web và app). Chọn ảnh JPG, PNG hoặc WebP, tối đa 2 MB. Email đăng nhập thì không đổi được trực tiếp.',
    en: 'Your avatar, name, phone number and skill level can be changed on your profile page (the Profile tab on web and the app). Choose a JPG, PNG or WebP image up to 2 MB. The sign-in email cannot be changed directly.',
  },
  {
    id: 'mobile-app',
    phrases: [
      'có app mobile không', 'tải ứng dụng', 'dùng trên điện thoại', 'thêm vào màn hình chính', 'có ứng dụng ios android không', 'có trên iphone không', 'có trên android không', 'app cho iphone',
      'is there a mobile app', 'download the app', 'use on phone', 'add to home screen', 'android ios app',
    ],
    vi: 'Có. SportArena có ứng dụng mobile (đặt sân, thanh toán cọc, hủy đơn, thông báo đẩy, và tab Chủ sân cho chủ sân). Bạn cũng dùng thẳng trên trình duyệt điện thoại không cần tải app: giao diện web có thanh điều hướng dưới cùng, và có thể chọn Thêm vào màn hình chính để mở toàn màn hình.',
    en: 'Yes. SportArena has a mobile app (booking, deposit payment, cancelling, push notifications, and an Owner tab for venue owners). You can also use it straight from your phone browser without installing anything: the web version has a bottom navigation bar, and you can choose Add to Home Screen to open it full screen.',
  },
  {
    id: 'owner-payment-setup',
    phrases: [
      'chủ sân nhận cọc thế nào', 'liên kết payos', 'kết nối tài khoản ngân hàng nhận cọc', 'cụm sân không hiện công khai', 'sao cụm sân của tôi không hiện', 'nhận thanh toán chủ sân',
      'owner how to receive deposits', 'nhận tiền cọc từ khách', 'connect payos', 'link bank account for deposits', 'my club is not visible', 'club not showing publicly',
    ],
    vi: 'Cụm sân chỉ hiện ở danh sách công khai khi đã có cách nhận cọc. Trong khu vực Chủ sân, vào mục Nhận thanh toán và chọn một trong hai cách: kết nối PayOS riêng của bạn (tự xác nhận khi khách chuyển) hoặc khai báo tài khoản ngân hàng để khách chuyển theo VietQR rồi bạn xác nhận thủ công. Cả hai cách tiền đều về thẳng tài khoản của bạn; cũng làm được ngay trên app mobile.',
    en: 'A club only appears in the public list once it has a way to receive deposits. In the Owner area open Get Paid and choose one of two ways: connect your own PayOS account (confirms automatically when a customer pays) or register a bank account so customers transfer via VietQR and you confirm manually. Either way the money goes straight to your account; you can also do this on the mobile app.',
  },
]

// ---------------------------------------------------------------------------------------------------------------------
// Chuẩn hóa và tách từ

/** Chữ thường, bỏ dấu tiếng Việt, chỉ giữ chữ-số-khoảng trắng. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Từ chỉ dạng câu hỏi hay từ nối, không mang chủ đề (bản đã bỏ dấu, chung cho tiếng Việt và tiếng Anh). Bỏ đi để
 * "làm sao để hủy đơn" và "hủy đơn" cho cùng một kết quả.
 */
const STOPWORDS = new Set(
  (
    'la gi co khong duoc nhu the nao lam sao cach de va cua cho toi ban minh em anh chi xin vui long muon can thi ma nhung ' +
    'nay do kia o tren trong voi bi bang vay a oi nhe nha da dang se roi cung van con hay hoac ' +
    'mong giai dap giup ho tro cam on hoi thac mac ve biet ' +
    'cau long bong ro pickleball tennis football badminton basketball soccer cuoi tuan hom mai ' +
    'the a an is are was were be do does did can could would should will i my me we our you your it its to of for in on at ' +
    'and or but with by from how what when where why which who please hi hello thanks thank want need get ' +
    'help question ask about know tell info information regarding'
  ).split(' ')
)

/** Rút gọn số nhiều tiếng Anh một cách thô (bookings → booking); áp dụng giống nhau cho câu hỏi và kho FAQ. */
function stem(token: string): string {
  return token.length > 3 && token.endsWith('s') && !token.endsWith('ss') ? token.slice(0, -1) : token
}

function contentTokens(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter(Boolean)
    .map(stem)
    .filter((t) => !STOPWORDS.has(t))
}

/** Từ đơn và cặp từ liền kề ("huy don" → huy, don, huy_don). Cặp từ giữ được ý nghĩa của cụm như "mat khau". */
function termsOf(text: string): { unigrams: string[]; bigrams: string[] } {
  const unigrams = contentTokens(text)
  const bigrams: string[] = []
  for (let i = 0; i + 1 < unigrams.length; i++) bigrams.push(`${unigrams[i]}_${unigrams[i + 1]}`)
  return { unigrams, bigrams }
}

// ---------------------------------------------------------------------------------------------------------------------
// Chỉ mục

interface IndexedEntry {
  entry: FaqEntry
  /** Mọi từ xuất hiện trong các cụm mẫu của mục */
  terms: Set<string>
  /** Tập từ riêng của từng cụm mẫu, để đo câu hỏi giống một cụm cụ thể đến đâu */
  phraseTerms: Set<string>[]
}

const INDEX: IndexedEntry[] = FAQ_ENTRIES.map((entry) => {
  const terms = new Set<string>()
  const phraseTerms: Set<string>[] = []
  for (const phrase of entry.phrases) {
    const { unigrams, bigrams } = termsOf(phrase)
    const set = new Set([...unigrams, ...bigrams])
    set.forEach((t) => terms.add(t))
    phraseTerms.push(set)
  }
  return { entry, terms, phraseTerms }
})

/** Số mục FAQ chứa từ này: từ xuất hiện ở ít mục thì phân biệt chủ đề tốt hơn nên nặng hơn. */
const DOC_FREQ = new Map<string, number>()
for (const { terms } of INDEX) for (const t of terms) DOC_FREQ.set(t, (DOC_FREQ.get(t) ?? 0) + 1)

const weight = (term: string) => Math.log(1 + INDEX.length / (DOC_FREQ.get(term) ?? 1))
/** Từ không có ở mục FAQ nào là phần câu hỏi mà FAQ không giải thích được: nặng nhất, kéo độ phủ xuống. */
const UNKNOWN_WEIGHT = Math.log(1 + INDEX.length)

// ---------------------------------------------------------------------------------------------------------------------
// Khi nào KHÔNG được tự trả lời

/**
 * Các dấu hiệu cần người thật (đã bỏ dấu): khiếu nại, đòi gặp nhân viên, nghi lừa đảo, bảo mật, xóa dữ liệu, sự cố tiền
 * nong hay lỗi kỹ thuật, hoặc nói câu trả lời trước chưa giải quyết. Gặp một dấu hiệu là chuyển, kể cả khi câu hỏi khớp FAQ.
 */
const ESCALATION_PATTERNS: Array<{ reason: string; re: RegExp }> = [
  { reason: 'complaint', re: /\b(khieu nai|lua dao|bi lua|scam|fraud|complain\w*|dispute|chargeback|unacceptable|te hai|vo trach nhiem)\b/ },
  { reason: 'wants-human', re: /\b(nhan vien|nguoi that|gap nguoi|quan tri vien|admin|human|real person|live agent|support staff|talk to (a |an )?(person|someone|agent)|speak to)\b/ },
  { reason: 'security', re: /\b(bao mat|ro ri|bi hack|hack|mat tai khoan|bi danh cap|security|breach|leak\w*|stolen|compromised)\b/ },
  { reason: 'data-deletion', re: /\b(xoa tai khoan|xoa du lieu|xoa thong tin|delete (my )?(account|data)|remove my (account|data)|gdpr)\b/ },
  { reason: 'payment-issue', re: /\b(da|vua) (chuyen|thanh toan|coc|tra)\b.*\b(chua|khong|van|nhung)\b|\b(chuyen khoan|thanh toan|coc|tra tien) roi\b|\b(bi mat tien|bi tru|mat het tien|tru tien 2 lan|tru hai lan|double charg\w*|charged twice|money (is )?missing)\b|\b(paid|transferred)\b.*\b(not|still|yet|but|no)\b/ },
  // Chuyện đã xảy ra với đơn cụ thể của người hỏi (bị hủy...): cần tra dữ liệu thật, không giải thích chung chung được
  { reason: 'about-their-order', re: /\b(bi huy|tu dong huy roi|was cancel\w*|got cancel\w*|been cancel\w*|cancel\w* (my|the) (booking|order))\b/ },
  { reason: 'not-resolved', re: /\b(chua giai quyet|van chua|van khong|khong giai quyet|chua duoc|not (solved|resolved|working|helpful)|still (not|no)|did not help|didn t help)\b/ },
  { reason: 'technical', re: /\b(bi loi|bao loi|loi he thong|crash|bug|error|exception|khong vao duoc|khong tai duoc|khong mo duoc|doesn t work|does not work|not loading|cannot (log ?in|open|load))\b/ },
]

/** Câu hỏi nhắc tới đơn/số tiền/mã cụ thể: cần tra dữ liệu thật, trợ lý không có. */
const SPECIFIC_DATA = /\b\d{5,}\b|\bma (don|giao dich)\b|\b(order|booking|transaction) (id|code|number)\b/

/** Câu quá dài thường là tình huống riêng, nhiều ý: để người đọc kỹ. */
const MAX_QUESTION_CHARS = 500

// ---------------------------------------------------------------------------------------------------------------------
// Nhận dạng ngôn ngữ

const EN_WORDS = new Set('how what can do does my is are to where when why you your and of for with want please hello hi cannot i the a an'.split(' '))
const VI_WORDS = new Set('toi ban khong nhu nao lam sao duoc cho va muon xin chao la cua co de the minh em'.split(' '))

/** Tiếng Việt có dấu thì chắc chắn là vi; nếu không thì so số từ chức năng. Hòa thì vi (ngôn ngữ mặc định của app). */
export function detectLang(text: string): Lang {
  if (/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(text)) return 'vi'
  let en = 0
  let vi = 0
  for (const w of normalize(text).split(' ')) {
    if (EN_WORDS.has(w)) en++
    if (VI_WORDS.has(w)) vi++
  }
  return en > vi ? 'en' : 'vi'
}

// ---------------------------------------------------------------------------------------------------------------------
// Chọn câu trả lời

/** Mục tốt nhất phải phủ ít nhất chừng này phần "nội dung" câu hỏi... */
export const MIN_COVERAGE = 0.6
/** ...và điểm tổng hợp hơn mục đứng thứ hai ít nhất chừng này (nếu không thì câu hỏi mơ hồ giữa hai chủ đề)... */
export const MIN_MARGIN = 0.15
/** Điểm tổng hợp (độ phủ + độ giống cụm mẫu) tối thiểu: chỉ trùng vài từ chung chung như "booking", "time" thì không đủ. */
export const MIN_SCORE = 0.65
/** ...trừ khi câu hỏi trùng gần như nguyên văn một cụm mẫu của mục tốt nhất mà không trùng cụm nào của mục khác. */
const NEAR_EXACT = 0.99

export interface FaqMatch {
  entry: FaqEntry
  /** Phần nội dung câu hỏi mà mục này giải thích được (0..1) */
  coverage: number
  /** Độ giống với cụm mẫu gần nhất của mục (0..1); 1 = trùng nguyên văn */
  phrase: number
  /** Điểm tổng hợp dùng để xếp hạng */
  score: number
  /** Chênh lệch điểm so với mục đứng thứ hai */
  margin: number
  /** Mục thứ hai có cụm mẫu nào trùng nguyên văn không (nếu có thì không thể coi mục đầu là duy nhất) */
  runnerUpExact: boolean
}

/** Chấm mọi mục FAQ cho một câu hỏi; trả mục tốt nhất kèm độ phủ và khoảng cách với mục thứ hai. null nếu không có gì để chấm. */
export function bestMatch(question: string): FaqMatch | null {
  const { unigrams, bigrams } = termsOf(question)
  // Một từ đơn lẻ không đủ để biết người ta hỏi gì
  if (new Set(unigrams).size < 2) return null

  const queryTerms = [...new Set([...unigrams, ...bigrams.filter((b) => DOC_FREQ.has(b))])]
  const total = queryTerms.reduce((sum, t) => sum + (DOC_FREQ.has(t) ? weight(t) : UNKNOWN_WEIGHT), 0)
  if (total === 0) return null

  const weightOf = (t: string) => (DOC_FREQ.has(t) ? weight(t) : UNKNOWN_WEIGHT)

  const scored = INDEX.map(({ entry, terms, phraseTerms }) => {
    const coverage = queryTerms.reduce((sum, t) => sum + (terms.has(t) ? weight(t) : 0), 0) / total
    // Dice có trọng số giữa câu hỏi và từng cụm mẫu; lấy cụm giống nhất
    let phrase = 0
    for (const p of phraseTerms) {
      const shared = queryTerms.reduce((sum, t) => sum + (p.has(t) ? weight(t) : 0), 0)
      const pWeight = [...p].reduce((sum, t) => sum + weightOf(t), 0)
      phrase = Math.max(phrase, (2 * shared) / (total + pWeight))
    }
    return { entry, coverage, phrase, score: 0.5 * coverage + 0.5 * phrase }
  }).sort((a, b) => b.score - a.score)

  const [best, second] = scored
  if (!best || best.coverage === 0) return null
  return {
    ...best,
    margin: best.score - (second?.score ?? 0),
    runnerUpExact: (second?.phrase ?? 0) >= NEAR_EXACT,
  }
}

export interface FaqTicketMessage {
  is_staff: boolean
  is_ai: boolean
  body: string
}

/** Lời đáp đầy đủ gửi cho người dùng (nội dung mục + câu kết), bằng ngôn ngữ cho trước. */
export function renderReply(entry: FaqEntry, lang: Lang): string {
  return `${entry[lang]}\n\n${CLOSING[lang]}`
}

/**
 * Quyết định trả lời hay chuyển quản trị cho tin nhắn mới nhất của người dùng. `subject` chỉ được tính khi người dùng
 * mới nhắn một lần (tiêu đề phiếu thường là chính câu hỏi); các lượt sau chỉ xét tin nhắn mới nhất.
 */
export function answerTicket(input: { subject: string; messages: FaqTicketMessage[] }): AiDecision {
  const userMessages = input.messages.filter((m) => !m.is_staff)
  const latest = userMessages[userMessages.length - 1]
  if (!latest) return { action: 'escalate', reason: 'no-user-message' }

  const text = userMessages.length === 1 ? `${input.subject}. ${latest.body}` : latest.body
  const normalized = normalize(text)

  if (latest.body.length > MAX_QUESTION_CHARS) return { action: 'escalate', reason: 'too-long' }
  for (const { reason, re } of ESCALATION_PATTERNS) {
    if (re.test(normalized)) return { action: 'escalate', reason }
  }
  if (SPECIFIC_DATA.test(normalized)) return { action: 'escalate', reason: 'needs-account-data' }

  const match = bestMatch(text)
  if (!match) return { action: 'escalate', reason: 'no-match' }
  if (match.coverage < MIN_COVERAGE || match.score < MIN_SCORE) return { action: 'escalate', reason: 'low-confidence' }
  const clearWinner = match.margin >= MIN_MARGIN || (match.phrase >= NEAR_EXACT && !match.runnerUpExact)
  if (!clearWinner) return { action: 'escalate', reason: 'ambiguous' }

  const lang = detectLang(latest.body)
  const reply = renderReply(match.entry, lang)
  // Hỏi lại đúng điều đã được trả lời nghĩa là câu trả lời đó chưa đủ: để người xử lý, đừng lặp lại
  if (input.messages.some((m) => m.is_ai && m.body.includes(match.entry[lang]))) return { action: 'escalate', reason: 'repeat' }
  if (reply.length > BODY_MAX) return { action: 'escalate', reason: 'reply-too-long' }
  return { action: 'reply', reply }
}
