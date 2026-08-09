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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      app_admins: {
        Row: {
          claimed_at: string | null
          created_at: string
          email: string
          user_id: string | null
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          email: string
          user_id?: string | null
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          email?: string
          user_id?: string | null
        }
        Relationships: []
      }
      championship_driver: {
        Row: {
          id: number
          name: string
          nickname: string
          number: number | null
          slug: string
        }
        Insert: {
          id?: number
          name: string
          nickname?: string
          number?: number | null
          slug: string
        }
        Update: {
          id?: number
          name?: string
          nickname?: string
          number?: number | null
          slug?: string
        }
        Relationships: []
      }
      championship_driverteamseason: {
        Row: {
          car_number: number | null
          driver_id: number
          id: number
          is_guest: boolean
          season_id: number
          team_id: number
        }
        Insert: {
          car_number?: number | null
          driver_id: number
          id?: number
          is_guest?: boolean
          season_id: number
          team_id: number
        }
        Update: {
          car_number?: number | null
          driver_id?: number
          id?: number
          is_guest?: boolean
          season_id?: number
          team_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "championship_driverteamseason_driver_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "championship_driver"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "championship_driverteamseason_season_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "championship_season"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "championship_driverteamseason_team_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "championship_team"
            referencedColumns: ["id"]
          },
        ]
      }
      championship_round: {
        Row: {
          date: string
          id: number
          location: string
          name: string
          order: number
          season_id: number
        }
        Insert: {
          date: string
          id?: number
          location: string
          name: string
          order: number
          season_id: number
        }
        Update: {
          date?: string
          id?: number
          location?: string
          name?: string
          order?: number
          season_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "championship_round_season_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "championship_season"
            referencedColumns: ["id"]
          },
        ]
      }
      championship_roundresult: {
        Row: {
          entry_id: number
          fastest_lap: boolean
          has_penalty: boolean
          id: number
          penalty_reason: string
          points: number
          position: number
          round_id: number
          status: string
        }
        Insert: {
          entry_id: number
          fastest_lap?: boolean
          has_penalty?: boolean
          id?: number
          penalty_reason?: string
          points?: number
          position: number
          round_id: number
          status?: string
        }
        Update: {
          entry_id?: number
          fastest_lap?: boolean
          has_penalty?: boolean
          id?: number
          penalty_reason?: string
          points?: number
          position?: number
          round_id?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "championship_roundresult_entry_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "championship_driverteamseason"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "championship_roundresult_round_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "championship_round"
            referencedColumns: ["id"]
          },
        ]
      }
      championship_season: {
        Row: {
          id: number
          is_active: boolean
          name: string
          year: number
        }
        Insert: {
          id?: number
          is_active?: boolean
          name: string
          year: number
        }
        Update: {
          id?: number
          is_active?: boolean
          name?: string
          year?: number
        }
        Relationships: []
      }
      championship_team: {
        Row: {
          id: number
          name: string
          primary_color: string
          secondary_color: string
          slug: string
        }
        Insert: {
          id?: number
          name: string
          primary_color: string
          secondary_color: string
          slug: string
        }
        Update: {
          id?: number
          name?: string
          primary_color?: string
          secondary_color?: string
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_championship_season: {
        Args: { p_season_id: number }
        Returns: undefined
      }
      replace_round_results: {
        Args: { p_results: Json; p_round_id: number }
        Returns: undefined
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
    Enums: {},
  },
} as const
