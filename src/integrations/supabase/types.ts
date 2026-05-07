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
      flipkart_ugc_entries: {
        Row: {
          callout: string | null
          date: string
          id: string
          in_answer: number | null
          in_eng_image: number | null
          in_eng_text: number | null
          in_eng_text_p0: number | null
          in_eng_text_p2: number | null
          in_hin_image: number | null
          in_hin_text: number | null
          in_hin_text_p0: number | null
          in_hin_text_p2: number | null
          in_image_total: number | null
          in_question: number | null
          in_text_total: number | null
          in_video: number | null
          inserted_at: string | null
          month_label: string | null
          out_answer: number | null
          out_eng_image: number | null
          out_eng_text: number | null
          out_eng_text_p0: number | null
          out_eng_text_p2: number | null
          out_hin_image: number | null
          out_hin_text: number | null
          out_hin_text_p0: number | null
          out_hin_text_p2: number | null
          out_image_total: number | null
          out_question: number | null
          out_text_total: number | null
          out_video: number | null
          pending_count: number | null
          tat: string | null
          total_delivered: number | null
          total_received: number | null
          week: string | null
          year: number | null
        }
        Insert: {
          callout?: string | null
          date: string
          id?: string
          in_answer?: number | null
          in_eng_image?: number | null
          in_eng_text?: number | null
          in_eng_text_p0?: number | null
          in_eng_text_p2?: number | null
          in_hin_image?: number | null
          in_hin_text?: number | null
          in_hin_text_p0?: number | null
          in_hin_text_p2?: number | null
          in_image_total?: number | null
          in_question?: number | null
          in_text_total?: number | null
          in_video?: number | null
          inserted_at?: string | null
          month_label?: string | null
          out_answer?: number | null
          out_eng_image?: number | null
          out_eng_text?: number | null
          out_eng_text_p0?: number | null
          out_eng_text_p2?: number | null
          out_hin_image?: number | null
          out_hin_text?: number | null
          out_hin_text_p0?: number | null
          out_hin_text_p2?: number | null
          out_image_total?: number | null
          out_question?: number | null
          out_text_total?: number | null
          out_video?: number | null
          pending_count?: number | null
          tat?: string | null
          total_delivered?: number | null
          total_received?: number | null
          week?: string | null
          year?: number | null
        }
        Update: {
          callout?: string | null
          date?: string
          id?: string
          in_answer?: number | null
          in_eng_image?: number | null
          in_eng_text?: number | null
          in_eng_text_p0?: number | null
          in_eng_text_p2?: number | null
          in_hin_image?: number | null
          in_hin_text?: number | null
          in_hin_text_p0?: number | null
          in_hin_text_p2?: number | null
          in_image_total?: number | null
          in_question?: number | null
          in_text_total?: number | null
          in_video?: number | null
          inserted_at?: string | null
          month_label?: string | null
          out_answer?: number | null
          out_eng_image?: number | null
          out_eng_text?: number | null
          out_eng_text_p0?: number | null
          out_eng_text_p2?: number | null
          out_hin_image?: number | null
          out_hin_text?: number | null
          out_hin_text_p0?: number | null
          out_hin_text_p2?: number | null
          out_image_total?: number | null
          out_question?: number | null
          out_text_total?: number | null
          out_video?: number | null
          pending_count?: number | null
          tat?: string | null
          total_delivered?: number | null
          total_received?: number | null
          week?: string | null
          year?: number | null
        }
        Relationships: []
      }
      myntra_ugc_entries: {
        Row: {
          callout: string | null
          date: string
          id: string
          in_image_total: number | null
          in_text_total: number | null
          in_video: number | null
          inserted_at: string | null
          month_label: string | null
          out_image_total: number | null
          out_text_total: number | null
          out_video: number | null
          pending_count: number | null
          tat: string | null
          total_delivered: number | null
          total_received: number | null
          week: string | null
          year: number | null
        }
        Insert: {
          callout?: string | null
          date: string
          id?: string
          in_image_total?: number | null
          in_text_total?: number | null
          in_video?: number | null
          inserted_at?: string | null
          month_label?: string | null
          out_image_total?: number | null
          out_text_total?: number | null
          out_video?: number | null
          pending_count?: number | null
          tat?: string | null
          total_delivered?: number | null
          total_received?: number | null
          week?: string | null
          year?: number | null
        }
        Update: {
          callout?: string | null
          date?: string
          id?: string
          in_image_total?: number | null
          in_text_total?: number | null
          in_video?: number | null
          inserted_at?: string | null
          month_label?: string | null
          out_image_total?: number | null
          out_text_total?: number | null
          out_video?: number | null
          pending_count?: number | null
          tat?: string | null
          total_delivered?: number | null
          total_received?: number | null
          week?: string | null
          year?: number | null
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
