import type { MatchMessage } from '@/types/database'

export interface MatchDetail {
  id: string
  title: string
  description: string | null
  sport_type: string
  skill_level: string
  required_players: number
  current_players: number
  cost_sharing_type: string
  cost_per_person: number | null
  status: string
  creator_id: string
  created_at: string
  creator: {
    id: string
    full_name: string
    avatar_url: string | null
  } | null
  /** Giờ và sân của kèo (bản sao từ đơn đặt sân, đọc công khai; đơn đặt sân thật chỉ chủ đơn và chủ sân đọc được) */
  start_time: string
  end_time: string
  court: {
    id: string
    name: string
    sport_type: string
    club: {
      id: string
      name: string
      address: string | null
      district: string | null
      city?: string | null
      latitude?: number | null
      longitude?: number | null
    } | null
  } | null
}

export interface MatchParticipantItem {
  id: string
  user_id: string
  status: string
  message: string | null
  joined_at: string
  user: {
    id: string
    full_name: string
    avatar_url: string | null
    skill_level: string | null
  } | null
}

export type { MatchMessage }
