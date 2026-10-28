// Dữ liệu dùng chung cho nhiều màn hình: sửa một chỗ, đổi toàn app.

export const SPORT_IDS = ['football', 'badminton', 'pickleball', 'tennis', 'basketball'] as const
export type SportId = (typeof SPORT_IDS)[number]

const SPORT_LABELS: Record<SportId, string> = {
  football: 'Bóng đá',
  badminton: 'Cầu lông',
  pickleball: 'Pickleball',
  tennis: 'Tennis',
  basketball: 'Bóng rổ',
}

export function sportLabel(id: string): string {
  return SPORT_LABELS[id as SportId] ?? id
}

/** Dùng cho bộ lọc: thêm lựa chọn "Tất cả" ở đầu */
export const SPORT_FILTER_OPTIONS = [
  { id: 'all', label: 'Tất cả môn' },
  ...SPORT_IDS.map((id) => ({ id, label: SPORT_LABELS[id] })),
]

export const MATCH_SKILL_IDS = ['all', 'beginner', 'intermediate', 'advanced'] as const
export type MatchSkillId = (typeof MATCH_SKILL_IDS)[number]

export function isMatchSkill(value: unknown): value is MatchSkillId {
  return MATCH_SKILL_IDS.includes(value as MatchSkillId)
}

/** Màu chữ đã chọn để đạt tương phản 4.5:1 trên nền sáng; bản dark dùng tông nhạt hơn */
export const SKILL_LEVELS: Record<MatchSkillId, { label: string; longLabel: string; badge: string }> = {
  all: {
    label: 'Mọi trình độ',
    longLabel: 'Mọi trình độ (Giao lưu)',
    badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25',
  },
  beginner: {
    label: 'Mới chơi',
    longLabel: 'Mới chơi / Nhập môn',
    badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
  },
  intermediate: {
    label: 'Trung bình',
    longLabel: 'Trung bình / Khá',
    badge: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/25',
  },
  advanced: {
    label: 'Bán chuyên',
    longLabel: 'Bán chuyên / Giỏi',
    badge: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25',
  },
}

export function skillInfo(id: string) {
  return SKILL_LEVELS[id as MatchSkillId] ?? SKILL_LEVELS.all
}

export const SKILL_FILTER_OPTIONS = [
  { id: 'all', label: 'Tất cả trình độ' },
  ...(['beginner', 'intermediate', 'advanced'] as const).map((id) => ({ id, label: SKILL_LEVELS[id].label })),
]

export const COST_TYPE_FILTER_OPTIONS = [
  { id: 'all', label: 'Tất cả chi phí' },
  { id: 'split', label: 'Chia đều' },
  { id: 'host_covers', label: 'Chủ bao trọn (0đ)' },
]

/** Thời gian giữ chỗ khi chưa cọc (phút). Dùng chung cho đặt sân và câu trả lời của trợ lý hỗ trợ để không bao giờ lệch nhau. */
export const HOLD_MINUTES = 15
// Chuyển khoản thủ công cần thời gian khách chuyển và chủ sân đối chiếu, nên giữ chỗ lâu hơn
export const HOLD_MINUTES_MANUAL = 60
/** Số giờ hủy miễn phí mặc định của một cụm sân (mỗi cụm sân tự đặt lại được). */
export const DEFAULT_FREE_CANCEL_HOURS = 24
