/**
 * Chuẩn hóa số điện thoại về dạng E.164 (+84901234567) để gửi OTP và so khớp tài khoản.
 * Số Việt Nam nhập kiểu 0901 234 567, 84901234567, +84 901 234 567 đều về cùng một dạng; số quốc tế phải có dấu + đầu.
 */
const VN_MOBILE = /^0([35789]\d{8})$/

export function normalizePhone(input: string): string | null {
  const raw = (input ?? '').trim()
  if (!raw) return null
  // Bỏ khoảng trắng, dấu chấm, gạch ngang, ngoặc; phần còn lại chỉ được là chữ số với dấu + ở đầu: "(+84) 901-234-567" hợp lệ
  const compact = raw.replace(/[\s().-]/g, '')
  if (!/^\+?\d+$/.test(compact)) return null

  const hasPlus = compact.startsWith('+')
  const digits = compact.replace(/\D/g, '')

  if (hasPlus) {
    return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null
  }
  if (digits.startsWith('84') && digits.length === 11 && /^[35789]/.test(digits.slice(2))) {
    return `+${digits}`
  }
  const vn = VN_MOBILE.exec(digits)
  return vn ? `+84${vn[1]}` : null
}

/** Che bớt số khi hiển thị: +84901234567 → +84 ••• ••• 567 */
export function maskPhone(e164: string): string {
  const digits = e164.replace(/\D/g, '')
  if (digits.length < 7) return e164
  return `+${digits.slice(0, 2)} ••• ••• ${digits.slice(-3)}`
}

export const OTP_LENGTH = 6

/** Mã OTP gồm đúng 6 chữ số (bỏ khoảng trắng khi người dùng dán "123 456") */
export function normalizeOtp(input: string): string | null {
  const code = (input ?? '').replace(/\s+/g, '')
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code) ? code : null
}
