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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      cash_entries: {
        Row: {
          amount: number
          balance_after: number | null
          category: string | null
          created_at: string
          date: string
          description: string | null
          id: string
          type: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          category?: string | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          type: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          category?: string | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          type?: string
        }
        Relationships: []
      }
      crm_accounts: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          created_at: string
          followup_cadence_days: number
          id: string
          last_contact_date: string | null
          name: string
          next_followup_date: string | null
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          followup_cadence_days?: number
          id?: string
          last_contact_date?: string | null
          name: string
          next_followup_date?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          followup_cadence_days?: number
          id?: string
          last_contact_date?: string | null
          name?: string
          next_followup_date?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_activities: {
        Row: {
          account_id: string
          created_at: string
          date: string
          description: string
          id: string
          type: string
        }
        Insert: {
          account_id: string
          created_at?: string
          date?: string
          description: string
          id?: string
          type?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "crm_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_orders: {
        Row: {
          created_at: string
          date_received: string
          email_from: string
          email_subject: string
          id: string
          po_number: string | null
          processed: boolean
          product_name: string | null
          quantity: number | null
          raw_email_body: string | null
        }
        Insert: {
          created_at?: string
          date_received?: string
          email_from: string
          email_subject: string
          id?: string
          po_number?: string | null
          processed?: boolean
          product_name?: string | null
          quantity?: number | null
          raw_email_body?: string | null
        }
        Update: {
          created_at?: string
          date_received?: string
          email_from?: string
          email_subject?: string
          id?: string
          po_number?: string | null
          processed?: boolean
          product_name?: string | null
          quantity?: number | null
          raw_email_body?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          description: string
          id: string
          notes: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          date?: string
          description: string
          id?: string
          notes?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          notes?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      forwarded_emails: {
        Row: {
          created_at: string
          email_body: string | null
          email_from: string
          email_subject: string
          id: string
          notes: string | null
          received_at: string
          status: string
        }
        Insert: {
          created_at?: string
          email_body?: string | null
          email_from: string
          email_subject: string
          id?: string
          notes?: string | null
          received_at?: string
          status?: string
        }
        Update: {
          created_at?: string
          email_body?: string | null
          email_from?: string
          email_subject?: string
          id?: string
          notes?: string | null
          received_at?: string
          status?: string
        }
        Relationships: []
      }
      inventory_finished: {
        Row: {
          created_at: string
          id: string
          last_updated: string
          location: string
          product_id: string | null
          quantity: number
          reorder_point: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_updated?: string
          location?: string
          product_id?: string | null
          quantity?: number
          reorder_point?: number
        }
        Update: {
          created_at?: string
          id?: string
          last_updated?: string
          location?: string
          product_id?: string | null
          quantity?: number
          reorder_point?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_finished_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          cases_on_hand: string | null
          category: string | null
          created_at: string
          id: string
          last_synced: string
          product_name: string
          reorder: string | null
          reorder_level: string | null
          sku: string | null
          stock_value: string | null
          units_on_hand: string | null
        }
        Insert: {
          cases_on_hand?: string | null
          category?: string | null
          created_at?: string
          id?: string
          last_synced?: string
          product_name: string
          reorder?: string | null
          reorder_level?: string | null
          sku?: string | null
          stock_value?: string | null
          units_on_hand?: string | null
        }
        Update: {
          cases_on_hand?: string | null
          category?: string | null
          created_at?: string
          id?: string
          last_synced?: string
          product_name?: string
          reorder?: string | null
          reorder_level?: string | null
          sku?: string | null
          stock_value?: string | null
          units_on_hand?: string | null
        }
        Relationships: []
      }
      inventory_packaging: {
        Row: {
          created_at: string
          id: string
          item_name: string
          last_updated: string
          location: string
          quantity: number
          reorder_point: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_name: string
          last_updated?: string
          location?: string
          quantity?: number
          reorder_point?: number
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string
          last_updated?: string
          location?: string
          quantity?: number
          reorder_point?: number
        }
        Relationships: []
      }
      inventory_shipping: {
        Row: {
          created_at: string
          id: string
          item_name: string
          last_updated: string
          location: string
          quantity: number
          reorder_point: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_name: string
          last_updated?: string
          location?: string
          quantity?: number
          reorder_point?: number
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string
          last_updated?: string
          location?: string
          quantity?: number
          reorder_point?: number
        }
        Relationships: []
      }
      inventory_transactions: {
        Row: {
          counterparty: string | null
          created_at: string
          direction: string
          id: string
          item_id: string
          item_type: string
          notes: string | null
          quantity: number
          source: string | null
        }
        Insert: {
          counterparty?: string | null
          created_at?: string
          direction: string
          id?: string
          item_id: string
          item_type: string
          notes?: string | null
          quantity: number
          source?: string | null
        }
        Update: {
          counterparty?: string | null
          created_at?: string
          direction?: string
          id?: string
          item_id?: string
          item_type?: string
          notes?: string | null
          quantity?: number
          source?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          customer: string
          date_issued: string
          due_date: string
          file_url: string | null
          id: string
          invoice_number: string | null
          order_id: string | null
          payment_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer: string
          date_issued?: string
          due_date: string
          file_url?: string | null
          id?: string
          invoice_number?: string | null
          order_id?: string | null
          payment_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer?: string
          date_issued?: string
          due_date?: string
          file_url?: string | null
          id?: string
          invoice_number?: string | null
          order_id?: string | null
          payment_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          product_name: string | null
          quantity: number
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          product_name?: string | null
          quantity?: number
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string | null
          quantity?: number
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          carrier: string | null
          created_at: string
          customer_name: string
          delivery_date: string | null
          file_url: string | null
          id: string
          invoice_number: string | null
          invoice_status: string | null
          notes: string | null
          order_date: string
          payment_date: string | null
          po_number: string | null
          ship_date: string | null
          source: string
          status: string
          total_value: number | null
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          carrier?: string | null
          created_at?: string
          customer_name: string
          delivery_date?: string | null
          file_url?: string | null
          id?: string
          invoice_number?: string | null
          invoice_status?: string | null
          notes?: string | null
          order_date?: string
          payment_date?: string | null
          po_number?: string | null
          ship_date?: string | null
          source?: string
          status?: string
          total_value?: number | null
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          carrier?: string | null
          created_at?: string
          customer_name?: string
          delivery_date?: string | null
          file_url?: string | null
          id?: string
          invoice_number?: string | null
          invoice_status?: string | null
          notes?: string | null
          order_date?: string
          payment_date?: string | null
          po_number?: string | null
          ship_date?: string | null
          source?: string
          status?: string
          total_value?: number | null
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          sale_price: number | null
          sku: string | null
          type: string
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          sale_price?: number | null
          sku?: string | null
          type?: string
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          sale_price?: number | null
          sku?: string | null
          type?: string
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      quickbooks_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          realm_id: string
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          realm_id: string
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          realm_id?: string
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          priority: string
          source: string | null
          source_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          source?: string | null
          source_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          source?: string | null
          source_id?: string | null
          status?: string
          title?: string
          updated_at?: string
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
