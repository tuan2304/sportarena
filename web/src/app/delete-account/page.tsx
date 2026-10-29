import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { MainHeader } from '@/components/layout/main-header'
import { Button } from '@/components/ui/button'

export async function generateMetadata() {
  const t = await getTranslations('legal.deleteAccount')
  return { title: t('metaTitle') }
}

function Block({ title, items, tone }: { title: string; items: string[]; tone?: 'warn' }) {
  return (
    <section className="space-y-2">
      <h2 className={`text-lg font-bold ${tone === 'warn' ? 'text-amber-800 dark:text-amber-300' : ''}`}>{title}</h2>
      <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground leading-relaxed">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Trang công khai hướng dẫn xóa tài khoản. Google Play (mục Data safety) yêu cầu một đường dẫn xem được khi chưa đăng nhập;
 * Apple cũng cần người dùng tìm được chức năng này. Thao tác xóa thật nằm ở /profile (cần đăng nhập).
 */
export default async function DeleteAccountPage() {
  const t = await getTranslations('legal')
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim()
  // Các danh sách được lưu dạng object đánh số 1, 2, 3... (kiểu messages không cho mảng)
  const list = (key: string) => Object.values(t.raw(key as never) as Record<string, string>)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MainHeader />
      <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight">{t('deleteAccount.title')}</h1>
          <p className="text-xs text-muted-foreground">{t('updated')}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{t('deleteAccount.intro')}</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">{t('deleteAccount.stepsTitle')}</h2>
          <ol className="list-decimal pl-5 space-y-1.5 text-sm text-muted-foreground leading-relaxed">
            {list('deleteAccount.steps').map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <Link href="/login?next=/profile">
            <Button className="bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer">{t('deleteAccount.loginCta')}</Button>
          </Link>
        </section>

        <Block title={t('deleteAccount.deletedTitle')} items={list('deleteAccount.deleted')} />
        <Block title={t('deleteAccount.keptTitle')} items={list('deleteAccount.kept')} />
        <Block title={t('deleteAccount.blockedTitle')} items={list('deleteAccount.blocked')} tone="warn" />

        <section className="space-y-2">
          <h2 className="text-lg font-bold">{t('deleteAccount.cannotLoginTitle')}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{t('deleteAccount.cannotLogin')}</p>
          {email && <p className="text-sm text-muted-foreground leading-relaxed">{t('deleteAccount.contact', { email })}</p>}
        </section>

        <div className="flex flex-wrap gap-4 text-sm font-semibold">
          <Link href="/privacy" className="inline-block py-2.5 text-emerald-700 dark:text-emerald-400 hover:underline">
            {t('deleteAccount.privacyLink')}
          </Link>
          <Link href="/" className="inline-block py-2.5 text-muted-foreground hover:underline">
            {t('back')}
          </Link>
        </div>
      </main>
    </div>
  )
}
