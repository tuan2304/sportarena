import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import { getSupabase, getCurrentUser } from '@/lib/supabase/session'
import { MainHeader } from '@/components/layout/main-header'
import { NewTicketForm } from '@/components/support/new-ticket-form'

export async function generateMetadata() {
  const t = await getTranslations('support.new')
  return { title: t('metaTitle') }
}

export default async function NewSupportTicketPage() {
  const t = await getTranslations('support.new')
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/support/new')

  // Chủ sân được gắn yêu cầu vào cụm sân của mình (RLS chỉ trả về cụm sân của họ khi lọc theo owner_id)
  const supabase = await getSupabase()
  const { data: clubs } = await supabase.from('clubs').select('id, name').eq('owner_id', user.id).order('name')

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MainHeader />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <Link href="/support" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" aria-hidden /> {t('back')}
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold">{t('heading')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <NewTicketForm clubs={clubs ?? []} />
        </div>
      </main>
    </div>
  )
}
