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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          code: string
          created_at: string
          description: string
          icon: string
          sort_order: number
          title: string
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          icon: string
          sort_order?: number
          title: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          icon?: string
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          created_at: string
          id: string
          is_random: boolean
          mode: number
          p1_score: number
          p2_score: number
          player1: string
          player2: string | null
          status: Database["public"]["Enums"]["match_status"]
          updated_at: string
          vs_bot: boolean
          winner_side: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_random?: boolean
          mode?: number
          p1_score?: number
          p2_score?: number
          player1: string
          player2?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
          vs_bot?: boolean
          winner_side?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_random?: boolean
          mode?: number
          p1_score?: number
          p2_score?: number
          player1?: string
          player2?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
          vs_bot?: boolean
          winner_side?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          best_streak: number
          bot_wins: number
          created_at: string
          current_streak: number
          id: string
          last_seen: string
          losses: number
          puntos_totales: number
          status: string
          username: string
          wins: number
        }
        Insert: {
          best_streak?: number
          bot_wins?: number
          created_at?: string
          current_streak?: number
          id: string
          last_seen?: string
          losses?: number
          puntos_totales?: number
          status?: string
          username: string
          wins?: number
        }
        Update: {
          best_streak?: number
          bot_wins?: number
          created_at?: string
          current_streak?: number
          id?: string
          last_seen?: string
          losses?: number
          puntos_totales?: number
          status?: string
          username?: string
          wins?: number
        }
        Relationships: []
      }
      rounds: {
        Row: {
          created_at: string
          id: string
          match_id: string
          p1_choice: Database["public"]["Enums"]["play_choice"] | null
          p2_choice: Database["public"]["Enums"]["play_choice"] | null
          result: string | null
          round_number: number
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          p1_choice?: Database["public"]["Enums"]["play_choice"] | null
          p2_choice?: Database["public"]["Enums"]["play_choice"] | null
          result?: string | null
          round_number: number
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          p1_choice?: Database["public"]["Enums"]["play_choice"] | null
          p2_choice?: Database["public"]["Enums"]["play_choice"] | null
          result?: string | null
          round_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "rounds_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          code: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          code: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          code?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["code"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_bot_match: { Args: { _mode: number }; Returns: string }
      create_invite: {
        Args: { _mode: number; _rival: string }
        Returns: string
      }
      finish_match_rewards: {
        Args: {
          _loser: string
          _match_id: string
          _mode: number
          _vs_bot: boolean
          _winner: string
        }
        Returns: undefined
      }
      grant_achievement: {
        Args: { _code: string; _user_id: string }
        Returns: undefined
      }
      join_random_match: { Args: { _mode: number }; Returns: string }
      leaderboard: {
        Args: { _limit?: number }
        Returns: {
          current_streak: number
          id: string
          puntos_totales: number
          username: string
          wins: number
        }[]
      }
      leave_match: { Args: { _match_id: string }; Returns: undefined }
      list_players: {
        Args: { _limit?: number }
        Returns: {
          id: string
          last_seen: string
          status: string
          username: string
        }[]
      }
      my_rank: { Args: never; Returns: number }
      play_round_choice: {
        Args: {
          _choice: Database["public"]["Enums"]["play_choice"]
          _match_id: string
        }
        Returns: undefined
      }
      players_by_ids: {
        Args: { _ids: string[] }
        Returns: {
          id: string
          last_seen: string
          status: string
          username: string
        }[]
      }
      respond_invite: {
        Args: { _accept: boolean; _match_id: string }
        Returns: undefined
      }
      username_available: { Args: { _username: string }; Returns: boolean }
    }
    Enums: {
      match_status:
        | "invited"
        | "waiting"
        | "in_progress"
        | "finished"
        | "cancelled"
        | "declined"
      play_choice: "piedra" | "papel" | "tijera"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      match_status: [
        "invited",
        "waiting",
        "in_progress",
        "finished",
        "cancelled",
        "declined",
      ],
      play_choice: ["piedra", "papel", "tijera"],
    },
  },
} as const
