const pad = (n: number) => String(n).padStart(2, '0')

/** "19:00 - 21:00 (5/11/2026)" theo giờ của thiết bị; không có giờ bắt đầu thì trả null. */
export function formatMatchWindow(start: Date | null, end: Date | null): string | null {
  if (!start) return null
  const range = `${pad(start.getHours())}:${pad(start.getMinutes())} - ${end ? `${pad(end.getHours())}:${pad(end.getMinutes())}` : ''}`
  return `${range} (${start.getDate()}/${start.getMonth() + 1}/${start.getFullYear()})`
}

/** Kèo miễn phí khi chủ kèo chịu hết hoặc chưa đặt giá; ngược lại trả số tiền mỗi người, ngăn nghìn kiểu Việt Nam. */
export function perPersonCost(type: 'split' | 'host_covers', cost: number | string | null): { free: true } | { free: false; price: string } {
  if (type === 'host_covers' || !cost) return { free: true }
  return { free: false, price: Number(cost).toLocaleString('vi-VN') }
}

const SKILLS = ['beginner', 'intermediate', 'advanced', 'pro'] as const
export type KnownSkill = (typeof SKILLS)[number]

/** Trình độ hợp lệ thì trả về chính nó, còn lại null (hiển thị "cơ bản"). */
export function knownSkill(skill: string | null | undefined): KnownSkill | null {
  return SKILLS.find((s) => s === skill) ?? null
}
