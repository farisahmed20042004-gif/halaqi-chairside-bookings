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
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          duration_minutes: number | null
          ends_at: string | null
          id: string
          price: number | null
          rescheduled_from: string | null
          service: string
          service_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          barber_id: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          duration_minutes?: number | null
          ends_at?: string | null
          id?: string
          price?: number | null
          rescheduled_from?: string | null
          service: string
          service_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          barber_id?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          duration_minutes?: number | null
          ends_at?: string | null
          id?: string
          price?: number | null
          rescheduled_from?: string | null
          service?: string
          service_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      barbers: {
        Row: {
          address: string | null
          area: string | null
          barber_name: string
          close_time: string
          code: string
          created_at: string
          days_off: number[]
          id: string
          is_public: boolean
          open_time: string
          owner_id: string
          shop_name: string
          slot_minutes: number
          timezone: string
        }
        Insert: {
          address?: string | null
          area?: string | null
          barber_name: string
          close_time?: string
          code?: string
          created_at?: string
          days_off?: number[]
          id?: string
          is_public?: boolean
          open_time?: string
          owner_id: string
          shop_name: string
          slot_minutes?: number
          timezone?: string
        }
        Update: {
          address?: string | null
          area?: string | null
          barber_name?: string
          close_time?: string
          code?: string
          created_at?: string
          days_off?: number[]
          id?: string
          is_public?: boolean
          open_time?: string
          owner_id?: string
          shop_name?: string
          slot_minutes?: number
          timezone?: string
        }
        Relationships: []
      }
      customer_barbers: {
        Row: {
          barber_code: string
          barber_id: string
          created_at: string
          customer_id: string
          updated_at: string
        }
        Insert: {
          barber_code: string
          barber_id: string
          created_at?: string
          customer_id: string
          updated_at?: string
        }
        Update: {
          barber_code?: string
          barber_id?: string
          created_at?: string
          customer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_barbers_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
        ]
      }
      debts: {
        Row: {
          amount: number
          barber_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          id: string
          incurred_at: string
          link_code: string | null
          linked_at: string | null
          note: string | null
        }
        Insert: {
          amount: number
          barber_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          id?: string
          incurred_at?: string
          link_code?: string | null
          linked_at?: string | null
          note?: string | null
        }
        Update: {
          amount?: number
          barber_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          id?: string
          incurred_at?: string
          link_code?: string | null
          linked_at?: string | null
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
      notifications: {
        Row: {
          appointment_id: string | null
          body: string | null
          created_at: string
          id: string
          kind: string
          read_at: string | null
          starts_at: string | null
          timezone: string | null
          title: string
          user_id: string
        }
        Insert: {
          appointment_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          read_at?: string | null
          starts_at?: string | null
          timezone?: string | null
          title: string
          user_id: string
        }
        Update: {
          appointment_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          starts_at?: string | null
          timezone?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          barber_id: string
          created_by: string | null
          debt_id: string
          id: string
          paid_at: string
        }
        Insert: {
          amount: number
          barber_id: string
          created_by?: string | null
          debt_id: string
          id?: string
          paid_at?: string
        }
        Update: {
          amount?: number
          barber_id?: string
          created_by?: string | null
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
      services: {
        Row: {
          barber_id: string
          created_at: string
          deleted_at: string | null
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          barber_id: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          duration_minutes: number
          id?: string
          is_active?: boolean
          name: string
          price: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          barber_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_customers: {
        Row: {
          barber_id: string
          created_at: string
          customer_id: string
          display_name: string
          last_booked_at: string | null
          phone: string | null
        }
        Insert: {
          barber_id: string
          created_at?: string
          customer_id: string
          display_name: string
          last_booked_at?: string | null
          phone?: string | null
        }
        Update: {
          barber_id?: string
          created_at?: string
          customer_id?: string
          display_name?: string
          last_booked_at?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_customers_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ar_normalize: { Args: { t: string }; Returns: string }
      assert_bookable_slot: {
        Args: {
          p_barber: Database["public"]["Tables"]["barbers"]["Row"]
          p_duration: number
          p_starts_at: string
        }
        Returns: undefined
      }
      book_appointment: {
        Args: {
          p_barber_id: string
          p_customer_name?: string
          p_customer_phone?: string
          p_service_id: string
          p_starts_at: string
        }
        Returns: {
          barber_id: string
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          duration_minutes: number | null
          ends_at: string | null
          id: string
          price: number | null
          rescheduled_from: string | null
          service: string
          service_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_my_appointment: { Args: { p_id: string }; Returns: undefined }
      claim_debt: { Args: { p_code: string }; Returns: string }
      find_barber_by_code: {
        Args: { p_code: string }
        Returns: {
          address: string
          area: string
          barber_name: string
          close_time: string
          code: string
          days_off: number[]
          id: string
          open_time: string
          shop_name: string
          slot_minutes: number
          timezone: string
        }[]
      }
      generate_barber_code: { Args: never; Returns: string }
      generate_debt_link_code: { Args: never; Returns: string }
      get_available_slots: {
        Args: {
          p_barber_id: string
          p_day: string
          p_ignore_appointment?: string
          p_service_id: string
        }
        Returns: {
          available: boolean
          starts_at: string
        }[]
      }
      get_my_appointments: {
        Args: never
        Returns: {
          barber_id: string
          barber_name: string
          days_off: number[]
          duration_minutes: number
          ends_at: string
          id: string
          price: number
          rescheduled_from: string
          service: string
          service_id: string
          shop_name: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          timezone: string
        }[]
      }
      get_my_barber: {
        Args: never
        Returns: {
          address: string
          area: string
          barber_name: string
          close_time: string
          code: string
          days_off: number[]
          id: string
          open_time: string
          shop_name: string
          slot_minutes: number
          timezone: string
        }[]
      }
      get_my_bookings: {
        Args: never
        Returns: {
          barber_id: string
          barber_name: string
          cancelled_by_barber: boolean
          created_at: string
          duration_minutes: number
          ends_at: string
          id: string
          price: number
          service: string
          service_id: string
          shop_name: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          timezone: string
        }[]
      }
      get_my_shops: {
        Args: never
        Returns: {
          address: string
          area: string
          barber_name: string
          code: string
          id: string
          shop_name: string
        }[]
      }
      get_public_shop: {
        Args: { p_barber_id: string }
        Returns: {
          address: string
          area: string
          barber_name: string
          close_time: string
          days_off: number[]
          id: string
          is_public: boolean
          open_time: string
          shop_name: string
          slot_minutes: number
          timezone: string
        }[]
      }
      get_shop_services: {
        Args: { p_barber_id: string }
        Returns: {
          description: string
          duration_minutes: number
          id: string
          name: string
          price: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_barber_owner: { Args: { _barber_id: string }; Returns: boolean }
      link_debt_to_customer: {
        Args: { p_customer_id: string; p_debt_id: string }
        Returns: undefined
      }
      reschedule_appointment: {
        Args: { p_id: string; p_new_starts_at: string }
        Returns: {
          barber_id: string
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          duration_minutes: number | null
          ends_at: string | null
          id: string
          price: number | null
          rescheduled_from: string | null
          service: string
          service_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_my_barber: {
        Args: { p_code: string }
        Returns: {
          address: string
          area: string
          barber_name: string
          close_time: string
          code: string
          days_off: number[]
          id: string
          open_time: string
          shop_name: string
          slot_minutes: number
          timezone: string
        }[]
      }
      search_public_shops: {
        Args: { p_query?: string }
        Returns: {
          address: string
          area: string
          barber_name: string
          close_time: string
          days_off: number[]
          id: string
          open_time: string
          services: Json
          shop_name: string
          slot_minutes: number
          timezone: string
        }[]
      }
    }
    Enums: {
      app_role: "barber" | "customer"
      appointment_status: "pending" | "confirmed" | "completed" | "cancelled"
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
      app_role: ["barber", "customer"],
      appointment_status: ["pending", "confirmed", "completed", "cancelled"],
    },
  },
} as const
