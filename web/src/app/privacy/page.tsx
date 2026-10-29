import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { MainHeader } from '@/components/layout/main-header'

export async function generateMetadata() {
  const t = await getTranslations('legal.privacy')
  return { title: t('metaTitle') }
}

interface Section {
  title: string
  items: Record<string, string>
}

// Trang công khai: cửa hàng ứng dụng yêu cầu có đường dẫn chính sách quyền riêng tư truy cập được khi chưa đăng nhập
export default async function PrivacyPage() {
  const t = await getTranslations('legal')
  // Bản dịch không dùng mảng (kiểu messages chỉ cho chuỗi lồng nhau), nên các mục đánh số 1, 2, 3...
  const sections = Object.values(t.raw('privacy.sections' as never) as Record<string, Section>)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MainHeader />
      <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight">{t('privacy.title')}</h1>
          <p className="text-xs text-muted-foreground">{t('updated')}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{t('privacy.intro')}</p>
        </header>

        {sections.map((section, i) => (
          <section key={section.title} className="space-y-2">
            <h2 className="text-lg font-bold">
              {i + 1}. {section.title}
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground leading-relaxed">
              {Object.values(section.items).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}

        <div className="flex flex-wrap gap-4 text-sm font-semibold">
          <Link href="/delete-account" className="inline-block py-2.5 text-emerald-700 dark:text-emerald-400 hover:underline">
            {t('footerDelete')}
          </Link>
          <Link href="/" className="inline-block py-2.5 text-muted-foreground hover:underline">
            {t('back')}
          </Link>
        </div>
      </main>
    </div>
  )
}
