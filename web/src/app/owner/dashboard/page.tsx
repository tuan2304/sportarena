import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { getSupabase, getCurrentUser } from '@/lib/supabase/session'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Building2,
  CalendarCheck,
  CircleDollarSign,
  TrendingUp,
  Plus,
  ArrowRight,
  Clock,
  User,
} from 'lucide-react'

import { formatVnd, formatTime, formatDate } from '@/lib/format'
export default async function OwnerDashboardPage() {
  const t = await getTranslations('owner.dashboard')
  const supabase = await getSupabase()
  const user = await getCurrentUser()

  // 1. Lấy danh sách cụm sân của chủ sân
  const { data: clubs } = await supabase
    .from('clubs')
    .select('*, courts(*)')
    .eq('owner_id', user?.id || '')

  const clubList = clubs || []
  const totalClubs = clubList.length
  const totalCourts = clubList.reduce((acc, club) => acc + (club.courts?.length || 0), 0)

  // 2. Lấy danh sách bookings gần nhất
  const courtIds = clubList.flatMap((c) => c.courts?.map((court: { id: string }) => court.id) || [])

  let bookings: Array<{
    id: string
    start_time: string
    end_time: string
    total_price: number
    deposit_amount: number
    status: string
    court: { name: string; sport_type: string } | null
    profile: { full_name: string } | null
  }> = []

  if (courtIds.length > 0) {
    const { data: bookingData } = await supabase
      .from('bookings')
      .select(`
        id,
        start_time,
        end_time,
        total_price,
        deposit_amount,
        status,
        court:courts(name, sport_type),
        profile:profiles(full_name)
      `)
      .in('court_id', courtIds)
      .order('created_at', { ascending: false })
      .limit(6)

    bookings = (bookingData as unknown as typeof bookings) || []
  }

  const todayBookingsCount = bookings.length
  const totalEstimatedDeposit = bookings.reduce(
    (acc, b) => (b.status === 'confirmed' ? acc + Number(b.deposit_amount) : acc),
    0
  )

  return (
    <div className="space-y-8">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/owner/clubs">
            <Button className="bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm shadow-emerald-600/20 cursor-pointer">
              <Plus className="w-4 h-4 mr-1.5" />
              {t('addClub')}
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/80 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('totalClubs')}
            </CardTitle>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              <Building2 className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalClubs}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('activeNote')}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('totalCourts')}
            </CardTitle>
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalCourts}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('readyNote')}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('recent')}
            </CardTitle>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{todayBookingsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('recentNote')}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('deposits')}
            </CardTitle>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400">
              <CircleDollarSign className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {formatVnd(totalEstimatedDeposit)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('depositsNote')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Bookings Section */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold">{t('latest')}</CardTitle>
            <CardDescription className="text-xs">
              {t('latestNote')}
            </CardDescription>
          </div>
          <Link href="/owner/schedule">
            <Button variant="ghost" size="sm" className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-400 cursor-pointer">
              {t('viewAll')} <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-xl">
              <CalendarCheck className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
              <h3 className="text-base font-semibold text-foreground">{t('emptyTitle')}</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
                {t('emptyText')}
              </p>
              <Link href="/owner/clubs">
                <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer">
                  <Plus className="w-4 h-4 mr-1" /> {t('createClub')}
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bookings.map((item) => {
                const startTime = formatTime(item.start_time)
                const endTime = formatTime(item.end_time)
                const dateStr = formatDate(item.start_time)

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-border bg-card hover:border-emerald-500/30 transition-all flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-sm text-foreground">
                          {item.court?.name || t('standardCourt')}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                          <span>{startTime} - {endTime} ({dateStr})</span>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          item.status === 'confirmed'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                            : item.status === 'pending'
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                            : 'bg-muted text-muted-foreground'
                        }
                      >
                        {item.status === 'confirmed'
                          ? t('paid')
                          : item.status === 'pending'
                          ? t('pending')
                          : item.status}
                      </Badge>
                    </div>

                    <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <User className="w-3.5 h-3.5" />
                        <span>{item.profile?.full_name || t('guest')}</span>
                      </div>
                      <div className="font-bold text-foreground">
                        {t('deposit', { amount: formatVnd(item.deposit_amount) })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
