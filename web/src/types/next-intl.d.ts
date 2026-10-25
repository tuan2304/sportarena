import type vi from '../../messages/vi.json'
import type { Locale } from '@/i18n/config'

// Kiểm tra khóa dịch ngay lúc biên dịch: gõ sai khóa trong t('...') sẽ báo lỗi TypeScript
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale
    Messages: typeof vi
  }
}
