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
      ultaura_accessibility_settings: {
        Row: {
          cognitive_mode: string | null
          cognitive_mode_source: string | null
          context_window_calls: number | null
          hearing_mode: string | null
          hearing_mode_source: string | null
          id: string
          line_id: string
          pause_between_sentences: boolean | null
          provide_call_recap: boolean | null
          remind_of_previous_topics: boolean | null
          repeat_key_info: boolean | null
          shorter_responses: boolean | null
          simplified_language: boolean | null
          speech_rate: number | null
          updated_at: string
        }
        Insert: {
          cognitive_mode?: string | null
          cognitive_mode_source?: string | null
          context_window_calls?: number | null
          hearing_mode?: string | null
          hearing_mode_source?: string | null
          id?: string
          line_id: string
          pause_between_sentences?: boolean | null
          provide_call_recap?: boolean | null
          remind_of_previous_topics?: boolean | null
          repeat_key_info?: boolean | null
          shorter_responses?: boolean | null
          simplified_language?: boolean | null
          speech_rate?: number | null
          updated_at?: string
        }
        Update: {
          cognitive_mode?: string | null
          cognitive_mode_source?: string | null
          context_window_calls?: number | null
          hearing_mode?: string | null
          hearing_mode_source?: string | null
          id?: string
          line_id?: string
          pause_between_sentences?: boolean | null
          provide_call_recap?: boolean | null
          remind_of_previous_topics?: boolean | null
          repeat_key_info?: boolean | null
          shorter_responses?: boolean | null
          simplified_language?: boolean | null
          speech_rate?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_accessibility_settings_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: true
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
        ]
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
      ultaura_account_privacy_settings: {
        Row: {
          account_id: string
          ai_summarization_enabled: boolean
          created_at: string
          id: string
          recording_enabled: boolean
          retention_period: Database["public"]["Enums"]["ultaura_retention_period"]
          updated_at: string
          vendor_disclosure_acknowledged_at: string | null
          vendor_disclosure_acknowledged_by: string | null
        }
        Insert: {
          account_id: string
          ai_summarization_enabled?: boolean
          created_at?: string
          id?: string
          recording_enabled?: boolean
          retention_period?: Database["public"]["Enums"]["ultaura_retention_period"]
          updated_at?: string
          vendor_disclosure_acknowledged_at?: string | null
          vendor_disclosure_acknowledged_by?: string | null
        }
        Update: {
          account_id?: string
          ai_summarization_enabled?: boolean
          created_at?: string
          id?: string
          recording_enabled?: boolean
          retention_period?: Database["public"]["Enums"]["ultaura_retention_period"]
          updated_at?: string
          vendor_disclosure_acknowledged_at?: string | null
          vendor_disclosure_acknowledged_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_account_privacy_setti_vendor_disclosure_acknowledg_fkey"
            columns: ["vendor_disclosure_acknowledged_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_account_privacy_settings_account_id_fkey"
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
          sharing_enabled: boolean
          sharing_enabled_at: string | null
          status: Database["public"]["Enums"]["ultaura_account_status"]
          trial_ends_at: string | null
          trial_plan_id: string | null
          trial_starts_at: string | null
          user_type: string
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
          sharing_enabled?: boolean
          sharing_enabled_at?: string | null
          status?: Database["public"]["Enums"]["ultaura_account_status"]
          trial_ends_at?: string | null
          trial_plan_id?: string | null
          trial_starts_at?: string | null
          user_type?: string
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
          sharing_enabled?: boolean
          sharing_enabled_at?: string | null
          status?: Database["public"]["Enums"]["ultaura_account_status"]
          trial_ends_at?: string | null
          trial_plan_id?: string | null
          trial_starts_at?: string | null
          user_type?: string
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
      ultaura_call_insights: {
        Row: {
          account_id: string
          call_session_id: string
          created_at: string
          duration_seconds: number | null
          extraction_method: string
          has_baseline: boolean
          has_concerns: boolean
          id: string
          insights_alg: string
          insights_ciphertext: string
          insights_iv: string
          insights_kid: string
          insights_tag: string
          line_id: string
          needs_follow_up: boolean
        }
        Insert: {
          account_id: string
          call_session_id: string
          created_at?: string
          duration_seconds?: number | null
          extraction_method: string
          has_baseline?: boolean
          has_concerns?: boolean
          id?: string
          insights_alg?: string
          insights_ciphertext: string
          insights_iv: string
          insights_kid?: string
          insights_tag: string
          line_id: string
          needs_follow_up?: boolean
        }
        Update: {
          account_id?: string
          call_session_id?: string
          created_at?: string
          duration_seconds?: number | null
          extraction_method?: string
          has_baseline?: boolean
          has_concerns?: boolean
          id?: string
          insights_alg?: string
          insights_ciphertext?: string
          insights_iv?: string
          insights_kid?: string
          insights_tag?: string
          line_id?: string
          needs_follow_up?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_call_insights_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_call_insights_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: true
            referencedRelation: "ultaura_call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_call_insights_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_call_previews: {
        Row: {
          account_id: string
          created_at: string
          follow_through_response: string | null
          followed_through: boolean | null
          id: string
          line_id: string
          offered_at: string
          segment_context: Json | null
          segment_type: string | null
          selected_at: string | null
          source_memory_ids: string[] | null
          status: string
          topic_display: string
          topic_key: string
          topic_type: string
          used_at: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          follow_through_response?: string | null
          followed_through?: boolean | null
          id?: string
          line_id: string
          offered_at: string
          segment_context?: Json | null
          segment_type?: string | null
          selected_at?: string | null
          source_memory_ids?: string[] | null
          status?: string
          topic_display: string
          topic_key: string
          topic_type: string
          used_at?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          follow_through_response?: string | null
          followed_through?: boolean | null
          id?: string
          line_id?: string
          offered_at?: string
          segment_context?: Json | null
          segment_type?: string | null
          selected_at?: string | null
          source_memory_ids?: string[] | null
          status?: string
          topic_display?: string
          topic_key?: string
          topic_type?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_call_previews_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_call_previews_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_call_sessions: {
        Row: {
          account_id: string
          answered_by: string | null
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
          is_preview_mode: boolean
          is_reminder_call: boolean
          is_test_call: boolean
          language_detected: string | null
          line_id: string
          recording_deleted_at: string | null
          recording_deletion_reason: string | null
          recording_sid: string | null
          reminder_id: string | null
          reminder_message: string | null
          scheduler_idempotency_key: string | null
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
          answered_by?: string | null
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
          is_preview_mode?: boolean
          is_reminder_call?: boolean
          is_test_call?: boolean
          language_detected?: string | null
          line_id: string
          recording_deleted_at?: string | null
          recording_deletion_reason?: string | null
          recording_sid?: string | null
          reminder_id?: string | null
          reminder_message?: string | null
          scheduler_idempotency_key?: string | null
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
          answered_by?: string | null
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
          is_preview_mode?: boolean
          is_reminder_call?: boolean
          is_test_call?: boolean
          language_detected?: string | null
          line_id?: string
          recording_deleted_at?: string | null
          recording_deletion_reason?: string | null
          recording_sid?: string | null
          reminder_id?: string | null
          reminder_message?: string | null
          scheduler_idempotency_key?: string | null
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
      ultaura_cognitive_flags: {
        Row: {
          concern_level: string | null
          confusion_count_14d: number | null
          consecutive_calls_with_concern: number | null
          family_notified_at: string | null
          flagged_at: string | null
          id: string
          last_concern_at: string | null
          line_id: string
          orientation_count_14d: number | null
          repetition_count_14d: number | null
          updated_at: string
        }
        Insert: {
          concern_level?: string | null
          confusion_count_14d?: number | null
          consecutive_calls_with_concern?: number | null
          family_notified_at?: string | null
          flagged_at?: string | null
          id?: string
          last_concern_at?: string | null
          line_id: string
          orientation_count_14d?: number | null
          repetition_count_14d?: number | null
          updated_at?: string
        }
        Update: {
          concern_level?: string | null
          confusion_count_14d?: number | null
          consecutive_calls_with_concern?: number | null
          family_notified_at?: string | null
          flagged_at?: string | null
          id?: string
          last_concern_at?: string | null
          line_id?: string
          orientation_count_14d?: number | null
          repetition_count_14d?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_cognitive_flags_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: true
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_cognitive_observations: {
        Row: {
          call_session_id: string
          context: string | null
          created_at: string
          id: string
          is_novel: boolean | null
          line_id: string
          observation_type: string
          response_given: string | null
          severity: string | null
          similar_observation_count: number | null
        }
        Insert: {
          call_session_id: string
          context?: string | null
          created_at?: string
          id?: string
          is_novel?: boolean | null
          line_id: string
          observation_type: string
          response_given?: string | null
          severity?: string | null
          similar_observation_count?: number | null
        }
        Update: {
          call_session_id?: string
          context?: string | null
          created_at?: string
          id?: string
          is_novel?: boolean | null
          line_id?: string
          observation_type?: string
          response_given?: string | null
          severity?: string | null
          similar_observation_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_cognitive_observations_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "ultaura_call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_cognitive_observations_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_consent_audit_log: {
        Row: {
          account_id: string
          action: Database["public"]["Enums"]["ultaura_consent_audit_action"]
          actor_type: string
          actor_user_id: string | null
          call_session_id: string | null
          consent_type: string | null
          created_at: string
          id: string
          ip_address: unknown
          line_id: string | null
          metadata: Json | null
          new_value: Json | null
          old_value: Json | null
          user_agent: string | null
        }
        Insert: {
          account_id: string
          action: Database["public"]["Enums"]["ultaura_consent_audit_action"]
          actor_type: string
          actor_user_id?: string | null
          call_session_id?: string | null
          consent_type?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          line_id?: string | null
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
          user_agent?: string | null
        }
        Update: {
          account_id?: string
          action?: Database["public"]["Enums"]["ultaura_consent_audit_action"]
          actor_type?: string
          actor_user_id?: string | null
          call_session_id?: string | null
          consent_type?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          line_id?: string | null
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_consent_audit_log_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_consent_audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_consent_audit_log_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "ultaura_call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_consent_audit_log_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "ultaura_lines"
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
      ultaura_content_preferences: {
        Row: {
          avoided_story_themes: string[] | null
          avoided_trivia_domains: string[] | null
          best_segment_time_of_call: string | null
          brain_games_preference: number | null
          favorite_eras: string[] | null
          favorite_memory_topics: string[] | null
          favorite_story_genres: string[] | null
          favorite_trivia_domains: string[] | null
          id: string
          line_id: string
          memory_lane_preference: number | null
          preferred_story_length: string | null
          story_preference: number | null
          trivia_difficulty: string | null
          trivia_preference: number | null
          updated_at: string
        }
        Insert: {
          avoided_story_themes?: string[] | null
          avoided_trivia_domains?: string[] | null
          best_segment_time_of_call?: string | null
          brain_games_preference?: number | null
          favorite_eras?: string[] | null
          favorite_memory_topics?: string[] | null
          favorite_story_genres?: string[] | null
          favorite_trivia_domains?: string[] | null
          id?: string
          line_id: string
          memory_lane_preference?: number | null
          preferred_story_length?: string | null
          story_preference?: number | null
          trivia_difficulty?: string | null
          trivia_preference?: number | null
          updated_at?: string
        }
        Update: {
          avoided_story_themes?: string[] | null
          avoided_trivia_domains?: string[] | null
          best_segment_time_of_call?: string | null
          brain_games_preference?: number | null
          favorite_eras?: string[] | null
          favorite_memory_topics?: string[] | null
          favorite_story_genres?: string[] | null
          favorite_trivia_domains?: string[] | null
          id?: string
          line_id?: string
          memory_lane_preference?: number | null
          preferred_story_length?: string | null
          story_preference?: number | null
          trivia_difficulty?: string | null
          trivia_preference?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_content_preferences_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: true
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_daily_rhythms: {
        Row: {
          afternoon_energy: string | null
          afternoon_routine_summary: string | null
          avg_duration_by_time: Json | null
          avoid_days_of_week: number[] | null
          best_days_of_week: number[] | null
          best_engagement_time: string | null
          evening_energy: string | null
          evening_routine_summary: string | null
          id: string
          line_id: string
          morning_energy: string | null
          morning_routine_summary: string | null
          updated_at: string
          worst_engagement_time: string | null
        }
        Insert: {
          afternoon_energy?: string | null
          afternoon_routine_summary?: string | null
          avg_duration_by_time?: Json | null
          avoid_days_of_week?: number[] | null
          best_days_of_week?: number[] | null
          best_engagement_time?: string | null
          evening_energy?: string | null
          evening_routine_summary?: string | null
          id?: string
          line_id: string
          morning_energy?: string | null
          morning_routine_summary?: string | null
          updated_at?: string
          worst_engagement_time?: string | null
        }
        Update: {
          afternoon_energy?: string | null
          afternoon_routine_summary?: string | null
          avg_duration_by_time?: Json | null
          avoid_days_of_week?: number[] | null
          best_days_of_week?: number[] | null
          best_engagement_time?: string | null
          evening_energy?: string | null
          evening_routine_summary?: string | null
          id?: string
          line_id?: string
          morning_energy?: string | null
          morning_routine_summary?: string | null
          updated_at?: string
          worst_engagement_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_daily_rhythms_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: true
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_data_export_requests: {
        Row: {
          account_id: string
          created_at: string
          download_url: string | null
          error_message: string | null
          expires_at: string | null
          file_size_bytes: number | null
          format: Database["public"]["Enums"]["ultaura_export_format"]
          id: string
          include_call_metadata: boolean
          include_memories: boolean
          include_reminders: boolean
          processed_at: string | null
          requested_by: string
          status: Database["public"]["Enums"]["ultaura_export_status"]
        }
        Insert: {
          account_id: string
          created_at?: string
          download_url?: string | null
          error_message?: string | null
          expires_at?: string | null
          file_size_bytes?: number | null
          format?: Database["public"]["Enums"]["ultaura_export_format"]
          id?: string
          include_call_metadata?: boolean
          include_memories?: boolean
          include_reminders?: boolean
          processed_at?: string | null
          requested_by: string
          status?: Database["public"]["Enums"]["ultaura_export_status"]
        }
        Update: {
          account_id?: string
          created_at?: string
          download_url?: string | null
          error_message?: string | null
          expires_at?: string | null
          file_size_bytes?: number | null
          format?: Database["public"]["Enums"]["ultaura_export_format"]
          id?: string
          include_call_metadata?: boolean
          include_memories?: boolean
          include_reminders?: boolean
          processed_at?: string | null
          requested_by?: string
          status?: Database["public"]["Enums"]["ultaura_export_status"]
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_data_export_requests_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_data_export_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_debug_logs: {
        Row: {
          account_id: string | null
          call_session_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          payload: Json
          tool_name: string | null
        }
        Insert: {
          account_id?: string | null
          call_session_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          payload: Json
          tool_name?: string | null
        }
        Update: {
          account_id?: string | null
          call_session_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          payload?: Json
          tool_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_debug_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_debug_logs_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "ultaura_call_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_emotional_patterns: {
        Row: {
          best_time_of_day: string | null
          dominant_mood: string | null
          effective_techniques: string[] | null
          id: string
          ineffective_techniques: string[] | null
          line_id: string
          mood_variability: string | null
          negative_triggers: string[] | null
          positive_triggers: string[] | null
          updated_at: string
          worst_time_of_day: string | null
        }
        Insert: {
          best_time_of_day?: string | null
          dominant_mood?: string | null
          effective_techniques?: string[] | null
          id?: string
          ineffective_techniques?: string[] | null
          line_id: string
          mood_variability?: string | null
          negative_triggers?: string[] | null
          positive_triggers?: string[] | null
          updated_at?: string
          worst_time_of_day?: string | null
        }
        Update: {
          best_time_of_day?: string | null
          dominant_mood?: string | null
          effective_techniques?: string[] | null
          id?: string
          ineffective_techniques?: string[] | null
          line_id?: string
          mood_variability?: string | null
          negative_triggers?: string[] | null
          positive_triggers?: string[] | null
          updated_at?: string
          worst_time_of_day?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_emotional_patterns_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: true
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_grief_interactions: {
        Row: {
          call_session_id: string
          created_at: string
          days_since_passing: number | null
          emotional_tone: string | null
          id: string
          interaction_type: string
          line_id: string
          relationship_id: string | null
          support_techniques_used: string[] | null
        }
        Insert: {
          call_session_id: string
          created_at?: string
          days_since_passing?: number | null
          emotional_tone?: string | null
          id?: string
          interaction_type: string
          line_id: string
          relationship_id?: string | null
          support_techniques_used?: string[] | null
        }
        Update: {
          call_session_id?: string
          created_at?: string
          days_since_passing?: number | null
          emotional_tone?: string | null
          id?: string
          interaction_type?: string
          line_id?: string
          relationship_id?: string | null
          support_techniques_used?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_grief_interactions_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "ultaura_call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_grief_interactions_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_grief_interactions_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "ultaura_relationships"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_health_mentions: {
        Row: {
          account_id: string
          alert_sent_at: string | null
          call_session_id: string
          category: string
          created_at: string
          id: string
          line_id: string
          mention_alg: string
          mention_ciphertext: string
          mention_iv: string
          mention_kid: string
          mention_tag: string
          severity: string | null
          triggers_alert: boolean | null
        }
        Insert: {
          account_id: string
          alert_sent_at?: string | null
          call_session_id: string
          category: string
          created_at?: string
          id?: string
          line_id: string
          mention_alg?: string
          mention_ciphertext: string
          mention_iv: string
          mention_kid?: string
          mention_tag: string
          severity?: string | null
          triggers_alert?: boolean | null
        }
        Update: {
          account_id?: string
          alert_sent_at?: string | null
          call_session_id?: string
          category?: string
          created_at?: string
          id?: string
          line_id?: string
          mention_alg?: string
          mention_ciphertext?: string
          mention_iv?: string
          mention_kid?: string
          mention_tag?: string
          severity?: string | null
          triggers_alert?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_health_mentions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_health_mentions_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "ultaura_call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_health_mentions_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_insight_privacy: {
        Row: {
          created_at: string
          id: string
          insights_enabled: boolean
          is_paused: boolean
          line_id: string
          paused_at: string | null
          paused_reason: string | null
          private_topic_codes: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          insights_enabled?: boolean
          is_paused?: boolean
          line_id: string
          paused_at?: string | null
          paused_reason?: string | null
          private_topic_codes?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          insights_enabled?: boolean
          is_paused?: boolean
          line_id?: string
          paused_at?: string | null
          paused_reason?: string | null
          private_topic_codes?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_insight_privacy_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_life_chapters: {
        Row: {
          account_id: string
          chapter_type: string
          connects_to_chapter_ids: string[] | null
          created_at: string
          emotional_tone: string | null
          era_end_year: number | null
          era_start_year: number | null
          id: string
          key_people: string[] | null
          last_referenced_at: string | null
          line_id: string
          location: string | null
          narrative_alg: string
          narrative_ciphertext: string
          narrative_iv: string
          narrative_kid: string
          narrative_tag: string
          source: string
          times_referenced: number
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          chapter_type: string
          connects_to_chapter_ids?: string[] | null
          created_at?: string
          emotional_tone?: string | null
          era_end_year?: number | null
          era_start_year?: number | null
          id?: string
          key_people?: string[] | null
          last_referenced_at?: string | null
          line_id: string
          location?: string | null
          narrative_alg?: string
          narrative_ciphertext: string
          narrative_iv: string
          narrative_kid?: string
          narrative_tag: string
          source?: string
          times_referenced?: number
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          chapter_type?: string
          connects_to_chapter_ids?: string[] | null
          created_at?: string
          emotional_tone?: string | null
          era_end_year?: number | null
          era_start_year?: number | null
          id?: string
          key_people?: string[] | null
          last_referenced_at?: string | null
          line_id?: string
          location?: string | null
          narrative_alg?: string
          narrative_ciphertext?: string
          narrative_iv?: string
          narrative_kid?: string
          narrative_tag?: string
          source?: string
          times_referenced?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_life_chapters_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_life_chapters_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_line_baselines: {
        Row: {
          answer_rate: number | null
          avg_duration_seconds: number | null
          avg_engagement: number | null
          baseline_call_count: number
          calls_per_week: number | null
          line_id: string
          mood_distribution: Json
          recent_concern_codes: string[]
          updated_at: string
        }
        Insert: {
          answer_rate?: number | null
          avg_duration_seconds?: number | null
          avg_engagement?: number | null
          baseline_call_count?: number
          calls_per_week?: number | null
          line_id: string
          mood_distribution?: Json
          recent_concern_codes?: string[]
          updated_at?: string
        }
        Update: {
          answer_rate?: number | null
          avg_duration_seconds?: number | null
          avg_engagement?: number | null
          baseline_call_count?: number
          calls_per_week?: number | null
          line_id?: string
          mood_distribution?: Json
          recent_concern_codes?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_line_baselines_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: true
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_line_crypto_keys: {
        Row: {
          account_id: string
          created_at: string
          dek_alg: string
          dek_kid: string
          dek_wrap_iv: string
          dek_wrap_tag: string
          dek_wrapped: string
          id: string
          line_id: string
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
          line_id: string
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
          line_id?: string
          rotated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_line_crypto_keys_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_line_crypto_keys_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: true
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_line_voice_consent: {
        Row: {
          account_id: string
          created_at: string
          id: string
          last_consent_prompt_at: string | null
          line_id: string
          memory_consent: Database["public"]["Enums"]["ultaura_voice_consent_status"]
          memory_consent_at: string | null
          memory_consent_call_session_id: string | null
          onboarding_completed_at: string | null
          recording_consent: Database["public"]["Enums"]["ultaura_voice_consent_status"]
          recording_consent_at: string | null
          recording_consent_call_session_id: string | null
          recording_preference_permanent: boolean
          recording_reenable_requested_at: string | null
          sharing_consent: Database["public"]["Enums"]["ultaura_voice_consent_status"]
          sharing_consent_at: string | null
          sharing_consent_call_session_id: string | null
          sharing_last_prompt_at: string | null
          sharing_reprompt_requested_at: string | null
          sharing_tier: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          last_consent_prompt_at?: string | null
          line_id: string
          memory_consent?: Database["public"]["Enums"]["ultaura_voice_consent_status"]
          memory_consent_at?: string | null
          memory_consent_call_session_id?: string | null
          onboarding_completed_at?: string | null
          recording_consent?: Database["public"]["Enums"]["ultaura_voice_consent_status"]
          recording_consent_at?: string | null
          recording_consent_call_session_id?: string | null
          recording_preference_permanent?: boolean
          recording_reenable_requested_at?: string | null
          sharing_consent?: Database["public"]["Enums"]["ultaura_voice_consent_status"]
          sharing_consent_at?: string | null
          sharing_consent_call_session_id?: string | null
          sharing_last_prompt_at?: string | null
          sharing_reprompt_requested_at?: string | null
          sharing_tier?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          last_consent_prompt_at?: string | null
          line_id?: string
          memory_consent?: Database["public"]["Enums"]["ultaura_voice_consent_status"]
          memory_consent_at?: string | null
          memory_consent_call_session_id?: string | null
          onboarding_completed_at?: string | null
          recording_consent?: Database["public"]["Enums"]["ultaura_voice_consent_status"]
          recording_consent_at?: string | null
          recording_consent_call_session_id?: string | null
          recording_preference_permanent?: boolean
          recording_reenable_requested_at?: string | null
          sharing_consent?: Database["public"]["Enums"]["ultaura_voice_consent_status"]
          sharing_consent_at?: string | null
          sharing_consent_call_session_id?: string | null
          sharing_last_prompt_at?: string | null
          sharing_reprompt_requested_at?: string | null
          sharing_tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_line_voice_consent_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_line_voice_consent_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: true
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_line_voice_consent_memory_consent_call_session_id_fkey"
            columns: ["memory_consent_call_session_id"]
            isOneToOne: false
            referencedRelation: "ultaura_call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_line_voice_consent_recording_consent_call_session__fkey"
            columns: ["recording_consent_call_session_id"]
            isOneToOne: false
            referencedRelation: "ultaura_call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_line_voice_consent_sharing_consent_call_session_id_fkey"
            columns: ["sharing_consent_call_session_id"]
            isOneToOne: false
            referencedRelation: "ultaura_call_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_lines: {
        Row: {
          account_id: string
          allow_voice_reminder_control: boolean
          allow_voice_schedule_control: boolean
          birth_decade: number | null
          birth_year: number | null
          consecutive_missed_calls: number
          created_at: string
          crosstalk_recovery_mode: string | null
          current_location: string | null
          display_name: string
          do_not_call: boolean
          filler_word_patience: string | null
          formative_decade: number | null
          hometown: string | null
          id: string
          inbound_allowed: boolean
          interruption_tolerance: string | null
          last_answered_call_at: string | null
          last_successful_call_at: string | null
          last_weekly_summary_at: string | null
          missed_alert_sent_at: string | null
          next_scheduled_call_at: string | null
          optimal_call_days: number[] | null
          optimal_call_time: string | null
          optimal_call_time_source: string | null
          phone_e164: string
          phone_verified_at: string | null
          preferred_language_bcp47: string | null
          preferred_language_iso: string | null
          quiet_hours_end: string
          quiet_hours_start: string
          seed_avoid_topics: string[] | null
          seed_interests: string[] | null
          short_id: string
          silence_tolerance_ms: number | null
          status: Database["public"]["Enums"]["ultaura_line_status"]
          timezone: string
          vacation_ranges: Json
          voicemail_behavior: string
        }
        Insert: {
          account_id: string
          allow_voice_reminder_control?: boolean
          allow_voice_schedule_control?: boolean
          birth_decade?: number | null
          birth_year?: number | null
          consecutive_missed_calls?: number
          created_at?: string
          crosstalk_recovery_mode?: string | null
          current_location?: string | null
          display_name: string
          do_not_call?: boolean
          filler_word_patience?: string | null
          formative_decade?: number | null
          hometown?: string | null
          id?: string
          inbound_allowed?: boolean
          interruption_tolerance?: string | null
          last_answered_call_at?: string | null
          last_successful_call_at?: string | null
          last_weekly_summary_at?: string | null
          missed_alert_sent_at?: string | null
          next_scheduled_call_at?: string | null
          optimal_call_days?: number[] | null
          optimal_call_time?: string | null
          optimal_call_time_source?: string | null
          phone_e164: string
          phone_verified_at?: string | null
          preferred_language_bcp47?: string | null
          preferred_language_iso?: string | null
          quiet_hours_end?: string
          quiet_hours_start?: string
          seed_avoid_topics?: string[] | null
          seed_interests?: string[] | null
          short_id: string
          silence_tolerance_ms?: number | null
          status?: Database["public"]["Enums"]["ultaura_line_status"]
          timezone?: string
          vacation_ranges?: Json
          voicemail_behavior?: string
        }
        Update: {
          account_id?: string
          allow_voice_reminder_control?: boolean
          allow_voice_schedule_control?: boolean
          birth_decade?: number | null
          birth_year?: number | null
          consecutive_missed_calls?: number
          created_at?: string
          crosstalk_recovery_mode?: string | null
          current_location?: string | null
          display_name?: string
          do_not_call?: boolean
          filler_word_patience?: string | null
          formative_decade?: number | null
          hometown?: string | null
          id?: string
          inbound_allowed?: boolean
          interruption_tolerance?: string | null
          last_answered_call_at?: string | null
          last_successful_call_at?: string | null
          last_weekly_summary_at?: string | null
          missed_alert_sent_at?: string | null
          next_scheduled_call_at?: string | null
          optimal_call_days?: number[] | null
          optimal_call_time?: string | null
          optimal_call_time_source?: string | null
          phone_e164?: string
          phone_verified_at?: string | null
          preferred_language_bcp47?: string | null
          preferred_language_iso?: string | null
          quiet_hours_end?: string
          quiet_hours_start?: string
          seed_avoid_topics?: string[] | null
          seed_interests?: string[] | null
          short_id?: string
          silence_tolerance_ms?: number | null
          status?: Database["public"]["Enums"]["ultaura_line_status"]
          timezone?: string
          vacation_ranges?: Json
          voicemail_behavior?: string
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
          access_count: number
          account_id: string
          active: boolean
          confidence: number | null
          created_at: string
          created_in_call_session_id: string | null
          embedding_pending: boolean
          excluded_category:
            | Database["public"]["Enums"]["ultaura_exclusion_category"]
            | null
          expected_end_date: string | null
          expiry_pending: boolean
          id: string
          key: string
          last_accessed_at: string | null
          line_id: string
          pinned: boolean
          pinned_reason: string | null
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
          access_count?: number
          account_id: string
          active?: boolean
          confidence?: number | null
          created_at?: string
          created_in_call_session_id?: string | null
          embedding_pending?: boolean
          excluded_category?:
            | Database["public"]["Enums"]["ultaura_exclusion_category"]
            | null
          expected_end_date?: string | null
          expiry_pending?: boolean
          id?: string
          key: string
          last_accessed_at?: string | null
          line_id: string
          pinned?: boolean
          pinned_reason?: string | null
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
          access_count?: number
          account_id?: string
          active?: boolean
          confidence?: number | null
          created_at?: string
          created_in_call_session_id?: string | null
          embedding_pending?: boolean
          excluded_category?:
            | Database["public"]["Enums"]["ultaura_exclusion_category"]
            | null
          expected_end_date?: string | null
          expiry_pending?: boolean
          id?: string
          key?: string
          last_accessed_at?: string | null
          line_id?: string
          pinned?: boolean
          pinned_reason?: string | null
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
            foreignKeyName: "ultaura_memories_created_in_call_session_id_fkey"
            columns: ["created_in_call_session_id"]
            isOneToOne: false
            referencedRelation: "ultaura_call_sessions"
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
      ultaura_memory_deactivation_log: {
        Row: {
          account_id: string
          call_session_id: string | null
          confidence_at_deactivation: number | null
          created_at: string
          id: string
          line_id: string
          memory_id: string
          memory_key: string
          metadata: Json | null
          reason: Database["public"]["Enums"]["ultaura_deactivation_reason"]
          restored_at: string | null
          restored_call_session_id: string | null
          restored_reason: string | null
        }
        Insert: {
          account_id: string
          call_session_id?: string | null
          confidence_at_deactivation?: number | null
          created_at?: string
          id?: string
          line_id: string
          memory_id: string
          memory_key: string
          metadata?: Json | null
          reason: Database["public"]["Enums"]["ultaura_deactivation_reason"]
          restored_at?: string | null
          restored_call_session_id?: string | null
          restored_reason?: string | null
        }
        Update: {
          account_id?: string
          call_session_id?: string | null
          confidence_at_deactivation?: number | null
          created_at?: string
          id?: string
          line_id?: string
          memory_id?: string
          memory_key?: string
          metadata?: Json | null
          reason?: Database["public"]["Enums"]["ultaura_deactivation_reason"]
          restored_at?: string | null
          restored_call_session_id?: string | null
          restored_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_memory_deactivation_log_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_memory_deactivation_log_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "ultaura_call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_memory_deactivation_log_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_memory_deactivation_log_restored_call_session_id_fkey"
            columns: ["restored_call_session_id"]
            isOneToOne: false
            referencedRelation: "ultaura_call_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_memory_embeddings: {
        Row: {
          account_id: string
          created_at: string
          embedding: string
          embedding_created_at: string
          embedding_model: string
          id: string
          line_id: string
          memory_id: string
          searchable_text: string
        }
        Insert: {
          account_id: string
          created_at?: string
          embedding: string
          embedding_created_at?: string
          embedding_model?: string
          id?: string
          line_id: string
          memory_id: string
          searchable_text: string
        }
        Update: {
          account_id?: string
          created_at?: string
          embedding?: string
          embedding_created_at?: string
          embedding_model?: string
          id?: string
          line_id?: string
          memory_id?: string
          searchable_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_memory_embeddings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_memory_embeddings_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_memory_embeddings_memory_id_fkey"
            columns: ["memory_id"]
            isOneToOne: true
            referencedRelation: "ultaura_memories"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_milestones: {
        Row: {
          account_id: string
          created_at: string
          date_day: number
          date_month: number
          date_year: number | null
          description: string | null
          id: string
          is_recurring: boolean
          last_celebrated_at: string | null
          line_id: string
          milestone_type: string
          notify_days_before: number | null
          notify_on_day: boolean | null
          privacy_scope: string | null
          related_person_name: string | null
          related_relationship_id: string | null
          source: string | null
          times_celebrated: number | null
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          date_day: number
          date_month: number
          date_year?: number | null
          description?: string | null
          id?: string
          is_recurring?: boolean
          last_celebrated_at?: string | null
          line_id: string
          milestone_type: string
          notify_days_before?: number | null
          notify_on_day?: boolean | null
          privacy_scope?: string | null
          related_person_name?: string | null
          related_relationship_id?: string | null
          source?: string | null
          times_celebrated?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          date_day?: number
          date_month?: number
          date_year?: number | null
          description?: string | null
          id?: string
          is_recurring?: boolean
          last_celebrated_at?: string | null
          line_id?: string
          milestone_type?: string
          notify_days_before?: number | null
          notify_on_day?: boolean | null
          privacy_scope?: string | null
          related_person_name?: string | null
          related_relationship_id?: string | null
          source?: string | null
          times_celebrated?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_milestones_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_milestones_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_milestones_related_relationship_id_fkey"
            columns: ["related_relationship_id"]
            isOneToOne: false
            referencedRelation: "ultaura_relationships"
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
      ultaura_mood_snapshots: {
        Row: {
          account_id: string
          call_session_id: string
          created_at: string
          energy_level: string | null
          id: string
          line_id: string
          mood_end: string | null
          mood_end_at: string | null
          mood_mid: string | null
          mood_mid_at: string | null
          mood_start: string | null
          mood_start_at: string | null
          mood_trajectory: string | null
          technique_effectiveness: Json | null
          techniques_used: string[] | null
        }
        Insert: {
          account_id: string
          call_session_id: string
          created_at?: string
          energy_level?: string | null
          id?: string
          line_id: string
          mood_end?: string | null
          mood_end_at?: string | null
          mood_mid?: string | null
          mood_mid_at?: string | null
          mood_start?: string | null
          mood_start_at?: string | null
          mood_trajectory?: string | null
          technique_effectiveness?: Json | null
          techniques_used?: string[] | null
        }
        Update: {
          account_id?: string
          call_session_id?: string
          created_at?: string
          energy_level?: string | null
          id?: string
          line_id?: string
          mood_end?: string | null
          mood_end_at?: string | null
          mood_mid?: string | null
          mood_mid_at?: string | null
          mood_start?: string | null
          mood_start_at?: string | null
          mood_trajectory?: string | null
          technique_effectiveness?: Json | null
          techniques_used?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_mood_snapshots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_mood_snapshots_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: true
            referencedRelation: "ultaura_call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_mood_snapshots_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_notification_preferences: {
        Row: {
          account_id: string
          alert_delivery_method: string | null
          alert_missed_calls_enabled: boolean
          alert_missed_calls_threshold: number
          cognitive_concern_alerts: boolean | null
          created_at: string
          health_mention_alerts: boolean | null
          id: string
          line_id: string
          mood_drop_alerts: boolean | null
          updated_at: string
          weekly_summary_day: string
          weekly_summary_enabled: boolean
          weekly_summary_format: string
          weekly_summary_time: string
        }
        Insert: {
          account_id: string
          alert_delivery_method?: string | null
          alert_missed_calls_enabled?: boolean
          alert_missed_calls_threshold?: number
          cognitive_concern_alerts?: boolean | null
          created_at?: string
          health_mention_alerts?: boolean | null
          id?: string
          line_id: string
          mood_drop_alerts?: boolean | null
          updated_at?: string
          weekly_summary_day?: string
          weekly_summary_enabled?: boolean
          weekly_summary_format?: string
          weekly_summary_time?: string
        }
        Update: {
          account_id?: string
          alert_delivery_method?: string | null
          alert_missed_calls_enabled?: boolean
          alert_missed_calls_threshold?: number
          cognitive_concern_alerts?: boolean | null
          created_at?: string
          health_mention_alerts?: boolean | null
          id?: string
          line_id?: string
          mood_drop_alerts?: boolean | null
          updated_at?: string
          weekly_summary_day?: string
          weekly_summary_enabled?: boolean
          weekly_summary_format?: string
          weekly_summary_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_notification_preferences_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_notification_preferences_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_notification_recipients: {
        Row: {
          account_id: string
          confirmation_token_expires_at: string | null
          confirmation_token_hash: string | null
          confirmed_at: string | null
          created_at: string
          email: string
          id: string
          is_trusted_contact: boolean
          name: string
          phone_e164: string | null
          relationship: string | null
          trusted_contact_id: string | null
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          confirmation_token_expires_at?: string | null
          confirmation_token_hash?: string | null
          confirmed_at?: string | null
          created_at?: string
          email: string
          id?: string
          is_trusted_contact?: boolean
          name: string
          phone_e164?: string | null
          relationship?: string | null
          trusted_contact_id?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          confirmation_token_expires_at?: string | null
          confirmation_token_hash?: string | null
          confirmed_at?: string | null
          created_at?: string
          email?: string
          id?: string
          is_trusted_contact?: boolean
          name?: string
          phone_e164?: string | null
          relationship?: string | null
          trusted_contact_id?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_notification_recipients_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_notification_recipients_trusted_contact_id_fkey"
            columns: ["trusted_contact_id"]
            isOneToOne: false
            referencedRelation: "ultaura_trusted_contacts"
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
      ultaura_pending_recording_deletions: {
        Row: {
          account_id: string
          attempts: number
          call_session_id: string | null
          created_at: string
          id: string
          last_attempt_at: string | null
          last_error: string | null
          max_attempts: number
          processed_at: string | null
          reason: string
          recording_sid: string
        }
        Insert: {
          account_id: string
          attempts?: number
          call_session_id?: string | null
          created_at?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          max_attempts?: number
          processed_at?: string | null
          reason: string
          recording_sid: string
        }
        Update: {
          account_id?: string
          attempts?: number
          call_session_id?: string | null
          created_at?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          max_attempts?: number
          processed_at?: string | null
          reason?: string
          recording_sid?: string
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_pending_recording_deletions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_pending_recording_deletions_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "ultaura_call_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_persona_adaptations: {
        Row: {
          afternoon_energy: string | null
          asks_many_questions: boolean | null
          avoided_phrases: string[] | null
          calls_analyzed: number | null
          confidence_score: number | null
          directness_level: string | null
          evening_energy: string | null
          formality_level: string | null
          humor_level: string | null
          id: string
          line_id: string
          morning_energy: string | null
          preferred_phrases: string[] | null
          prefers_short_exchanges: boolean | null
          prefers_stories: boolean | null
          regional_expressions: string[] | null
          typical_energy: string | null
          updated_at: string
          vocabulary_complexity: string | null
        }
        Insert: {
          afternoon_energy?: string | null
          asks_many_questions?: boolean | null
          avoided_phrases?: string[] | null
          calls_analyzed?: number | null
          confidence_score?: number | null
          directness_level?: string | null
          evening_energy?: string | null
          formality_level?: string | null
          humor_level?: string | null
          id?: string
          line_id: string
          morning_energy?: string | null
          preferred_phrases?: string[] | null
          prefers_short_exchanges?: boolean | null
          prefers_stories?: boolean | null
          regional_expressions?: string[] | null
          typical_energy?: string | null
          updated_at?: string
          vocabulary_complexity?: string | null
        }
        Update: {
          afternoon_energy?: string | null
          asks_many_questions?: boolean | null
          avoided_phrases?: string[] | null
          calls_analyzed?: number | null
          confidence_score?: number | null
          directness_level?: string | null
          evening_energy?: string | null
          formality_level?: string | null
          humor_level?: string | null
          id?: string
          line_id?: string
          morning_energy?: string | null
          preferred_phrases?: string[] | null
          prefers_short_exchanges?: boolean | null
          prefers_stories?: boolean | null
          regional_expressions?: string[] | null
          typical_energy?: string | null
          updated_at?: string
          vocabulary_complexity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_persona_adaptations_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: true
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
      ultaura_rate_limit_events: {
        Row: {
          account_id: string | null
          action: string
          call_session_id: string | null
          created_at: string | null
          event_type: string
          id: string
          ip_address: string | null
          limit_type: string | null
          metadata: Json | null
          phone_number: string | null
          redis_available: boolean | null
          remaining: number | null
          was_allowed: boolean
        }
        Insert: {
          account_id?: string | null
          action: string
          call_session_id?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          limit_type?: string | null
          metadata?: Json | null
          phone_number?: string | null
          redis_available?: boolean | null
          remaining?: number | null
          was_allowed: boolean
        }
        Update: {
          account_id?: string | null
          action?: string
          call_session_id?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          limit_type?: string | null
          metadata?: Json | null
          phone_number?: string | null
          redis_available?: boolean | null
          remaining?: number | null
          was_allowed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_rate_limit_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_rate_limit_events_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "ultaura_call_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_relationships: {
        Row: {
          account_id: string
          contact_frequency: string | null
          conversation_topics: string[] | null
          created_at: string
          death_mentioned_at: string | null
          distance_category: string | null
          emotional_significance: string | null
          grief_sensitivity: string | null
          id: string
          is_deceased: boolean | null
          last_contact_mentioned: string | null
          last_mentioned_at: string | null
          line_id: string
          location: string | null
          name: string
          nickname: string | null
          passed_at: string | null
          privacy_scope: string | null
          recent_topics: string[] | null
          relation_role: string
          relation_type: string
          sentiment: string | null
          shared_activities: string[] | null
          times_mentioned: number | null
          typical_contact_method: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          contact_frequency?: string | null
          conversation_topics?: string[] | null
          created_at?: string
          death_mentioned_at?: string | null
          distance_category?: string | null
          emotional_significance?: string | null
          grief_sensitivity?: string | null
          id?: string
          is_deceased?: boolean | null
          last_contact_mentioned?: string | null
          last_mentioned_at?: string | null
          line_id: string
          location?: string | null
          name: string
          nickname?: string | null
          passed_at?: string | null
          privacy_scope?: string | null
          recent_topics?: string[] | null
          relation_role: string
          relation_type: string
          sentiment?: string | null
          shared_activities?: string[] | null
          times_mentioned?: number | null
          typical_contact_method?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          contact_frequency?: string | null
          conversation_topics?: string[] | null
          created_at?: string
          death_mentioned_at?: string | null
          distance_category?: string | null
          emotional_significance?: string | null
          grief_sensitivity?: string | null
          id?: string
          is_deceased?: boolean | null
          last_contact_mentioned?: string | null
          last_mentioned_at?: string | null
          line_id?: string
          location?: string | null
          name?: string
          nickname?: string | null
          passed_at?: string | null
          privacy_scope?: string | null
          recent_topics?: string[] | null
          relation_role?: string
          relation_type?: string
          sentiment?: string | null
          shared_activities?: string[] | null
          times_mentioned?: number | null
          typical_contact_method?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_relationships_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_relationships_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
        ]
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
          processing_claimed_at: string | null
          processing_claimed_by: string | null
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
          processing_claimed_at?: string | null
          processing_claimed_by?: string | null
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
          processing_claimed_at?: string | null
          processing_claimed_by?: string | null
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
          category:
            | Database["public"]["Enums"]["ultaura_safety_category"]
            | null
          confidence: number | null
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
          category?:
            | Database["public"]["Enums"]["ultaura_safety_category"]
            | null
          confidence?: number | null
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
          category?:
            | Database["public"]["Enums"]["ultaura_safety_category"]
            | null
          confidence?: number | null
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
      ultaura_schedule_events: {
        Row: {
          account_id: string
          call_session_id: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["ultaura_schedule_event_type"]
          id: string
          line_id: string
          metadata: Json | null
          schedule_id: string
          triggered_by: Database["public"]["Enums"]["ultaura_schedule_triggered_by"]
        }
        Insert: {
          account_id: string
          call_session_id?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["ultaura_schedule_event_type"]
          id?: string
          line_id: string
          metadata?: Json | null
          schedule_id: string
          triggered_by: Database["public"]["Enums"]["ultaura_schedule_triggered_by"]
        }
        Update: {
          account_id?: string
          call_session_id?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["ultaura_schedule_event_type"]
          id?: string
          line_id?: string
          metadata?: Json | null
          schedule_id?: string
          triggered_by?: Database["public"]["Enums"]["ultaura_schedule_triggered_by"]
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_schedule_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_schedule_events_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "ultaura_call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_schedule_events_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_schedule_events_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "ultaura_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_schedule_exceptions: {
        Row: {
          account_id: string
          call_session_id: string | null
          created_at: string
          created_by: string
          exception_date: string
          exception_type: Database["public"]["Enums"]["ultaura_schedule_exception_type"]
          id: string
          line_id: string
          metadata: Json | null
          new_datetime: string | null
          reschedule_schedule_id: string | null
          schedule_id: string
        }
        Insert: {
          account_id: string
          call_session_id?: string | null
          created_at?: string
          created_by: string
          exception_date: string
          exception_type: Database["public"]["Enums"]["ultaura_schedule_exception_type"]
          id?: string
          line_id: string
          metadata?: Json | null
          new_datetime?: string | null
          reschedule_schedule_id?: string | null
          schedule_id: string
        }
        Update: {
          account_id?: string
          call_session_id?: string | null
          created_at?: string
          created_by?: string
          exception_date?: string
          exception_type?: Database["public"]["Enums"]["ultaura_schedule_exception_type"]
          id?: string
          line_id?: string
          metadata?: Json | null
          new_datetime?: string | null
          reschedule_schedule_id?: string | null
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_schedule_exceptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_schedule_exceptions_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "ultaura_call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_schedule_exceptions_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_schedule_exceptions_reschedule_schedule_id_fkey"
            columns: ["reschedule_schedule_id"]
            isOneToOne: false
            referencedRelation: "ultaura_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_schedule_exceptions_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "ultaura_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_scheduler_leases: {
        Row: {
          acquired_at: string | null
          created_at: string
          expires_at: string | null
          heartbeat_at: string | null
          held_by: string | null
          id: string
        }
        Insert: {
          acquired_at?: string | null
          created_at?: string
          expires_at?: string | null
          heartbeat_at?: string | null
          held_by?: string | null
          id: string
        }
        Update: {
          acquired_at?: string | null
          created_at?: string
          expires_at?: string | null
          heartbeat_at?: string | null
          held_by?: string | null
          id?: string
        }
        Relationships: []
      }
      ultaura_schedules: {
        Row: {
          account_id: string
          created_at: string
          days_of_week: number[]
          enabled: boolean
          id: string
          is_one_time: boolean
          last_result:
            | Database["public"]["Enums"]["ultaura_schedule_result"]
            | null
          last_run_at: string | null
          line_id: string
          next_run_at: string | null
          processing_claimed_at: string | null
          processing_claimed_by: string | null
          retry_count: number
          retry_policy: Json
          time_of_day: string
          timezone: string
        }
        Insert: {
          account_id: string
          created_at?: string
          days_of_week?: number[]
          enabled?: boolean
          id?: string
          is_one_time?: boolean
          last_result?:
            | Database["public"]["Enums"]["ultaura_schedule_result"]
            | null
          last_run_at?: string | null
          line_id: string
          next_run_at?: string | null
          processing_claimed_at?: string | null
          processing_claimed_by?: string | null
          retry_count?: number
          retry_policy?: Json
          time_of_day?: string
          timezone: string
        }
        Update: {
          account_id?: string
          created_at?: string
          days_of_week?: number[]
          enabled?: boolean
          id?: string
          is_one_time?: boolean
          last_result?:
            | Database["public"]["Enums"]["ultaura_schedule_result"]
            | null
          last_run_at?: string | null
          line_id?: string
          next_run_at?: string | null
          processing_claimed_at?: string | null
          processing_claimed_by?: string | null
          retry_count?: number
          retry_policy?: Json
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
      ultaura_segment_engagement: {
        Row: {
          account_id: string
          call_session_id: string
          completed: boolean
          created_at: string
          duration_seconds: number | null
          engagement_signals: Json | null
          id: string
          line_id: string
          segment_context: Json | null
          segment_domain: string | null
          segment_type: string
          senior_response: string | null
        }
        Insert: {
          account_id: string
          call_session_id: string
          completed?: boolean
          created_at?: string
          duration_seconds?: number | null
          engagement_signals?: Json | null
          id?: string
          line_id: string
          segment_context?: Json | null
          segment_domain?: string | null
          segment_type: string
          senior_response?: string | null
        }
        Update: {
          account_id?: string
          call_session_id?: string
          completed?: boolean
          created_at?: string
          duration_seconds?: number | null
          engagement_signals?: Json | null
          id?: string
          line_id?: string
          segment_context?: Json | null
          segment_domain?: string | null
          segment_type?: string
          senior_response?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_segment_engagement_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_segment_engagement_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "ultaura_call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_segment_engagement_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_sms_opt_outs: {
        Row: {
          created_at: string
          id: string
          keyword: string | null
          phone_e164: string
          source: string
        }
        Insert: {
          created_at?: string
          id?: string
          keyword?: string | null
          phone_e164: string
          source: string
        }
        Update: {
          created_at?: string
          id?: string
          keyword?: string | null
          phone_e164?: string
          source?: string
        }
        Relationships: []
      }
      ultaura_story_arcs: {
        Row: {
          account_id: string
          created_at: string
          current_chapter: number
          description: string | null
          engagement_score: number | null
          era_setting: string | null
          id: string
          last_chapter_at: string | null
          line_id: string
          personalization_context: Json | null
          status: string
          story_state: Json
          story_type: string
          themes: string[] | null
          title: string
          total_chapters: number
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          current_chapter?: number
          description?: string | null
          engagement_score?: number | null
          era_setting?: string | null
          id?: string
          last_chapter_at?: string | null
          line_id: string
          personalization_context?: Json | null
          status?: string
          story_state?: Json
          story_type: string
          themes?: string[] | null
          title: string
          total_chapters?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          current_chapter?: number
          description?: string | null
          engagement_score?: number | null
          era_setting?: string | null
          id?: string
          last_chapter_at?: string | null
          line_id?: string
          personalization_context?: Json | null
          status?: string
          story_state?: Json
          story_type?: string
          themes?: string[] | null
          title?: string
          total_chapters?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_story_arcs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_story_arcs_line_id_fkey"
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
      ultaura_system_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      ultaura_topic_exclusions: {
        Row: {
          account_id: string
          category: Database["public"]["Enums"]["ultaura_exclusion_category"]
          created_at: string
          excluded: boolean
          excluded_at: string | null
          excluded_call_session_id: string | null
          id: string
          line_id: string
          reincluded_at: string | null
          reincluded_call_session_id: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          category: Database["public"]["Enums"]["ultaura_exclusion_category"]
          created_at?: string
          excluded?: boolean
          excluded_at?: string | null
          excluded_call_session_id?: string | null
          id?: string
          line_id: string
          reincluded_at?: string | null
          reincluded_call_session_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          category?: Database["public"]["Enums"]["ultaura_exclusion_category"]
          created_at?: string
          excluded?: boolean
          excluded_at?: string | null
          excluded_call_session_id?: string | null
          id?: string
          line_id?: string
          reincluded_at?: string | null
          reincluded_call_session_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_topic_exclusions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_topic_exclusions_excluded_call_session_id_fkey"
            columns: ["excluded_call_session_id"]
            isOneToOne: false
            referencedRelation: "ultaura_call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_topic_exclusions_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_topic_exclusions_reincluded_call_session_id_fkey"
            columns: ["reincluded_call_session_id"]
            isOneToOne: false
            referencedRelation: "ultaura_call_sessions"
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
      ultaura_weekly_summaries: {
        Row: {
          account_id: string
          created_at: string
          email_sent_at: string | null
          id: string
          line_id: string
          sms_sent_at: string | null
          summary_alg: string
          summary_ciphertext: string
          summary_iv: string
          summary_kid: string
          summary_tag: string
          week_start_date: string
        }
        Insert: {
          account_id: string
          created_at?: string
          email_sent_at?: string | null
          id?: string
          line_id: string
          sms_sent_at?: string | null
          summary_alg?: string
          summary_ciphertext: string
          summary_iv: string
          summary_kid?: string
          summary_tag: string
          week_start_date: string
        }
        Update: {
          account_id?: string
          created_at?: string
          email_sent_at?: string | null
          id?: string
          line_id?: string
          sms_sent_at?: string | null
          summary_alg?: string
          summary_ciphertext?: string
          summary_iv?: string
          summary_kid?: string
          summary_tag?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_weekly_summaries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_weekly_summaries_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      ultaura_wellness_alerts: {
        Row: {
          account_id: string
          acknowledged_at: string | null
          acknowledged_by_user_id: string | null
          alert_type: string
          created_at: string
          delivered_at: string | null
          delivery_method: string
          id: string
          line_id: string
          severity: string
          source_call_session_id: string | null
          summary: string
          title: string
        }
        Insert: {
          account_id: string
          acknowledged_at?: string | null
          acknowledged_by_user_id?: string | null
          alert_type: string
          created_at?: string
          delivered_at?: string | null
          delivery_method: string
          id?: string
          line_id: string
          severity: string
          source_call_session_id?: string | null
          summary: string
          title: string
        }
        Update: {
          account_id?: string
          acknowledged_at?: string | null
          acknowledged_by_user_id?: string | null
          alert_type?: string
          created_at?: string
          delivered_at?: string | null
          delivery_method?: string
          id?: string
          line_id?: string
          severity?: string
          source_call_session_id?: string | null
          summary?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ultaura_wellness_alerts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ultaura_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_wellness_alerts_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "ultaura_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ultaura_wellness_alerts_source_call_session_id_fkey"
            columns: ["source_call_session_id"]
            isOneToOne: false
            referencedRelation: "ultaura_call_sessions"
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
      apply_memory_decay: {
        Args: { p_decay_rate?: number; p_line_id: string; p_threshold?: number }
        Returns: number
      }
      assert_service_role: { Args: never; Returns: undefined }
      calculate_memory_decay: {
        Args: { p_decay_rate?: number; p_line_id: string; p_threshold?: number }
        Returns: {
          memory_id: string
          new_confidence: number
          old_confidence: number
          should_exclude: boolean
        }[]
      }
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
      categorize_memory_topic: {
        Args: {
          p_key: string
          p_type: Database["public"]["Enums"]["ultaura_memory_type"]
          p_value: string
        }
        Returns: Database["public"]["Enums"]["ultaura_exclusion_category"]
      }
      claim_due_reminders: {
        Args: {
          p_batch_size?: number
          p_claim_ttl_seconds?: number
          p_worker_id: string
        }
        Returns: {
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
          processing_claimed_at: string | null
          processing_claimed_by: string | null
          rrule: string | null
          snoozed_until: string | null
          status: Database["public"]["Enums"]["ultaura_reminder_status"]
          time_of_day: string | null
          timezone: string
        }[]
        SetofOptions: {
          from: "*"
          to: "ultaura_reminders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_due_schedules: {
        Args: {
          p_batch_size?: number
          p_claim_ttl_seconds?: number
          p_worker_id: string
        }
        Returns: {
          account_id: string
          created_at: string
          days_of_week: number[]
          enabled: boolean
          id: string
          is_one_time: boolean
          last_result:
            | Database["public"]["Enums"]["ultaura_schedule_result"]
            | null
          last_run_at: string | null
          line_id: string
          next_run_at: string | null
          processing_claimed_at: string | null
          processing_claimed_by: string | null
          retry_count: number
          retry_policy: Json
          time_of_day: string
          timezone: string
        }[]
        SetofOptions: {
          from: "*"
          to: "ultaura_schedules"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_account_retention: {
        Args: { p_account_id: string }
        Returns: Json
      }
      cleanup_old_rate_limit_events: { Args: never; Returns: undefined }
      complete_reminder_processing: {
        Args: { p_reminder_id: string; p_worker_id: string }
        Returns: boolean
      }
      complete_schedule_processing: {
        Args: {
          p_next_run_at: string
          p_reset_retry_count?: boolean
          p_result: string
          p_schedule_id: string
          p_worker_id: string
        }
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
      delete_ultaura_memories_for_key: {
        Args: { p_account_id: string; p_key: string; p_line_id: string }
        Returns: number
      }
      get_organizations_for_authenticated_user: {
        Args: never
        Returns: number[]
      }
      get_retention_cutoff: { Args: { p_account_id: string }; Returns: string }
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
      heartbeat_scheduler_lease: {
        Args: {
          p_extend_seconds?: number
          p_lease_id: string
          p_worker_id: string
        }
        Returns: boolean
      }
      increment_schedule_retry: {
        Args: {
          p_next_run_at: string
          p_schedule_id: string
          p_worker_id: string
        }
        Returns: boolean
      }
      is_line_on_vacation: { Args: { p_line_id: string }; Returns: boolean }
      is_ultaura_trial_active: {
        Args: { p_account_id: string }
        Returns: boolean
      }
      mark_memory_accessed: {
        Args: { p_memory_id: string }
        Returns: undefined
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
      match_memories_semantic: {
        Args: {
          p_line_id: string
          p_match_count?: number
          p_min_confidence?: number
          p_query_embedding: string
          p_similarity_threshold?: number
        }
        Returns: {
          memory_id: string
          memory_key: string
          memory_type: Database["public"]["Enums"]["ultaura_memory_type"]
          searchable_text: string
          similarity: number
        }[]
      }
      pin_memory: {
        Args: { p_memory_id: string; p_reason: string }
        Returns: undefined
      }
      release_scheduler_lease: {
        Args: { p_lease_id: string; p_worker_id: string }
        Returns: boolean
      }
      run_retention_cleanup: { Args: never; Returns: Json }
      transfer_organization: {
        Args: { org_id: number; target_user_membership_id: number }
        Returns: undefined
      }
      try_acquire_scheduler_lease: {
        Args: {
          p_lease_duration_seconds?: number
          p_lease_id: string
          p_worker_id: string
        }
        Returns: boolean
      }
      update_ultaura_account_usage: {
        Args: { p_account_id: string }
        Returns: undefined
      }
      upsert_ultaura_memory:
        | {
            Args: {
              p_account_id: string
              p_confidence: number
              p_key: string
              p_line_id: string
              p_memory_id: string
              p_privacy_scope: Database["public"]["Enums"]["ultaura_privacy_scope"]
              p_redaction_level: string
              p_source: string
              p_type: Database["public"]["Enums"]["ultaura_memory_type"]
              p_value_alg: string
              p_value_ciphertext: string
              p_value_iv: string
              p_value_kid: string
              p_value_tag: string
            }
            Returns: {
              action: string
              memory_id: string
              version: number
            }[]
          }
        | {
            Args: {
              p_account_id: string
              p_confidence: number
              p_created_in_call_session_id?: string
              p_key: string
              p_line_id: string
              p_memory_id: string
              p_privacy_scope: Database["public"]["Enums"]["ultaura_privacy_scope"]
              p_redaction_level: string
              p_source: string
              p_type: Database["public"]["Enums"]["ultaura_memory_type"]
              p_value_alg: string
              p_value_ciphertext: string
              p_value_iv: string
              p_value_kid: string
              p_value_tag: string
            }
            Returns: {
              action: string
              memory_id: string
              version: number
            }[]
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
      ultaura_consent_audit_action:
        | "granted"
        | "revoked"
        | "updated"
        | "voice_consent_given"
        | "voice_consent_denied"
        | "retention_changed"
        | "recording_toggled"
        | "summarization_toggled"
        | "vendor_acknowledged"
        | "data_export_requested"
        | "data_deletion_requested"
        | "memory_hard_deleted"
        | "recording_consent_updated"
        | "sharing_consent_updated"
        | "sharing_enabled_by_self_user"
        | "onboarding_completed"
        | "consent_incomplete_retry"
      ultaura_consent_type:
        | "outbound_calls"
        | "trusted_contact_notify"
        | "sms_to_payer"
        | "data_retention"
        | "audio_processing"
        | "recording"
      ultaura_deactivation_reason:
        | "user_request"
        | "user_request_bulk"
        | "decay"
        | "topic_exclusion"
        | "temporal_expiry"
        | "payer_deletion"
      ultaura_exclusion_category:
        | "health_medical"
        | "family_relationships"
        | "finances"
        | "location_address"
      ultaura_export_format: "json" | "csv"
      ultaura_export_status:
        | "pending"
        | "processing"
        | "ready"
        | "expired"
        | "failed"
      ultaura_line_status: "active" | "paused" | "disabled"
      ultaura_memory_type:
        | "fact"
        | "preference"
        | "follow_up"
        | "context"
        | "history"
        | "wellbeing"
        | "relationship"
        | "temporal"
        | "routine"
      ultaura_opt_out_channel: "outbound_calls" | "sms" | "all"
      ultaura_privacy_scope: "line_only" | "shareable_with_payer"
      ultaura_reminder_status: "scheduled" | "sent" | "missed" | "canceled"
      ultaura_retention_period:
        | "30_days"
        | "90_days"
        | "365_days"
        | "indefinite"
      ultaura_safety_category:
        | "SUICIDAL_IDEATION"
        | "SELF_HARM"
        | "HOPELESSNESS"
        | "ISOLATION_DISTRESS"
        | "PHYSICAL_DANGER"
        | "MEDICAL_EMERGENCY"
        | "ABUSE_CONCERN"
        | "COGNITIVE_DECLINE"
        | "GENERAL_CONCERN"
      ultaura_safety_tier: "low" | "medium" | "high"
      ultaura_schedule_event_type:
        | "created"
        | "edited"
        | "enabled"
        | "disabled"
        | "exception_added"
        | "exception_removed"
        | "vacation_started"
        | "vacation_ended"
      ultaura_schedule_exception_type: "skip" | "snooze" | "reschedule"
      ultaura_schedule_result:
        | "success"
        | "missed"
        | "suppressed_quiet_hours"
        | "failed"
        | "skipped"
        | "suppressed_vacation"
      ultaura_schedule_triggered_by: "dashboard" | "voice" | "system"
      ultaura_voice_consent_status: "pending" | "granted" | "denied"
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
      ultaura_consent_audit_action: [
        "granted",
        "revoked",
        "updated",
        "voice_consent_given",
        "voice_consent_denied",
        "retention_changed",
        "recording_toggled",
        "summarization_toggled",
        "vendor_acknowledged",
        "data_export_requested",
        "data_deletion_requested",
        "memory_hard_deleted",
        "recording_consent_updated",
        "sharing_consent_updated",
        "sharing_enabled_by_self_user",
        "onboarding_completed",
        "consent_incomplete_retry",
      ],
      ultaura_consent_type: [
        "outbound_calls",
        "trusted_contact_notify",
        "sms_to_payer",
        "data_retention",
        "audio_processing",
        "recording",
      ],
      ultaura_deactivation_reason: [
        "user_request",
        "user_request_bulk",
        "decay",
        "topic_exclusion",
        "temporal_expiry",
        "payer_deletion",
      ],
      ultaura_exclusion_category: [
        "health_medical",
        "family_relationships",
        "finances",
        "location_address",
      ],
      ultaura_export_format: ["json", "csv"],
      ultaura_export_status: [
        "pending",
        "processing",
        "ready",
        "expired",
        "failed",
      ],
      ultaura_line_status: ["active", "paused", "disabled"],
      ultaura_memory_type: [
        "fact",
        "preference",
        "follow_up",
        "context",
        "history",
        "wellbeing",
        "relationship",
        "temporal",
        "routine",
      ],
      ultaura_opt_out_channel: ["outbound_calls", "sms", "all"],
      ultaura_privacy_scope: ["line_only", "shareable_with_payer"],
      ultaura_reminder_status: ["scheduled", "sent", "missed", "canceled"],
      ultaura_retention_period: [
        "30_days",
        "90_days",
        "365_days",
        "indefinite",
      ],
      ultaura_safety_category: [
        "SUICIDAL_IDEATION",
        "SELF_HARM",
        "HOPELESSNESS",
        "ISOLATION_DISTRESS",
        "PHYSICAL_DANGER",
        "MEDICAL_EMERGENCY",
        "ABUSE_CONCERN",
        "COGNITIVE_DECLINE",
        "GENERAL_CONCERN",
      ],
      ultaura_safety_tier: ["low", "medium", "high"],
      ultaura_schedule_event_type: [
        "created",
        "edited",
        "enabled",
        "disabled",
        "exception_added",
        "exception_removed",
        "vacation_started",
        "vacation_ended",
      ],
      ultaura_schedule_exception_type: ["skip", "snooze", "reschedule"],
      ultaura_schedule_result: [
        "success",
        "missed",
        "suppressed_quiet_hours",
        "failed",
        "skipped",
        "suppressed_vacation",
      ],
      ultaura_schedule_triggered_by: ["dashboard", "voice", "system"],
      ultaura_voice_consent_status: ["pending", "granted", "denied"],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const

