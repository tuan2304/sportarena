'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { establishRecoverySession, updatePassword } from '@/app/actions/password'
import { parseRecoveryHash } from '@/lib/password-reset'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, KeyRound, Loader2, TriangleAlert } from 'lucide-react'
import { LogoMark } from '@/components/brand/logo'

type Stage = 'checking' | 'ready' | 'invalid'

/**
 * Đặt mật khẩu mới. Liên kết trong thư mang phiên khôi phục ở phần sau dấu # (trình duyệt không gửi phần này lên server),
 * nên việc đọc nó phải làm ở client rồi chuyển cho Server Action dựng phiên bằng cookie. `recoveryActive` cho biết server đã
 * thấy sẵn một phiên khôi phục (vd. tải lại trang sau khi phần # đã bị xóa).
 */
export function ResetPasswordForm({ recoveryActive }: { recoveryActive: boolean }) {
  const t = useTranslations('auth')
  const [stage, setStage] = useState<Stage>(recoveryActive ? 'ready' : 'checking')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Kết quả kiểm tra giữ trong ref: Strict Mode (dev) chạy effect hai lần mà phần # chỉ đọc được một lần
  const check = useRef<Promise<Stage> | null>(null)

  useEffect(() => {
    let cancelled = false

    check.current ??= (async (): Promise<Stage> => {
      const parsed = parseRecoveryHash(window.location.hash)
      // Không có token trên URL: chỉ dùng được nếu server đã thấy sẵn phiên khôi phục
      if (parsed.kind === 'none') return recoveryActive ? 'ready' : 'invalid'

      // Xóa token khỏi thanh địa chỉ và lịch sử ngay, dù thành công hay không. Phải đợi router của Next gắn xong (effect của
      // component cha chạy sau effect này) để history.replaceState đã được Next bọc và cập nhật cả bản sao URL của nó; nếu
      // không, Next sẽ ghi lại URL cũ (kèm phần #) vào lịch sử khi Server Action kết thúc.
      await new Promise((resolve) => setTimeout(resolve, 0))
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
      if (parsed.kind === 'error') return 'invalid'

      const result = await establishRecoverySession(parsed.accessToken, parsed.refreshToken)
      return result.success ? 'ready' : 'invalid'
    })()

    void check.current.then((next) => {
      if (!cancelled) setStage(next)
    })
    return () => {
      cancelled = true
    }
  }, [recoveryActive])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await updatePassword(new FormData(e.currentTarget))
    // Thành công thì Server Action đã chuyển trang; chỉ còn lại trường hợp lỗi
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  if (stage === 'checking') {
    return (
      <Card className="w-full max-w-md shadow-xl border-emerald-500/20 bg-card/90 backdrop-blur-sm">
        <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          {t('reset.checking')}
        </CardContent>
      </Card>
    )
  }

  if (stage === 'invalid') {
    return (
      <Card className="w-full max-w-md shadow-xl border-emerald-500/20 bg-card/90 backdrop-blur-sm">
        <CardHeader className="space-y-2 text-center pb-4">
          <TriangleAlert className="mx-auto w-12 h-12 text-amber-600 dark:text-amber-400" aria-hidden />
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">{t('reset.invalidTitle')}</CardTitle>
          <CardDescription className="text-muted-foreground text-sm">{t('reset.invalidText')}</CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col gap-3 pt-2">
          <Link
            href="/forgot-password"
            className="inline-flex items-center justify-center w-full h-10 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium"
          >
            {t('reset.requestNew')}
          </Link>
          <Link href="/login" className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">
            {t('forgot.backToLogin')}
          </Link>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md shadow-xl border-emerald-500/20 bg-card/90 backdrop-blur-sm">
      <CardHeader className="space-y-2 text-center pb-6">
        <LogoMark size={56} className="mx-auto drop-shadow-sm" decorative={false} />
        <CardTitle className="text-2xl font-bold tracking-tight text-foreground">{t('reset.title')}</CardTitle>
        <CardDescription className="text-muted-foreground text-sm">{t('reset.subtitle')}</CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div role="alert" className="flex items-center gap-2 p-3 text-sm text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="password">{t('reset.newPassword')}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              required
              className="h-10 focus-visible:ring-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">{t('reset.confirmPassword')}</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              required
              className="h-10 focus-visible:ring-emerald-500"
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4 pt-2">
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-emerald-700 hover:bg-emerald-800 text-white font-medium shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('reset.saving')}
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4 mr-2" aria-hidden />
                {t('reset.submit')}
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
