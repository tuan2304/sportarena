import { useId } from 'react'
import { cn } from 'cn'

/**
 * Logo SportArena: chữ S dựng từ vòng tròn giữa sân, quả bóng vàng là điểm hẹn.
 * Hình học trùng với scripts/generate-brand-assets.mjs (nguồn của mọi file ảnh logo).
 * Quy chuẩn dùng logo: xem DESIGN.md.
 */

const S_PATH = 'M59.28 31.89A12 12 0 1 0 48 48A12 12 0 1 1 36.72 64.1'
const BALL = { cx: 59.3, cy: 31.9 }

export type LogoMarkVariant = 'badge' | 'white' | 'bare-dark' | 'bare-light'

interface LogoMarkProps {
  size?: number
  /**
   * badge: khung xanh gradient (mặc định) · white: khung trắng, dùng trên nền xanh
   * bare-dark: không khung, chữ S trắng, đặt trên nền tối/ảnh · bare-light: không khung, chữ S xanh, đặt trên nền sáng
   */
  variant?: LogoMarkVariant
  className?: string
  /** true khi đứng cạnh chữ SPORTARENA (tránh đọc tên hai lần) */
  decorative?: boolean
}

export function LogoMark({ size = 40, variant = 'badge', className, decorative = true }: LogoMarkProps) {
  const bare = variant === 'bare-dark' || variant === 'bare-light'
  const sColor = variant === 'white' || variant === 'bare-light' ? '#047857' : '#FFFFFF'
  // id riêng cho từng bản logo: id trùng khiến gradient bị lấy từ bản đang display:none (vd. thanh bên ẩn trên điện thoại) và nền logo biến mất
  const uid = useId()
  const gradId = `${uid}-g`
  const hlId = `${uid}-h`

  return (
    <svg
      width={bare ? Math.round((size * 64) / 68) : size}
      height={size}
      viewBox={bare ? '16 14 64 68' : '0 0 96 96'}
      className={cn('block shrink-0', className)}
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': 'SportArena' })}
    >
      {variant === 'badge' && (
        <>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#10A674" />
              <stop offset="1" stopColor="#064E3B" />
            </linearGradient>
            <radialGradient id={hlId} cx="0.28" cy="0.18" r="0.75">
              <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.28" />
              <stop offset="0.6" stopColor="#FFFFFF" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect x="2" y="2" width="92" height="92" rx="28" fill={`url(#${gradId})`} />
          <rect x="2" y="2" width="92" height="92" rx="28" fill={`url(#${hlId})`} />
          <rect x="3.5" y="3.5" width="89" height="89" rx="26.5" fill="none" stroke="#FFFFFF" strokeOpacity="0.18" />
        </>
      )}
      {variant === 'white' && <rect x="2" y="2" width="92" height="92" rx="28" fill="#FFFFFF" />}

      {bare ? (
        <path d="M16 48H80" fill="none" stroke={sColor} strokeOpacity="0.3" strokeWidth="1.6" />
      ) : (
        <g fill="none" stroke={variant === 'white' ? '#047857' : '#FFFFFF'} strokeOpacity={variant === 'white' ? 0.22 : 0.24} strokeWidth="1.6">
          <rect x="14" y="14" width="68" height="68" rx="9" />
          <path d="M14 48H82" />
        </g>
      )}

      <path d={S_PATH} fill="none" stroke={sColor} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <circle
        cx={BALL.cx}
        cy={BALL.cy}
        r="7"
        fill="#FBBF24"
        stroke={variant === 'bare-dark' ? '#0B1F18' : variant === 'bare-light' ? '#FFFFFF' : '#064E3B'}
        strokeWidth="2.5"
      />
    </svg>
  )
}

interface WordmarkProps {
  /** cỡ chữ (px) */
  size?: number
  /** auto: theo giao diện sáng/tối · onDark: luôn dùng màu cho nền tối */
  tone?: 'auto' | 'onDark'
  className?: string
}

export function Wordmark({ size = 26, tone = 'auto', className }: WordmarkProps) {
  const onDark = tone === 'onDark'
  return (
    <span
      className={cn('font-extrabold uppercase whitespace-nowrap', onDark ? 'text-white' : 'text-foreground', className)}
      style={{ fontFamily: 'var(--font-display)', fontSize: size, lineHeight: 0.85, letterSpacing: '0.02em' }}
    >
      SPORT<span className={onDark ? 'text-emerald-400' : 'text-emerald-700 dark:text-emerald-400'}>ARENA</span>
    </span>
  )
}

interface LogoProps {
  /** chiều cao biểu tượng (px); cỡ chữ tự theo tỷ lệ */
  size?: number
  tone?: 'auto' | 'onDark'
  className?: string
  markClassName?: string
}

/** Bản ngang: biểu tượng + chữ SPORTARENA. */
export function Logo({ size = 36, tone = 'auto', className, markClassName }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center', className)} style={{ gap: Math.round(size * 0.3) }}>
      <LogoMark size={size} className={markClassName} />
      <Wordmark size={Math.round(size * 0.72)} tone={tone} />
    </span>
  )
}
