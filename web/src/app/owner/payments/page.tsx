import { getTranslations } from 'next-intl/server'
import { getSupabase, getCurrentUser } from '@/lib/supabase/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PaymentSettingsForm } from '@/components/owner/payment-settings-form'
import { BankAccountForm } from '@/components/owner/bank-account-form'
import { CancelPolicyForm } from '@/components/owner/cancel-policy-form'
import { resolveAppUrl } from '@/lib/app-url'
import { Wallet, Landmark } from 'lucide-react'

export async function generateMetadata() {
  const t = await getTranslations('ownerPayments')
  return { title: t('metaTitle') }
}

export default async function OwnerPaymentsPage() {
  const t = await getTranslations('ownerPayments')
  const supabase = await getSupabase()
  const user = await getCurrentUser()

  const { data: clubs } = await supabase
    .from('clubs')
    .select('id, name, free_cancel_hours')
    .eq('owner_id', user?.id ?? '')
    .order('created_at', { ascending: true })
  const clubList = clubs ?? []
  const clubIds = clubList.map((c) => c.id)

  // Khóa chỉ đọc được bằng service_role; ở đây chỉ lấy phần không bí mật (Client ID, thời điểm xác thực)
  const admin = createAdminClient()
  const { data: settings } = clubIds.length
    ? await admin.from('club_payment_settings').select('club_id, payos_client_id, verified_at').in('club_id', clubIds)
    : { data: [] }
  const settingsByClub = new Map((settings ?? []).map((s) => [s.club_id, s]))

  // Tài khoản ngân hàng chỉ chủ cụm sân đọc được (RLS), nên dùng client của người dùng
  const { data: banks } = clubIds.length
    ? await supabase.from('club_bank_accounts').select('club_id, bank_bin, account_number, account_name').in('club_id', clubIds)
    : { data: [] }
  const bankByClub = new Map((banks ?? []).map((b) => [b.club_id, b]))

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
          <Wallet className="w-7 h-7 text-emerald-700 dark:text-emerald-400" aria-hidden />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t.rich('subtitle', { strong: (c) => <strong>{c}</strong> })}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('howTitle')}</CardTitle>
          <CardDescription>{t('howDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>
              {t.rich('step1', {
                strong: (c) => <strong>{c}</strong>,
                link: (c) => <a href="https://my.payos.vn" target="_blank" rel="noreferrer" className="underline text-emerald-700 dark:text-emerald-400">{c}</a>,
              })}
            </li>
            <li>{t.rich('step2', { strong: (c) => <strong>{c}</strong> })}</li>
            <li>
              {t.rich('step3', {
                strong: (c) => <strong>{c}</strong>,
                code: (c) => <code className="mx-1 px-1.5 py-0.5 rounded bg-muted text-xs">{c}</code>,
                url: `${resolveAppUrl()}/api/payos/webhook`,
              })}
            </li>
          </ol>
        </CardContent>
      </Card>

      {clubList.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t('noClubs')}
          </CardContent>
        </Card>
      ) : (
        clubList.map((club) => {
          const s = settingsByClub.get(club.id)
          const bank = bankByClub.get(club.id)
          return (
            <Card key={club.id}>
              <CardHeader>
                <CardTitle className="text-lg">{club.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <PaymentSettingsForm
                  clubId={club.id}
                  clubName={club.name}
                  connected={Boolean(s?.verified_at)}
                  clientId={s?.payos_client_id ?? null}
                  verifiedAt={s?.verified_at ?? null}
                />

                <div className="border-t border-border/60 pt-5">
                  <BankAccountForm
                    clubId={club.id}
                    clubName={club.name}
                    initial={bank ? { bin: bank.bank_bin, accountNumber: bank.account_number, accountName: bank.account_name } : null}
                  />
                </div>

                <div className="border-t border-border/60 pt-5">
                  <CancelPolicyForm clubId={club.id} hours={club.free_cancel_hours} />
                </div>

                {!s?.verified_at && !bank && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs text-amber-900 dark:text-amber-200 flex gap-2">
                    <Landmark className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
                    <span>
                      {t.rich('notAccepting', { strong: (c) => <strong>{c}</strong> })}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
