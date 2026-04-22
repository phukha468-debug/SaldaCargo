export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      business_units: {
        Row: { id: string; code: string; name: string; is_active: boolean | null; created_at: string | null }
        Insert: { id?: string; code: string; name: string; is_active?: boolean | null; created_at?: string | null }
        Update: { id?: string; code?: string; name?: string; is_active?: boolean | null; created_at?: string | null }
      }
      legal_entities: {
        Row: { id: string; name: string; type: string; inn: string | null; tax_regime: string | null; is_active: boolean | null; created_at: string | null }
        Insert: { id?: string; name: string; type: string; inn?: string | null; tax_regime?: string | null; is_active?: boolean | null; created_at?: string | null }
        Update: { id?: string; name?: string; type?: string; inn?: string | null; tax_regime?: string | null; is_active?: boolean | null; created_at?: string | null }
      }
      users: {
        Row: { id: string; full_name: string; role: string; phone: string | null; is_active: boolean | null; created_at: string | null }
        Insert: { id?: string; full_name: string; role: string; phone?: string | null; is_active?: boolean | null; created_at?: string | null }
        Update: { id?: string; full_name?: string; role?: string; phone?: string | null; is_active?: boolean | null; created_at?: string | null }
      }
      assets: {
        Row: { id: string; plate_number: string; asset_type_id: string; business_unit_id: string; legal_entity_id: string; status: string; year: number | null; odometer_current: number; residual_value: number; remaining_life_months: number; current_book_value: number | null; notes: string | null; created_at: string | null }
        Insert: { id?: string; plate_number: string; asset_type_id: string; business_unit_id: string; legal_entity_id: string; status?: string; year?: number | null; odometer_current?: number; residual_value: number; remaining_life_months: number; current_book_value?: number | null; notes?: string | null; created_at?: string | null }
        Update: { id?: string; plate_number?: string; asset_type_id?: string; business_unit_id?: string; legal_entity_id?: string; status?: string; year?: number | null; odometer_current?: number; residual_value?: number; remaining_life_months?: number; current_book_value?: number | null; notes?: string | null; created_at?: string | null }
      }
      asset_types: {
        Row: { id: string; code: string; name: string }
        Insert: { id?: string; code: string; name: string }
        Update: { id?: string; code?: string; name?: string }
      }
      wallets: {
        Row: { id: string; code: string; name: string; type: string; legal_entity_id: string | null }
        Insert: { id?: string; code: string; name: string; type: string; legal_entity_id?: string | null }
        Update: { id?: string; code?: string; name?: string; type?: string; legal_entity_id?: string | null }
      }
      transactions: {
        Row: { id: string; direction: string; amount: number; from_wallet_id: string | null; to_wallet_id: string | null; transaction_type: string | null; lifecycle_status: string; settlement_status: string; description: string | null; actual_date: string; created_at: string | null }
        Insert: { id?: string; direction: string; amount: number; from_wallet_id?: string | null; to_wallet_id?: string | null; transaction_type?: string | null; lifecycle_status?: string; settlement_status?: string; description?: string | null; actual_date?: string; created_at?: string | null }
        Update: { id?: string; direction?: string; amount?: number; from_wallet_id?: string | null; to_wallet_id?: string | null; transaction_type?: string | null; lifecycle_status?: string; settlement_status?: string; description?: string | null; actual_date?: string; created_at?: string | null }
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
  }
}
