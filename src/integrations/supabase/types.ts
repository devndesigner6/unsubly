export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      escrow_vaults: {
        Row: {
          algorand_address: string
          amount: number
          app_address: string | null
          app_id: number | null
          arbitrator_address: string | null
          asset_id: number | null
          co_signer_address: string | null
          co_signer_approved: boolean | null
          created_at: string
          currency: string
          escrow_address: string | null
          id: string
          kill_switch_active: boolean
          nft_asset_id: number | null
          released_at: string | null
          status: string
          subscription_id: string | null
          txn_id: string | null
          unlock_time: string | null
          updated_at: string
          user_id: string
          vault_type: string
        }
        Insert: {
          algorand_address: string
          amount: number
          app_address?: string | null
          app_id?: number | null
          arbitrator_address?: string | null
          asset_id?: number | null
          co_signer_address?: string | null
          co_signer_approved?: boolean | null
          created_at?: string
          currency?: string
          escrow_address?: string | null
          id?: string
          kill_switch_active?: boolean
          nft_asset_id?: number | null
          released_at?: string | null
          status?: string
          subscription_id?: string | null
          txn_id?: string | null
          unlock_time?: string | null
          updated_at?: string
          user_id: string
          vault_type?: string
        }
        Update: {
          algorand_address?: string
          amount?: number
          app_address?: string | null
          app_id?: number | null
          arbitrator_address?: string | null
          asset_id?: number | null
          co_signer_address?: string | null
          co_signer_approved?: boolean | null
          created_at?: string
          currency?: string
          escrow_address?: string | null
          id?: string
          kill_switch_active?: boolean
          nft_asset_id?: number | null
          released_at?: string | null
          status?: string
          subscription_id?: string | null
          txn_id?: string | null
          unlock_time?: string | null
          updated_at?: string
          user_id?: string
          vault_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrow_vaults_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      onchain_payments: {
        Row: {
          algorand_txn_id: string
          amount: number
          block_round: number | null
          confirmed_at: string | null
          created_at: string
          id: string
          note: string | null
          recipient_address: string | null
          sender_address: string
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          algorand_txn_id: string
          amount: number
          block_round?: number | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          note?: string | null
          recipient_address?: string | null
          sender_address: string
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          algorand_txn_id?: string
          amount?: number
          block_round?: number | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          note?: string | null
          recipient_address?: string | null
          sender_address?: string
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onchain_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          created_at: string
          id: string
          last_four: string | null
          name: string
          type: Database["public"]["Enums"]["payment_method_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_four?: string | null
          name: string
          type: Database["public"]["Enums"]["payment_method_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_four?: string | null
          name?: string
          type?: Database["public"]["Enums"]["payment_method_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          algorand_address: string | null
          avatar_url: string | null
          created_at: string
          currency: string
          default_alert_days: number | null
          email_alerts: boolean | null
          google_access_token: string | null
          id: string
          name: string | null
          telegram_chat_id: string | null
          updated_at: string
          weekly_digest: boolean | null
        }
        Insert: {
          algorand_address?: string | null
          avatar_url?: string | null
          created_at?: string
          currency?: string
          default_alert_days?: number | null
          email_alerts?: boolean | null
          google_access_token?: string | null
          id: string
          name?: string | null
          telegram_chat_id?: string | null
          updated_at?: string
          weekly_digest?: boolean | null
        }
        Update: {
          algorand_address?: string | null
          avatar_url?: string | null
          created_at?: string
          currency?: string
          default_alert_days?: number | null
          email_alerts?: boolean | null
          google_access_token?: string | null
          id?: string
          name?: string | null
          telegram_chat_id?: string | null
          updated_at?: string
          weekly_digest?: boolean | null
        }
        Relationships: []
      }
      resume_shares: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          share_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          share_token?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          share_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscription_tags: {
        Row: {
          subscription_id: string
          tag_id: string
        }
        Insert: {
          subscription_id: string
          tag_id: string
        }
        Update: {
          subscription_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_tags_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          alert_days: number | null
          alert_enabled: boolean | null
          amount: number
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          cancelled_at: string | null
          cancellation_method: string | null
          category: string | null
          created_at: string
          credentials_set_at: string | null
          currency: string | null
          description: string | null
          folder_id: string | null
          id: string
          last_alert_sent: string | null
          logo: string | null
          name: string
          next_billing_date: string
          notes: string | null
          payment_method_id: string | null
          service_password_enc: string | null
          service_username: string | null
          source: string
          start_date: string
          status: Database["public"]["Enums"]["subscription_status"] | null
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          alert_days?: number | null
          alert_enabled?: boolean | null
          amount: number
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          cancelled_at?: string | null
          cancellation_method?: string | null
          category?: string | null
          created_at?: string
          credentials_set_at?: string | null
          currency?: string | null
          description?: string | null
          folder_id?: string | null
          id?: string
          last_alert_sent?: string | null
          logo?: string | null
          name: string
          next_billing_date: string
          notes?: string | null
          payment_method_id?: string | null
          service_password_enc?: string | null
          service_username?: string | null
          source?: string
          start_date: string
          status?: Database["public"]["Enums"]["subscription_status"] | null
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          alert_days?: number | null
          alert_enabled?: boolean | null
          amount?: number
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          cancelled_at?: string | null
          cancellation_method?: string | null
          category?: string | null
          created_at?: string
          credentials_set_at?: string | null
          currency?: string | null
          description?: string | null
          folder_id?: string | null
          id?: string
          last_alert_sent?: string | null
          logo?: string | null
          name?: string
          next_billing_date?: string
          notes?: string | null
          payment_method_id?: string | null
          service_password_enc?: string | null
          service_username?: string | null
          source?: string
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status"] | null
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_renewal_alerts: {
        Row: {
          alert_sent_at: string
          alert_type: string
          created_at: string
          decided_at: string | null
          id: string
          subscription_id: string
          user_decision: string | null
          vault_id: string | null
        }
        Insert: {
          alert_sent_at?: string
          alert_type?: string
          created_at?: string
          decided_at?: string | null
          id?: string
          subscription_id: string
          user_decision?: string | null
          vault_id?: string | null
        }
        Update: {
          alert_sent_at?: string
          alert_type?: string
          created_at?: string
          decided_at?: string | null
          id?: string
          subscription_id?: string
          user_decision?: string | null
          vault_id?: string | null
        }
        Relationships: []
      }
      subscription_guardrails: {
        Row: {
          budget_cap: number | null
          is_trial: boolean | null
          pause_before_paid_renewal: boolean | null
          require_confirmation: boolean | null
          subscription_id: string
          trial_end_date: string | null
          updated_at: string | null
        }
        Insert: {
          budget_cap?: number | null
          is_trial?: boolean | null
          pause_before_paid_renewal?: boolean | null
          require_confirmation?: boolean | null
          subscription_id: string
          trial_end_date?: string | null
          updated_at?: string | null
        }
        Update: {
          budget_cap?: number | null
          is_trial?: boolean | null
          pause_before_paid_renewal?: boolean | null
          require_confirmation?: boolean | null
          subscription_id?: string
          trial_end_date?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      agent_actions: {
        Row: {
          action_type: string
          created_at: string
          id: string
          payload: Json | null
          status: string
          subscription_id: string | null
          txid: string | null
          user_id: string
          vault_id: string | null
        }
        Insert: {
          action_type?: string
          created_at?: string
          id?: string
          payload?: Json | null
          status?: string
          subscription_id?: string | null
          txid?: string | null
          user_id: string
          vault_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          payload?: Json | null
          status?: string
          subscription_id?: string | null
          txid?: string | null
          user_id?: string
          vault_id?: string | null
        }
        Relationships: []
      }
      agent_pending_decisions: {
        Row: {
          chat_id: string | null
          created_at: string
          decided_at: string | null
          decision: string | null
          expires_at: string
          id: string
          notified_at: string
          subscription_id: string | null
          user_id: string
          vault_id: string | null
        }
        Insert: {
          chat_id?: string | null
          created_at?: string
          decided_at?: string | null
          decision?: string | null
          expires_at: string
          id?: string
          notified_at?: string
          subscription_id?: string | null
          user_id: string
          vault_id?: string | null
        }
        Update: {
          chat_id?: string | null
          created_at?: string
          decided_at?: string | null
          decision?: string | null
          expires_at?: string
          id?: string
          notified_at?: string
          subscription_id?: string | null
          user_id?: string
          vault_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      billing_cycle: "weekly" | "monthly" | "quarterly" | "yearly"
      payment_method_type:
        | "credit_card"
        | "debit_card"
        | "paypal"
        | "bank_account"
        | "other"
      subscription_status: "active" | "cancelled" | "trial" | "paused"
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
  public: {
    Enums: {
      billing_cycle: ["weekly", "monthly", "quarterly", "yearly"],
      payment_method_type: [
        "credit_card",
        "debit_card",
        "paypal",
        "bank_account",
        "other",
      ],
      subscription_status: ["active", "cancelled", "trial", "paused"],
    },
  },
} as const
