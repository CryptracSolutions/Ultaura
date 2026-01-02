export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      documents: {
        Row: {
          content: string | null
          created_at: string
          embedding: string | null
          id: number
          metadata: Json | null
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          embedding?: string | null
          id?: number
          metadata?: Json | null
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          embedding?: string | null
          id?: number
          metadata?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      feedback_submissions: {
        Row: {
          attachment_url: string | null
          created_at: string
          device_info: Json | null
          email: string | null
          embedding: string | null
          id: number
          metadata: Json | null
          screen_name: string | null
          text: string
          type: Database["public"]["Enums"]["feedback_type"]
          user_id: string | null
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          device_info?: Json | null
          email?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
          screen_name?: string | null
          text: string
          type: Database["public"]["Enums"]["feedback_type"]
          user_id?: string | null
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          device_info?: Json | null
          email?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
          screen_name?: string | null
          text?: string
          type?: Database["public"]["Enums"]["feedback_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          code: string | null
          created_at: string
          id: number
          invited_email: string | null
          organization_id: number
          role: number
          user_id: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: never
          invited_email?: string | null
          organization_id: number
          role: number
          user_id?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: never
          invited_email?: string | null
          organization_id?: number
          role?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: number
          logo_url: string | null
          name: string
          uuid: string
        }
        Insert: {
          created_at?: string
          id?: never
          logo_url?: string | null
          name: string
          uuid?: string
        }
        Update: {
          created_at?: string
          id?: never
          logo_url?: string | null
          name?: string
          uuid?: string
        }
        Relationships: []
      }
      organizations_subscriptions: {
        Row: {
          customer_id: string
          organization_id: number
          subscription_id: string | null
        }
        Insert: {
          customer_id: string
          organization_id: number
          subscription_id?: string | null
        }
        Update: {
          customer_id?: string
          organization_id?: number
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_subscriptions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: true
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string | null
          currency: string | null
          id: string
          interval: string | null
          interval_count: number | null
          period_ends_at: string | null
          period_starts_at: string | null
          price_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          trial_starts_at: string | null
        }
        Insert: {
          cancel_at_period_end: boolean
          created_at?: string | null
          currency?: string | null
          id: string
          interval?: string | null
          interval_count?: number | null
          period_ends_at?: string | null
          period_starts_at?: string | null
          price_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          trial_starts_at?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string | null
          currency?: string | null
          id?: string
          interval?: string | null
          interval_count?: number | null
          period_ends_at?: string | null
          period_starts_at?: string | null
          price_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          trial_starts_at?: string | null
        }
        Relationships: []
      }
      ultaura_account_crypto_keys: {
        Row: {
          account_id: string
          created_at: string
          dek_alg: string
          dek_kid: string
          dek_wrap_iv: string
          dek_wrap_tag: string
          dek_wrapped: string
          id: string
          rotated_at: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          dek_alg?: string
          dek_kid?: string
          dek_wrap_iv: string
          dek_wrap_tag: string
          dek_wrapped: string
          id?: string
          rotated_at?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          dek_alg?: string
          dek_kid?: string
          dek_wrap_iv?: string
          dek_wrap_tag?: string
          dek_wrapped?: string
          id?: string
          rotated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_account_crypto_keys_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_accounts: {
        Row: {
          billing_email: string
          created_at: string
          created_by_user_id: string | null
          cycle_end: string | null
          cycle_start: string | null
          default_locale: string
          id: string
          minutes_included: number
          minutes_used: number
          name: string
          organization_id: number
          overage_cents_cap: number
          plan_id: string | null
          status: Database["public"]["Enums"]["ultaura_account_status"]
          trial_ends_at: string | null
          trial_plan_id: string | null
          trial_starts_at: string | null
        }
        Insert: {
          billing_email: string
          created_at?: string
          created_by_user_id?: string | null
          cycle_end?: string | null
          cycle_start?: string | null
          default_locale?: string
          id?: string
          minutes_included?: number
          minutes_used?: number
          name: string
          organization_id: number
          overage_cents_cap?: number
          plan_id?: string | null
          status?: Database["public"]["Enums"]["ultaura_account_status"]
          trial_ends_at?: string | null
          trial_plan_id?: string | null
          trial_starts_at?: string | null
        }
        Update: {
          billing_email?: string
          created_at?: string
          created_by_user_id?: string | null
          cycle_end?: string | null
          cycle_start?: string | null
          default_locale?: string
          id?: string
          minutes_included?: number
          minutes_used?: number
          name?: string
          organization_id?: number
          overage_cents_cap?: number
          plan_id?: string | null
          status?: Database["public"]["Enums"]["ultaura_account_status"]
          trial_ends_at?: string | null
          trial_plan_id?: string | null
          trial_starts_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_accounts_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_accounts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "ultaura_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_call_events: {
        Row: {
          call_session_id: string
          created_at: string
          id: string
          payload: Json | null
          type: string
        }
        Insert: {
          call_session_id: string
          created_at?: string
          id?: string
          payload?: Json | null
          type: string
        }
        Update: {
          call_session_id?: string
          created_at?: string
          id?: string
          payload?: Json | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_call_events_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "ultaura_call_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_call_sessions: {
        Row: {
          account_id: string
          connected_at: string | null
          cost_estimate_cents_model: number | null
          cost_estimate_cents_twilio: number | null
          created_at: string
          direction: Database["public"]["Enums"]["ultaura_call_direction"]
          end_reason:
            | Database["public"]["Enums"]["ultaura_call_end_reason"]
            | null
          ended_at: string | null
          id: string
          is_reminder_call: boolean
          language_detected: string | null
          line_id: string
          reminder_id: string | null
          reminder_message: string | null
          seconds_connected: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["ultaura_call_status"]
          tool_invocations: number
          twilio_call_sid: string | null
          twilio_from: string | null
          twilio_to: string | null
        }
        Insert: {
          account_id: string
          connected_at?: string | null
          cost_estimate_cents_model?: number | null
          cost_estimate_cents_twilio?: number | null
          created_at?: string
          direction: Database["public"]["Enums"]["ultaura_call_direction"]
          end_reason?:
            | Database["public"]["Enums"]["ultaura_call_end_reason"]
            | null
          ended_at?: string | null
          id?: string
          is_reminder_call?: boolean
          language_detected?: string | null
          line_id: string
          reminder_id?: string | null
          reminder_message?: string | null
          seconds_connected?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ultaura_call_status"]
          tool_invocations?: number
          twilio_call_sid?: string | null
          twilio_from?: string | null
          twilio_to?: string | null
        }
        Update: {
          account_id?: string
          connected_at?: string | null
          cost_estimate_cents_model?: number | null
          cost_estimate_cents_twilio?: number | null
          created_at?: string
          direction?: Database["public"]["Enums"]["ultaura_call_direction"]
          end_reason?:
            | Database["public"]["Enums"]["ultaura_call_end_reason"]
            | null
          ended_at?: string | null
          id?: string
          is_reminder_call?: boolean
          language_detected?: string | null
          line_id?: string
          reminder_id?: string | null
          reminder_message?: string | null
          seconds_connected?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ultaura_call_status"]
          tool_invocations?: number
          twilio_call_sid?: string | null
          twilio_from?: string | null
          twilio_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_call_sessions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_call_sessions_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_call_sessions_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "ultaura_reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_consents: {
        Row: {
          account_id: string
          created_at: string
          evidence: Json | null
          granted: boolean
          granted_by: string
          id: string
          line_id: string
          revoked_at: string | null
          type: Database["public"]["Enums"]["ultaura_consent_type"]
        }
        Insert: {
          account_id: string
          created_at?: string
          evidence?: Json | null
          granted: boolean
          granted_by: string
          id?: string
          line_id: string
          revoked_at?: string | null
          type: Database["public"]["Enums"]["ultaura_consent_type"]
        }
        Update: {
          account_id?: string
          created_at?: string
          evidence?: Json | null
          granted?: boolean
          granted_by?: string
          id?: string
          line_id?: string
          revoked_at?: string | null
          type?: Database["public"]["Enums"]["ultaura_consent_type"]
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_consents_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_consents_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_lines: {
        Row: {
          account_id: string
          allow_voice_reminder_control: boolean
          created_at: string
          display_name: string
          do_not_call: boolean
          id: string
          inbound_allowed: boolean
          last_successful_call_at: string | null
          next_scheduled_call_at: string | null
          phone_e164: string
          phone_verified_at: string | null
          preferred_language: string
          quiet_hours_end: string
          quiet_hours_start: string
          seed_avoid_topics: string[] | null
          seed_interests: string[] | null
          spanish_formality: string
          status: Database["public"]["Enums"]["ultaura_line_status"]
          timezone: string
        }
        Insert: {
          account_id: string
          allow_voice_reminder_control?: boolean
          created_at?: string
          display_name: string
          do_not_call?: boolean
          id?: string
          inbound_allowed?: boolean
          last_successful_call_at?: string | null
          next_scheduled_call_at?: string | null
          phone_e164: string
          phone_verified_at?: string | null
          preferred_language?: string
          quiet_hours_end?: string
          quiet_hours_start?: string
          seed_avoid_topics?: string[] | null
          seed_interests?: string[] | null
          spanish_formality?: string
          status?: Database["public"]["Enums"]["ultaura_line_status"]
          timezone?: string
        }
        Update: {
          account_id?: string
          allow_voice_reminder_control?: boolean
          created_at?: string
          display_name?: string
          do_not_call?: boolean
          id?: string
          inbound_allowed?: boolean
          last_successful_call_at?: string | null
          next_scheduled_call_at?: string | null
          phone_e164?: string
          phone_verified_at?: string | null
          preferred_language?: string
          quiet_hours_end?: string
          quiet_hours_start?: string
          seed_avoid_topics?: string[] | null
          seed_interests?: string[] | null
          spanish_formality?: string
          status?: Database["public"]["Enums"]["ultaura_line_status"]
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_memories: {
        Row: {
          account_id: string
          active: boolean
          confidence: number | null
          created_at: string
          id: string
          key: string
          line_id: string
          privacy_scope: Database["public"]["Enums"]["ultaura_privacy_scope"]
          redaction_level: string
          source: string | null
          type: Database["public"]["Enums"]["ultaura_memory_type"]
          updated_at: string | null
          value_alg: string
          value_ciphertext: string
          value_iv: string
          value_kid: string
          value_tag: string
          version: number
        }
        Insert: {
          account_id: string
          active?: boolean
          confidence?: number | null
          created_at?: string
          id?: string
          key: string
          line_id: string
          privacy_scope?: Database["public"]["Enums"]["ultaura_privacy_scope"]
          redaction_level?: string
          source?: string | null
          type: Database["public"]["Enums"]["ultaura_memory_type"]
          updated_at?: string | null
          value_alg?: string
          value_ciphertext: string
          value_iv: string
          value_kid: string
          value_tag: string
          version?: number
        }
        Update: {
          account_id?: string
          active?: boolean
          confidence?: number | null
          created_at?: string
          id?: string
          key?: string
          line_id?: string
          privacy_scope?: Database["public"]["Enums"]["ultaura_privacy_scope"]
          redaction_level?: string
          source?: string | null
          type?: Database["public"]["Enums"]["ultaura_memory_type"]
          updated_at?: string | null
          value_alg?: string
          value_ciphertext?: string
          value_iv?: string
          value_kid?: string
          value_tag?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_memories_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_memories_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_minute_ledger: {
        Row: {
          account_id: string
          billable_minutes: number
          billable_type: Database["public"]["Enums"]["ultaura_billable_type"]
          call_session_id: string
          created_at: string
          cycle_end: string | null
          cycle_start: string | null
          direction: Database["public"]["Enums"]["ultaura_call_direction"]
          id: string
          idempotency_key: string
          line_id: string
          seconds_connected: number
          stripe_usage_record_id: string | null
          stripe_usage_reported: boolean
        }
        Insert: {
          account_id: string
          billable_minutes: number
          billable_type: Database["public"]["Enums"]["ultaura_billable_type"]
          call_session_id: string
          created_at?: string
          cycle_end?: string | null
          cycle_start?: string | null
          direction: Database["public"]["Enums"]["ultaura_call_direction"]
          id?: string
          idempotency_key: string
          line_id: string
          seconds_connected: number
          stripe_usage_record_id?: string | null
          stripe_usage_reported?: boolean
        }
        Update: {
          account_id?: string
          billable_minutes?: number
          billable_type?: Database["public"]["Enums"]["ultaura_billable_type"]
          call_session_id?: string
          created_at?: string
          cycle_end?: string | null
          cycle_start?: string | null
          direction?: Database["public"]["Enums"]["ultaura_call_direction"]
          id?: string
          idempotency_key?: string
          line_id?: string
          seconds_connected?: number
          stripe_usage_record_id?: string | null
          stripe_usage_reported?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_minute_ledger_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_minute_ledger_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_opt_outs: {
        Row: {
          account_id: string
          call_session_id: string | null
          channel: Database["public"]["Enums"]["ultaura_opt_out_channel"]
          created_at: string
          id: string
          line_id: string
          reason: string | null
          source: string
        }
        Insert: {
          account_id: string
          call_session_id?: string | null
          channel: Database["public"]["Enums"]["ultaura_opt_out_channel"]
          created_at?: string
          id?: string
          line_id: string
          reason?: string | null
          source: string
        }
        Update: {
          account_id?: string
          call_session_id?: string | null
          channel?: Database["public"]["Enums"]["ultaura_opt_out_channel"]
          created_at?: string
          id?: string
          line_id?: string
          reason?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_opt_outs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_opt_outs_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "ultaura_call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_opt_outs_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_phone_verifications: {
        Row: {
          channel: string
          created_at: string
          expires_at: string
          id: string
          line_id: string
          status: string
          twilio_verification_sid: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          expires_at: string
          id?: string
          line_id: string
          status?: string
          twilio_verification_sid?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          expires_at?: string
          id?: string
          line_id?: string
          status?: string
          twilio_verification_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_phone_verifications_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_plans: {
        Row: {
          annual_price_cents: number
          created_at: string
          display_name: string
          id: string
          lines_included: number
          minutes_included: number
          monthly_price_cents: number
          overage_rate_cents_per_min: number
        }
        Insert: {
          annual_price_cents?: number
          created_at?: string
          display_name: string
          id: string
          lines_included?: number
          minutes_included?: number
          monthly_price_cents?: number
          overage_rate_cents_per_min?: number
        }
        Update: {
          annual_price_cents?: number
          created_at?: string
          display_name?: string
          id?: string
          lines_included?: number
          minutes_included?: number
          monthly_price_cents?: number
          overage_rate_cents_per_min?: number
        }
        Relationships: []
      }
      ultaura_reminder_events: {
        Row: {
          account_id: string
          call_session_id: string | null
          created_at: string
          event_type: string
          id: string
          line_id: string
          metadata: Json | null
          reminder_id: string
          triggered_by: string
        }
        Insert: {
          account_id: string
          call_session_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          line_id: string
          metadata?: Json | null
          reminder_id: string
          triggered_by: string
        }
        Update: {
          account_id?: string
          call_session_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          line_id?: string
          metadata?: Json | null
          reminder_id?: string
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_reminder_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_reminder_events_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "ultaura_call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_reminder_events_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_reminder_events_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "ultaura_reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_reminders: {
        Row: {
          account_id: string
          created_at: string
          created_by_call_session_id: string | null
          current_snooze_count: number
          day_of_month: number | null
          days_of_week: number[] | null
          delivery_method: string
          due_at: string
          ends_at: string | null
          id: string
          interval_days: number | null
          is_paused: boolean
          is_recurring: boolean
          last_delivery_status: string | null
          line_id: string
          message: string
          occurrence_count: number
          original_due_at: string | null
          paused_at: string | null
          privacy_scope: Database["public"]["Enums"]["ultaura_privacy_scope"]
          rrule: string | null
          snoozed_until: string | null
          status: Database["public"]["Enums"]["ultaura_reminder_status"]
          time_of_day: string | null
          timezone: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by_call_session_id?: string | null
          current_snooze_count?: number
          day_of_month?: number | null
          days_of_week?: number[] | null
          delivery_method?: string
          due_at: string
          ends_at?: string | null
          id?: string
          interval_days?: number | null
          is_paused?: boolean
          is_recurring?: boolean
          last_delivery_status?: string | null
          line_id: string
          message: string
          occurrence_count?: number
          original_due_at?: string | null
          paused_at?: string | null
          privacy_scope?: Database["public"]["Enums"]["ultaura_privacy_scope"]
          rrule?: string | null
          snoozed_until?: string | null
          status?: Database["public"]["Enums"]["ultaura_reminder_status"]
          time_of_day?: string | null
          timezone: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by_call_session_id?: string | null
          current_snooze_count?: number
          day_of_month?: number | null
          days_of_week?: number[] | null
          delivery_method?: string
          due_at?: string
          ends_at?: string | null
          id?: string
          interval_days?: number | null
          is_paused?: boolean
          is_recurring?: boolean
          last_delivery_status?: string | null
          line_id?: string
          message?: string
          occurrence_count?: number
          original_due_at?: string | null
          paused_at?: string | null
          privacy_scope?: Database["public"]["Enums"]["ultaura_privacy_scope"]
          rrule?: string | null
          snoozed_until?: string | null
          status?: Database["public"]["Enums"]["ultaura_reminder_status"]
          time_of_day?: string | null
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_reminders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_reminders_created_by_call_session_id_fkey"
            columns: ["created_by_call_session_id"]
            isOneToOne: false
            referencedRelation: "ultaura_call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_reminders_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_safety_events: {
        Row: {
          account_id: string
          action_taken: string | null
          call_session_id: string | null
          created_at: string
          id: string
          line_id: string
          signals: Json | null
          tier: Database["public"]["Enums"]["ultaura_safety_tier"]
        }
        Insert: {
          account_id: string
          action_taken?: string | null
          call_session_id?: string | null
          created_at?: string
          id?: string
          line_id: string
          signals?: Json | null
          tier: Database["public"]["Enums"]["ultaura_safety_tier"]
        }
        Update: {
          account_id?: string
          action_taken?: string | null
          call_session_id?: string | null
          created_at?: string
          id?: string
          line_id?: string
          signals?: Json | null
          tier?: Database["public"]["Enums"]["ultaura_safety_tier"]
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_safety_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_safety_events_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "ultaura_call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_safety_events_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_schedules: {
        Row: {
          account_id: string
          created_at: string
          days_of_week: number[]
          enabled: boolean
          id: string
          last_result:
            | Database["public"]["Enums"]["ultaura_schedule_result"]
            | null
          last_run_at: string | null
          line_id: string
          next_run_at: string | null
          retry_count: number
          retry_policy: Json
          rrule: string
          time_of_day: string
          timezone: string
        }
        Insert: {
          account_id: string
          created_at?: string
          days_of_week?: number[]
          enabled?: boolean
          id?: string
          last_result?:
            | Database["public"]["Enums"]["ultaura_schedule_result"]
            | null
          last_run_at?: string | null
          line_id: string
          next_run_at?: string | null
          retry_count?: number
          retry_policy?: Json
          rrule: string
          time_of_day?: string
          timezone: string
        }
        Update: {
          account_id?: string
          created_at?: string
          days_of_week?: number[]
          enabled?: boolean
          id?: string
          last_result?:
            | Database["public"]["Enums"]["ultaura_schedule_result"]
            | null
          last_run_at?: string | null
          line_id?: string
          next_run_at?: string | null
          retry_count?: number
          retry_policy?: Json
          rrule?: string
          time_of_day?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_schedules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_schedules_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_subscriptions: {
        Row: {
          account_id: string
          billing_interval: string | null
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          account_id: string
          billing_interval?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          account_id?: string
          billing_interval?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "ultaura_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_trusted_contacts: {
        Row: {
          account_id: string
          created_at: string
          enabled: boolean
          id: string
          line_id: string
          name: string
          notify_on: string[]
          phone_e164: string
          relationship: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          line_id: string
          name: string
          notify_on?: string[]
          phone_e164: string
          relationship?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          line_id?: string
          name?: string
          notify_on?: string[]
          phone_e164?: string
          relationship?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_trusted_contacts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_trusted_contacts_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          onboarded: boolean
          photo_url: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          onboarded: boolean
          photo_url?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          onboarded?: boolean
          photo_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite_to_organization: {
        Args: { invite_code: string; invite_user_id: string }
        Returns: Json
      }
      assert_service_role: { Args: never; Returns: undefined }
      can_access_ultaura_account: {
        Args: { account_id: string }
        Returns: boolean
      }
      can_update_user_role:
        | { Args: { membership_id: number }; Returns: boolean }
        | {
            Args: { membership_id: number; organization_id: number }
            Returns: boolean
          }
      create_new_organization: {
        Args: { create_user?: boolean; org_name: string }
        Returns: string
      }
      create_ultaura_account: {
        Args: {
          p_billing_email: string
          p_name: string
          p_organization_id: number
          p_user_id: string
        }
        Returns: string
      }
      current_user_is_member_of_organization: {
        Args: { organization_id: number }
        Returns: boolean
      }
      get_organizations_for_authenticated_user: {
        Args: never
        Returns: number[]
      }
      get_role_for_authenticated_user: {
        Args: { org_id: number }
        Returns: number
      }
      get_role_for_user: { Args: { membership_id: number }; Returns: number }
      get_ultaura_accounts_for_user: { Args: never; Returns: string[] }
      get_ultaura_minutes_remaining: {
        Args: { p_account_id: string }
        Returns: number
      }
      get_ultaura_usage_summary: {
        Args: { p_account_id: string }
        Returns: {
          cycle_end: string
          cycle_start: string
          minutes_included: number
          minutes_remaining: number
          minutes_used: number
          overage_minutes: number
        }[]
      }
      is_ultaura_trial_active: {
        Args: { p_account_id: string }
        Returns: boolean
      }
      match_documents: {
        Args: { filter?: Json; match_count?: number; query_embedding: string }
        Returns: {
          content: string
          embedding: Json
          id: number
          metadata: Json
          similarity: number
        }[]
      }
      match_feedback_submissions: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: number
          similarity: number
        }[]
      }
      transfer_organization: {
        Args: { org_id: number; target_user_membership_id: number }
        Returns: undefined
      }
      update_ultaura_account_usage: {
        Args: { p_account_id: string }
        Returns: undefined
      }
    }
    Enums: {
      feedback_type: "question" | "bug" | "feedback"
      subscription_status:
        | "active"
        | "trialing"
        | "past_due"
        | "canceled"
        | "unpaid"
        | "incomplete"
        | "incomplete_expired"
        | "paused"
      ultaura_account_status: "trial" | "active" | "past_due" | "canceled"
      ultaura_billable_type: "trial" | "included" | "overage" | "payg"
      ultaura_call_direction: "inbound" | "outbound"
      ultaura_call_end_reason:
        | "hangup"
        | "no_answer"
        | "busy"
        | "trial_cap"
        | "minutes_cap"
        | "error"
      ultaura_call_status:
        | "created"
        | "ringing"
        | "in_progress"
        | "completed"
        | "failed"
        | "canceled"
      ultaura_consent_type:
        | "outbound_calls"
        | "trusted_contact_notify"
        | "sms_to_payer"
        | "data_retention"
      ultaura_line_status: "active" | "paused" | "disabled"
      ultaura_memory_type:
        | "fact"
        | "preference"
        | "follow_up"
        | "context"
        | "history"
        | "wellbeing"
      ultaura_opt_out_channel: "outbound_calls" | "sms" | "all"
      ultaura_privacy_scope: "line_only" | "shareable_with_payer"
      ultaura_reminder_status: "scheduled" | "sent" | "missed" | "canceled"
      ultaura_safety_tier: "low" | "medium" | "high"
      ultaura_schedule_result:
        | "success"
        | "missed"
        | "suppressed_quiet_hours"
        | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      iceberg_namespaces: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      iceberg_tables: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          location: string
          name: string
          namespace_id: string
          remote_table_id: string | null
          shard_id: string | null
          shard_key: string | null
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          location: string
          name: string
          namespace_id: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          namespace_id?: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "iceberg_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          level: number | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          level?: number | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          level?: number | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      prefixes: {
        Row: {
          bucket_id: string
          created_at: string | null
          level: number
          name: string
          updated_at: string | null
        }
        Insert: {
          bucket_id: string
          created_at?: string | null
          level?: number
          name: string
          updated_at?: string | null
        }
        Update: {
          bucket_id?: string
          created_at?: string | null
          level?: number
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prefixes_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_prefixes: {
        Args: { _bucket_id: string; _name: string }
        Returns: undefined
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      delete_leaf_prefixes: {
        Args: { bucket_ids: string[]; names: string[] }
        Returns: undefined
      }
      delete_prefix: {
        Args: { _bucket_id: string; _name: string }
        Returns: boolean
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_level: { Args: { name: string }; Returns: number }
      get_prefix: { Args: { name: string }; Returns: string }
      get_prefixes: { Args: { name: string }; Returns: string[] }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          start_after?: string
        }
        Returns: {
          id: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      lock_top_prefixes: {
        Args: { bucket_ids: string[]; names: string[] }
        Returns: undefined
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_legacy_v1: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v1_optimised: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      feedback_type: ["question", "bug", "feedback"],
      subscription_status: [
        "active",
        "trialing",
        "past_due",
        "canceled",
        "unpaid",
        "incomplete",
        "incomplete_expired",
        "paused",
      ],
      ultaura_account_status: ["trial", "active", "past_due", "canceled"],
      ultaura_billable_type: ["trial", "included", "overage", "payg"],
      ultaura_call_direction: ["inbound", "outbound"],
      ultaura_call_end_reason: [
        "hangup",
        "no_answer",
        "busy",
        "trial_cap",
        "minutes_cap",
        "error",
      ],
      ultaura_call_status: [
        "created",
        "ringing",
        "in_progress",
        "completed",
        "failed",
        "canceled",
      ],
      ultaura_consent_type: [
        "outbound_calls",
        "trusted_contact_notify",
        "sms_to_payer",
        "data_retention",
      ],
      ultaura_line_status: ["active", "paused", "disabled"],
      ultaura_memory_type: [
        "fact",
        "preference",
        "follow_up",
        "context",
        "history",
        "wellbeing",
      ],
      ultaura_opt_out_channel: ["outbound_calls", "sms", "all"],
      ultaura_privacy_scope: ["line_only", "shareable_with_payer"],
      ultaura_reminder_status: ["scheduled", "sent", "missed", "canceled"],
      ultaura_safety_tier: ["low", "medium", "high"],
      ultaura_schedule_result: [
        "success",
        "missed",
        "suppressed_quiet_hours",
        "failed",
      ],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const

