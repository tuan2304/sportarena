import { useTranslations } from 'next-intl'

/**
 * Nhãn hiển thị cho các giá trị dạng mã (môn thể thao, trình độ, cách chia phí...). Mã lưu trong database luôn cố định;
 * chỉ phần chữ hiển thị đổi theo ngôn ngữ. Dùng `useLabels()` trong component, hoặc `createLabels(await getTranslations('common'))`
 * ở nơi không dùng được hook.
 */
type Translate = {
  (key: string, values?: Record<string, string | number>): string
  has(key: string): boolean
}

export function createLabels(t: Translate) {
  const pick = (key: string, fallback: string) => (t.has(key) ? t(key) : fallback)
  return {
    /** football → "Bóng đá" / "Football" */
    sport: (id: string) => pick(`sports.${id}`, id),
    /** Trình độ của kèo, ngắn: "Mới chơi" */
    skill: (id: string) => pick(`skills.${id}.short`, pick('skills.all.short', id)),
    /** Trình độ của kèo, dài: "Mới chơi / Nhập môn" */
    skillLong: (id: string) => pick(`skills.${id}.long`, pick('skills.all.long', id)),
    /** Trình độ trong hồ sơ người chơi */
    playerSkill: (id: string | null | undefined) => (id && t.has(`playerSkills.${id}`) ? t(`playerSkills.${id}`) : t('playerSkills.unknown')),
    costType: (id: string) => pick(`costTypes.${id}`, id),
    t,
  }
}

export type Labels = ReturnType<typeof createLabels>

/** Dùng được ở cả Server Component đồng bộ lẫn Client Component. */
export function useLabels(): Labels {
  return createLabels(useTranslations('common') as unknown as Translate)
}
