import { getTranslations } from 'next-intl/server'
import { createLabels } from '@/i18n/labels'

/** Bản dùng trong Server Component bất đồng bộ / Server Action. */
export async function getLabels() {
  const t = await getTranslations('common')
  return createLabels(t as unknown as Parameters<typeof createLabels>[0])
}
