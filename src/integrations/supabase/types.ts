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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          barber_id: string
          created_at: string
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          id: string
          service: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
        }
        Insert: {
          barber_id: string
          created_at?: string
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          id?: string
          service: string
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
        }
        Update: {
          barber_id?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          id?: string
          service?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "appointments_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
        ]
      }
      barbers: {
        Row: {
          area: string | null
          barber_name: string
          close_time: string
          code: string
          created_at: string
          days_off: number[]
          id: string
          open_time: string
          owner_id: string
          shop_name: string
          slot_minutes: number
          timezone: string
        }
        Insert: {
          area?: string | null
          barber_name: string
          close_time?: string
          code?: string
          created_at?: string
          days_off?: number[]
          id?: string
          open_time?: string
          owner_id: string
          shop_name: string
          slot_minutes?: number
          timezone?: string
        }
        Update: {
          area?: string | null
          barber_name?: string
          close_time?: string
          code?: string
          created_at?: string
          days_off?: number[]
          id?: string
          open_time?: string
          owner_id?: string
          shop_name?: string
          slot_minutes?: number
          timezone?: string
        }
        Relationships: []
      }
      debts: {
        Row: {
          amount: number
          barber_id: string
          created_at: string
          customer_name: string
          customer_phone: string | null
          id: string
          note: string | null
        }
        Insert: {
          amount: number
          barber_id: string
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          id?: string
          note?: string | null
        }
        Update: {
          amount?: number
          barber_id?: string
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debts_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          barber_id: string
          debt_id: string
          id: string
          paid_at: string
        }
        Insert: {
          amount: number
          barber_id: string
          debt_id: string
          id?: string
          paid_at?: string
        }
        Update: {
          amount?: number
          barber_id?: string
          debt_id?: string
          id?: string
          paid_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      book_appointment: {
        Args: {
          p_barber_id: string
          p_customer_name: string
          p_customer_phone?: string
          p_service: string
          p_starts_at: string
        }
        Returns: {
          barber_id: string
          created_at: string
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          id: string
          service: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_my_appointment: { Args: { p_id: string }; Returns: undefined }
      find_barber_by_code: {
        Args: { p_code: string }
        Returns: {
          area: string
          barber_name: string
          close_time: string
          days_off: number[]
          id: string
          open_time: string
          shop_name: string
          slot_minutes: number
          timezone: string
        }[]
      }
      generate_barber_code: { Args: never; Returns: string }
      get_available_slots: {
        Args: { p_barber_id: string; p_day: string }
        Returns: {
          available: boolean
          starts_at: string
        }[]
      }
      get_my_appointments: {
        Args: never
        Returns: {
          barber_name: string
          id: string
          service: string
          shop_name: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          timezone: string
        }[]
      }
      is_barber_owner: { Args: { _barber_id: string }; Returns: boolean }
    }
    Enums: {
      appointment_status: "confirmed" | "completed" | "cancelled"
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
      appointment_status: ["confirmed", "completed", "cancelled"],
    },
  },
} as const
