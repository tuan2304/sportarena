import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { UserRole } from '../types'

/** Vai trò của người đang đăng nhập (null khi chưa đăng nhập); cập nhật khi đăng nhập/đăng xuất. */
export function useRole(): UserRole | null {
  const [role, setRole] = useState<UserRole | null>(null)

  useEffect(() => {
    let alive = true

    async function load(userId: string | undefined) {
      if (!userId) {
        if (alive) setRole(null)
        return
      }
      const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
      if (alive) setRole((data?.role as UserRole | undefined) ?? null)
    }

    supabase.auth.getSession().then(({ data }) => load(data.session?.user.id))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      load(session?.user.id)
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return role
}
