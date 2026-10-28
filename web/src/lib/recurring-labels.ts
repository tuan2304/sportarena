/**
 * Tên thứ trong tuần theo ngôn ngữ giao diện (0 = Chủ nhật ... 6 = Thứ bảy). Dùng một ngày cố định biết trước là Chủ nhật
 * (2026-11-08) cộng thêm số ngày nên không phụ thuộc múi giờ hay ngày hiện tại.
 */
export function weekdayName(weekday: number, intlLocaleTag: string): string {
  return new Date(Date.UTC(2026, 10, 8 + weekday)).toLocaleDateString(intlLocaleTag, { weekday: 'long', timeZone: 'UTC' })
}
