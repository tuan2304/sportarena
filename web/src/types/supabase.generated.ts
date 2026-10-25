
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "announcements": {
                  Row: {
                    "audience": string,"body": string,"created_at": string,"created_by": string | null,"id": string,"kind": string,"link": string | null,"sent_at": string | null,"sent_count": number,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "audience"?: string,"body": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"kind"?: string,"link"?: string | null,"sent_at"?: string | null,"sent_count"?: number,"title": string
                  }
                  Update: {
                    "audience"?: string,"body"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"kind"?: string,"link"?: string | null,"sent_at"?: string | null,"sent_count"?: number,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"bookings": {
                  Row: {
                    "cancelled_at": string | null,"cancelled_by": string | null,"court_id": string,"created_at": string,"deposit_amount": number,"during": unknown,"end_time": string,"expires_at": string,"id": string,"is_open_match": boolean,"note": string | null,"refund_amount": number,"refund_status": string,"refunded_at": string | null,"start_time": string,"status": string,"total_price": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancelled_at"?: string | null,"cancelled_by"?: string | null,"court_id": string,"created_at"?: string,"deposit_amount": number,"during"?: never,"end_time": string,"expires_at"?: string,"id"?: string,"is_open_match"?: boolean,"note"?: string | null,"refund_amount"?: number,"refund_status"?: string,"refunded_at"?: string | null,"start_time": string,"status"?: string,"total_price": number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "cancelled_at"?: string | null,"cancelled_by"?: string | null,"court_id"?: string,"created_at"?: string,"deposit_amount"?: number,"during"?: never,"end_time"?: string,"expires_at"?: string,"id"?: string,"is_open_match"?: boolean,"note"?: string | null,"refund_amount"?: number,"refund_status"?: string,"refunded_at"?: string | null,"start_time"?: string,"status"?: string,"total_price"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_court_id_fkey"
      columns: ["court_id"]
isOneToOne: false
      referencedRelation: "courts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"club_bank_accounts": {
                  Row: {
                    "account_name": string,"account_number": string,"bank_bin": string,"club_id": string,"created_at": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_name": string,"account_number": string,"bank_bin": string,"club_id": string,"created_at"?: string,"updated_at"?: string
                  }
                  Update: {
                    "account_name"?: string,"account_number"?: string,"bank_bin"?: string,"club_id"?: string,"created_at"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "club_bank_accounts_club_id_fkey"
      columns: ["club_id"]
isOneToOne: true
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    }
                  ]
                },"club_payment_settings": {
                  Row: {
                    "club_id": string,"created_at": string,"payos_api_key_enc": string,"payos_checksum_key_enc": string,"payos_client_id": string,"updated_at": string,"verified_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id": string,"created_at"?: string,"payos_api_key_enc": string,"payos_checksum_key_enc": string,"payos_client_id": string,"updated_at"?: string,"verified_at"?: string | null
                  }
                  Update: {
                    "club_id"?: string,"created_at"?: string,"payos_api_key_enc"?: string,"payos_checksum_key_enc"?: string,"payos_client_id"?: string,"updated_at"?: string,"verified_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "club_payment_settings_club_id_fkey"
      columns: ["club_id"]
isOneToOne: true
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    }
                  ]
                },"club_reviews": {
                  Row: {
                    "club_id": string,"comment": string | null,"created_at": string,"id": string,"rating": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id": string,"comment"?: string | null,"created_at"?: string,"id"?: string,"rating": number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "club_id"?: string,"comment"?: string | null,"created_at"?: string,"id"?: string,"rating"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "club_reviews_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "club_reviews_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"clubs": {
                  Row: {
                    "accepts_manual_transfer": boolean,"accepts_online_payment": boolean,"address": string,"amenities": (string)[] | null,"city": string | null,"close_time": string,"created_at": string,"description": string | null,"district": string | null,"free_cancel_hours": number,"id": string,"images": (string)[] | null,"is_active": boolean,"latitude": number | null,"longitude": number | null,"name": string,"open_time": string,"owner_id": string,"plan": string,"plan_until": string | null,"updated_at": string,"ward": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accepts_manual_transfer"?: boolean,"accepts_online_payment"?: boolean,"address": string,"amenities"?: (string)[] | null,"city"?: string | null,"close_time"?: string,"created_at"?: string,"description"?: string | null,"district"?: string | null,"free_cancel_hours"?: number,"id"?: string,"images"?: (string)[] | null,"is_active"?: boolean,"latitude"?: number | null,"longitude"?: number | null,"name": string,"open_time"?: string,"owner_id": string,"plan"?: string,"plan_until"?: string | null,"updated_at"?: string,"ward"?: string | null
                  }
                  Update: {
                    "accepts_manual_transfer"?: boolean,"accepts_online_payment"?: boolean,"address"?: string,"amenities"?: (string)[] | null,"city"?: string | null,"close_time"?: string,"created_at"?: string,"description"?: string | null,"district"?: string | null,"free_cancel_hours"?: number,"id"?: string,"images"?: (string)[] | null,"is_active"?: boolean,"latitude"?: number | null,"longitude"?: number | null,"name"?: string,"open_time"?: string,"owner_id"?: string,"plan"?: string,"plan_until"?: string | null,"updated_at"?: string,"ward"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "clubs_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"court_pricing_rules": {
                  Row: {
                    "court_id": string,"created_at": string,"days_of_week": (number)[],"end_time": string,"id": string,"name": string,"price_per_hour": number,"start_time": string
                  }
                  ComputedFields: never
                  Insert: {
                    "court_id": string,"created_at"?: string,"days_of_week"?: (number)[],"end_time": string,"id"?: string,"name": string,"price_per_hour": number,"start_time": string
                  }
                  Update: {
                    "court_id"?: string,"created_at"?: string,"days_of_week"?: (number)[],"end_time"?: string,"id"?: string,"name"?: string,"price_per_hour"?: number,"start_time"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "court_pricing_rules_court_id_fkey"
      columns: ["court_id"]
isOneToOne: false
      referencedRelation: "courts"
      referencedColumns: ["id"]
    }
                  ]
                },"courts": {
                  Row: {
                    "base_price_per_hour": number,"club_id": string,"created_at": string,"deposit_percentage": number,"id": string,"is_active": boolean,"name": string,"sport_type": string,"surface_type": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "base_price_per_hour": number,"club_id": string,"created_at"?: string,"deposit_percentage"?: number,"id"?: string,"is_active"?: boolean,"name": string,"sport_type": string,"surface_type"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "base_price_per_hour"?: number,"club_id"?: string,"created_at"?: string,"deposit_percentage"?: number,"id"?: string,"is_active"?: boolean,"name"?: string,"sport_type"?: string,"surface_type"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "courts_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    }
                  ]
                },"match_messages": {
                  Row: {
                    "content": string,"created_at": string,"id": string,"match_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content": string,"created_at"?: string,"id"?: string,"match_id": string,"user_id": string
                  }
                  Update: {
                    "content"?: string,"created_at"?: string,"id"?: string,"match_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_messages_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_messages_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"match_participants": {
                  Row: {
                    "id": string,"joined_at": string,"match_id": string,"message": string | null,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"joined_at"?: string,"match_id": string,"message"?: string | null,"status"?: string,"user_id": string
                  }
                  Update: {
                    "id"?: string,"joined_at"?: string,"match_id"?: string,"message"?: string | null,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_participants_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_participants_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"matches": {
                  Row: {
                    "booking_id": string,"cost_per_person": number | null,"cost_sharing_type": string,"created_at": string,"creator_id": string,"current_players": number,"description": string | null,"id": string,"required_players": number,"skill_level": string,"sport_type": string,"status": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id": string,"cost_per_person"?: number | null,"cost_sharing_type"?: string,"created_at"?: string,"creator_id": string,"current_players"?: number,"description"?: string | null,"id"?: string,"required_players"?: number,"skill_level"?: string,"sport_type": string,"status"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "booking_id"?: string,"cost_per_person"?: number | null,"cost_sharing_type"?: string,"created_at"?: string,"creator_id"?: string,"current_players"?: number,"description"?: string | null,"id"?: string,"required_players"?: number,"skill_level"?: string,"sport_type"?: string,"status"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "matches_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: true
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "created_at": string,"id": string,"is_read": boolean,"link": string | null,"message": string,"message_en": string | null,"title": string,"title_en": string | null,"type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_read"?: boolean,"link"?: string | null,"message": string,"message_en"?: string | null,"title": string,"title_en"?: string | null,"type"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_read"?: boolean,"link"?: string | null,"message"?: string,"message_en"?: string | null,"title"?: string,"title_en"?: string | null,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"booking_id": string,"checkout_url": string | null,"created_at": string,"id": string,"metadata": Json | null,"order_code": number,"paid_at": string | null,"payment_method": string,"payos_transaction_id": string | null,"qr_code_url": string | null,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"booking_id": string,"checkout_url"?: string | null,"created_at"?: string,"id"?: string,"metadata"?: Json | null,"order_code": number,"paid_at"?: string | null,"payment_method"?: string,"payos_transaction_id"?: string | null,"qr_code_url"?: string | null,"status"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "amount"?: number,"booking_id"?: string,"checkout_url"?: string | null,"created_at"?: string,"id"?: string,"metadata"?: Json | null,"order_code"?: number,"paid_at"?: string | null,"payment_method"?: string,"payos_transaction_id"?: string | null,"qr_code_url"?: string | null,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"full_name": string,"id": string,"locale": string | null,"phone_number": string | null,"rating": number | null,"role": string,"skill_level": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"full_name"?: string,"id": string,"locale"?: string | null,"phone_number"?: string | null,"rating"?: number | null,"role"?: string,"skill_level"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"full_name"?: string,"id"?: string,"locale"?: string | null,"phone_number"?: string | null,"rating"?: number | null,"role"?: string,"skill_level"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"push_tokens": {
                  Row: {
                    "created_at": string,"id": string,"platform": string,"token": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"platform": string,"token": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"platform"?: string,"token"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_tokens_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"subscription_payments": {
                  Row: {
                    "amount": number,"checkout_url": string | null,"club_id": string,"created_at": string,"id": string,"metadata": NonNullable<Json>,"months": number,"order_code": number,"paid_at": string | null,"qr_code_url": string | null,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"checkout_url"?: string | null,"club_id": string,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"months": number,"order_code": number,"paid_at"?: string | null,"qr_code_url"?: string | null,"status"?: string,"user_id": string
                  }
                  Update: {
                    "amount"?: number,"checkout_url"?: string | null,"club_id"?: string,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"months"?: number,"order_code"?: number,"paid_at"?: string | null,"qr_code_url"?: string | null,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscription_payments_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscription_payments_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"support_tickets": {
                  Row: {
                    "category": string,"club_id": string | null,"created_at": string,"id": string,"last_message_at": string,"status": string,"subject": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string,"club_id"?: string | null,"created_at"?: string,"id"?: string,"last_message_at"?: string,"status"?: string,"subject": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "category"?: string,"club_id"?: string | null,"created_at"?: string,"id"?: string,"last_message_at"?: string,"status"?: string,"subject"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "support_tickets_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "support_tickets_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ticket_messages": {
                  Row: {
                    "body": string,"created_at": string,"id": string,"is_staff": boolean,"sender_id": string | null,"sender_name": string,"ticket_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: string,"is_staff"?: boolean,"sender_id"?: string | null,"sender_name"?: string,"ticket_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: string,"is_staff"?: boolean,"sender_id"?: string | null,"sender_name"?: string,"ticket_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ticket_messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ticket_messages_ticket_id_fkey"
      columns: ["ticket_id"]
isOneToOne: false
      referencedRelation: "support_tickets"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "apply_subscription_payment":
{ Args: { "p_payment_id": string,"p_reference"?: string }; Returns: {
              "club_id": string,"plan_until": string,"user_id": string
            }[]
                           },
"broadcast_announcement":
{ Args: { "p_id": string }; Returns: number
                           },
"can_review_club":
{ Args: { "p_club": string,"p_user": string }; Returns: boolean
                           },
"dearmor":
{ Args: { "": string }; Returns: string
                           },
"expire_pending_bookings":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"gen_random_uuid":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"gen_salt":
{ Args: { "": string }; Returns: string
                           },
"rate_limit_hit":
{ Args: { "p_key": string,"p_max": number,"p_window_seconds": number }; Returns: {
              "allowed": boolean,"hit_count": number,"retry_after": number
            }[]
                           },
"get_my_profile":
{ Args: Record<PropertyKey, never>; Returns: {
              "avatar_url": string | null,"full_name": string,"id": string,"phone_number": string | null,"rating": number | null,"role": string,"skill_level": string | null
            }[]
                           },
"player_public_stats":
{ Args: { "p_user": string }; Returns: {
              "bookings_played": number,"matches_created": number,"matches_joined": number
            }[]
                           },
"register_push_token":
{ Args: { "p_platform": string; "p_token": string }; Returns: undefined
                           },
"unregister_push_token":
{ Args: { "p_token": string }; Returns: undefined
                           },
"set_my_locale":
{ Args: { "p_locale": string }; Returns: undefined
                           },
"get_booking_contacts":
{ Args: { "p_booking_ids": (string)[] }; Returns: {
              "booking_id": string,"full_name": string,"phone_number": string | null
            }[]
                           },
"get_busy_slots":
{ Args: { "p_court_ids": (string)[] }; Returns: {
              "court_id": string,"end_time": string,"start_time": string,"status": string
            }[]
                           },
"is_admin":
{ Args: { "p_user": string }; Returns: boolean
                           },
"is_match_member":
{ Args: { "p_match": string,"p_user": string }; Returns: boolean
                           },
"next_payos_order_code":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"pgp_armor_headers":
{ Args: { "": string }; Returns: Record<string, unknown>[]
                           },
"platform_stats":
{ Args: { "p_from": string,"p_to": string }; Returns: Json
                           },
"uuid_generate_v1":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"uuid_generate_v1mc":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"uuid_generate_v3":
{ Args: { "name": string,"namespace": string }; Returns: string
                           },
"uuid_generate_v4":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"uuid_generate_v5":
{ Args: { "name": string,"namespace": string }; Returns: string
                           },
"uuid_nil":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"uuid_ns_dns":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"uuid_ns_oid":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"uuid_ns_url":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"uuid_ns_x500":
{ Args: Record<PropertyKey, never>; Returns: string
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
