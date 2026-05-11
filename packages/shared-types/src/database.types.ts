export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      asset_types: {
        Row: {
          capacity_m: number | null;
          code: string;
          created_at: string | null;
          has_gps: boolean | null;
          id: string;
          name: string;
          notes: string | null;
          requires_odometer_photo: boolean | null;
        };
        Insert: {
          capacity_m?: number | null;
          code: string;
          created_at?: string | null;
          has_gps?: boolean | null;
          id?: string;
          name: string;
          notes?: string | null;
          requires_odometer_photo?: boolean | null;
        };
        Update: {
          capacity_m?: number | null;
          code?: string;
          created_at?: string | null;
          has_gps?: boolean | null;
          id?: string;
          name?: string;
          notes?: string | null;
          requires_odometer_photo?: boolean | null;
        };
        Relationships: [];
      };
      assets: {
        Row: {
          asset_type_id: string;
          assigned_driver_id: string | null;
          created_at: string | null;
          current_book_value: number;
          id: string;
          inspection_expires_at: string | null;
          insurance_expires_at: string | null;
          legal_entity_id: string | null;
          monthly_fixed_cost: number;
          needs_update: boolean | null;
          notes: string | null;
          odometer_current: number;
          opti24_card_number: string | null;
          reg_number: string;
          remaining_depreciation_months: number | null;
          short_name: string;
          sold_at: string | null;
          status: Database['public']['Enums']['asset_status'];
          updated_at: string | null;
          wialon_id: string | null;
          year: number | null;
        };
        Insert: {
          asset_type_id: string;
          assigned_driver_id?: string | null;
          created_at?: string | null;
          current_book_value?: number;
          id?: string;
          inspection_expires_at?: string | null;
          insurance_expires_at?: string | null;
          legal_entity_id?: string | null;
          monthly_fixed_cost?: number;
          needs_update?: boolean | null;
          notes?: string | null;
          odometer_current?: number;
          opti24_card_number?: string | null;
          reg_number: string;
          remaining_depreciation_months?: number | null;
          short_name: string;
          sold_at?: string | null;
          status?: Database['public']['Enums']['asset_status'];
          updated_at?: string | null;
          wialon_id?: string | null;
          year?: number | null;
        };
        Update: {
          asset_type_id?: string;
          assigned_driver_id?: string | null;
          created_at?: string | null;
          current_book_value?: number;
          id?: string;
          inspection_expires_at?: string | null;
          insurance_expires_at?: string | null;
          legal_entity_id?: string | null;
          monthly_fixed_cost?: number;
          needs_update?: boolean | null;
          notes?: string | null;
          odometer_current?: number;
          opti24_card_number?: string | null;
          reg_number?: string;
          remaining_depreciation_months?: number | null;
          short_name?: string;
          sold_at?: string | null;
          status?: Database['public']['Enums']['asset_status'];
          updated_at?: string | null;
          wialon_id?: string | null;
          year?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'assets_asset_type_id_fkey';
            columns: ['asset_type_id'];
            isOneToOne: false;
            referencedRelation: 'asset_types';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assets_assigned_driver_id_fkey';
            columns: ['assigned_driver_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assets_legal_entity_id_fkey';
            columns: ['legal_entity_id'];
            isOneToOne: false;
            referencedRelation: 'legal_entities';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          changed_at: string | null;
          changed_by: string | null;
          id: string;
          new_values: Json | null;
          old_values: Json | null;
          record_id: string;
          table_name: string;
        };
        Insert: {
          action: string;
          changed_at?: string | null;
          changed_by?: string | null;
          id?: string;
          new_values?: Json | null;
          old_values?: Json | null;
          record_id: string;
          table_name: string;
        };
        Update: {
          action?: string;
          changed_at?: string | null;
          changed_by?: string | null;
          id?: string;
          new_values?: Json | null;
          old_values?: Json | null;
          record_id?: string;
          table_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_log_changed_by_fkey';
            columns: ['changed_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      cash_collections: {
        Row: {
          amount: number;
          collected_by: string;
          created_at: string;
          driver_id: string;
          id: string;
          note: string | null;
        };
        Insert: {
          amount: number;
          collected_by: string;
          created_at?: string;
          driver_id: string;
          id?: string;
          note?: string | null;
        };
        Update: {
          amount?: number;
          collected_by?: string;
          created_at?: string;
          driver_id?: string;
          id?: string;
          note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'cash_collections_collected_by_fkey';
            columns: ['collected_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cash_collections_driver_id_fkey';
            columns: ['driver_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      counterparties: {
        Row: {
          created_at: string | null;
          credit_limit: number | null;
          id: string;
          is_active: boolean | null;
          name: string;
          notes: string | null;
          payable_amount: number;
          phone: string | null;
          type: Database['public']['Enums']['counterparty_type'];
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          credit_limit?: number | null;
          id?: string;
          is_active?: boolean | null;
          name: string;
          notes?: string | null;
          payable_amount?: number;
          phone?: string | null;
          type?: Database['public']['Enums']['counterparty_type'];
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          credit_limit?: number | null;
          id?: string;
          is_active?: boolean | null;
          name?: string;
          notes?: string | null;
          payable_amount?: number;
          phone?: string | null;
          type?: Database['public']['Enums']['counterparty_type'];
          updated_at?: string | null;
        };
        Relationships: [];
      };
      defect_log: {
        Row: {
          asset_id: string;
          created_at: string | null;
          description: string;
          dismissed_reason: string | null;
          fixed_at: string | null;
          fixed_in_service_order_id: string | null;
          found_by: string;
          found_in_service_order_id: string | null;
          id: string;
          photo_urls: string[] | null;
          status: Database['public']['Enums']['defect_status'];
          unit: string;
          urgency: Database['public']['Enums']['defect_urgency'];
        };
        Insert: {
          asset_id: string;
          created_at?: string | null;
          description: string;
          dismissed_reason?: string | null;
          fixed_at?: string | null;
          fixed_in_service_order_id?: string | null;
          found_by: string;
          found_in_service_order_id?: string | null;
          id?: string;
          photo_urls?: string[] | null;
          status?: Database['public']['Enums']['defect_status'];
          unit: string;
          urgency?: Database['public']['Enums']['defect_urgency'];
        };
        Update: {
          asset_id?: string;
          created_at?: string | null;
          description?: string;
          dismissed_reason?: string | null;
          fixed_at?: string | null;
          fixed_in_service_order_id?: string | null;
          found_by?: string;
          found_in_service_order_id?: string | null;
          id?: string;
          photo_urls?: string[] | null;
          status?: Database['public']['Enums']['defect_status'];
          unit?: string;
          urgency?: Database['public']['Enums']['defect_urgency'];
        };
        Relationships: [
          {
            foreignKeyName: 'defect_log_asset_id_fkey';
            columns: ['asset_id'];
            isOneToOne: false;
            referencedRelation: 'assets';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'defect_log_fixed_in_service_order_id_fkey';
            columns: ['fixed_in_service_order_id'];
            isOneToOne: false;
            referencedRelation: 'service_orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'defect_log_found_by_fkey';
            columns: ['found_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'defect_log_found_in_service_order_id_fkey';
            columns: ['found_in_service_order_id'];
            isOneToOne: false;
            referencedRelation: 'service_orders';
            referencedColumns: ['id'];
          },
        ];
      };
      legal_entities: {
        Row: {
          bank_account: string | null;
          bank_name: string | null;
          bik: string | null;
          created_at: string | null;
          id: string;
          inn: string | null;
          is_active: boolean | null;
          name: string;
          tax_regime: string | null;
          type: string;
          updated_at: string | null;
        };
        Insert: {
          bank_account?: string | null;
          bank_name?: string | null;
          bik?: string | null;
          created_at?: string | null;
          id?: string;
          inn?: string | null;
          is_active?: boolean | null;
          name: string;
          tax_regime?: string | null;
          type: string;
          updated_at?: string | null;
        };
        Update: {
          bank_account?: string | null;
          bank_name?: string | null;
          bik?: string | null;
          created_at?: string | null;
          id?: string;
          inn?: string | null;
          is_active?: boolean | null;
          name?: string;
          tax_regime?: string | null;
          type?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      loans: {
        Row: {
          annual_rate: number | null;
          created_at: string;
          ends_at: string | null;
          id: string;
          is_active: boolean;
          lender_name: string;
          loan_type: string;
          monthly_payment: number | null;
          next_payment_date: string | null;
          notes: string | null;
          original_amount: number;
          purpose: string | null;
          remaining_amount: number;
          started_at: string;
          updated_at: string;
        };
        Insert: {
          annual_rate?: number | null;
          created_at?: string;
          ends_at?: string | null;
          id?: string;
          is_active?: boolean;
          lender_name: string;
          loan_type: string;
          monthly_payment?: number | null;
          next_payment_date?: string | null;
          notes?: string | null;
          original_amount: number;
          purpose?: string | null;
          remaining_amount: number;
          started_at: string;
          updated_at?: string;
        };
        Update: {
          annual_rate?: number | null;
          created_at?: string;
          ends_at?: string | null;
          id?: string;
          is_active?: boolean;
          lender_name?: string;
          loan_type?: string;
          monthly_payment?: number | null;
          next_payment_date?: string | null;
          notes?: string | null;
          original_amount?: number;
          purpose?: string | null;
          remaining_amount?: number;
          started_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      maintenance_regulations: {
        Row: {
          asset_type_id: string;
          created_at: string | null;
          id: string;
          interval_km: number | null;
          interval_months: number | null;
          is_active: boolean | null;
          notes: string | null;
          work_name: string;
        };
        Insert: {
          asset_type_id: string;
          created_at?: string | null;
          id?: string;
          interval_km?: number | null;
          interval_months?: number | null;
          is_active?: boolean | null;
          notes?: string | null;
          work_name: string;
        };
        Update: {
          asset_type_id?: string;
          created_at?: string | null;
          id?: string;
          interval_km?: number | null;
          interval_months?: number | null;
          is_active?: boolean | null;
          notes?: string | null;
          work_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'maintenance_regulations_asset_type_id_fkey';
            columns: ['asset_type_id'];
            isOneToOne: false;
            referencedRelation: 'asset_types';
            referencedColumns: ['id'];
          },
        ];
      };
      part_movements: {
        Row: {
          counterparty_id: string | null;
          created_at: string | null;
          created_by: string;
          direction: string;
          id: string;
          notes: string | null;
          part_id: string;
          quantity: number;
          service_order_id: string | null;
          transaction_id: string | null;
          unit_price: number | null;
        };
        Insert: {
          counterparty_id?: string | null;
          created_at?: string | null;
          created_by: string;
          direction: string;
          id?: string;
          notes?: string | null;
          part_id: string;
          quantity: number;
          service_order_id?: string | null;
          transaction_id?: string | null;
          unit_price?: number | null;
        };
        Update: {
          counterparty_id?: string | null;
          created_at?: string | null;
          created_by?: string;
          direction?: string;
          id?: string;
          notes?: string | null;
          part_id?: string;
          quantity?: number;
          service_order_id?: string | null;
          transaction_id?: string | null;
          unit_price?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'part_movements_counterparty_id_fkey';
            columns: ['counterparty_id'];
            isOneToOne: false;
            referencedRelation: 'counterparties';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'part_movements_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'part_movements_part_id_fkey';
            columns: ['part_id'];
            isOneToOne: false;
            referencedRelation: 'parts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'part_movements_service_order_id_fkey';
            columns: ['service_order_id'];
            isOneToOne: false;
            referencedRelation: 'service_orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'part_movements_transaction_id_fkey';
            columns: ['transaction_id'];
            isOneToOne: false;
            referencedRelation: 'transactions';
            referencedColumns: ['id'];
          },
        ];
      };
      parts: {
        Row: {
          article: string | null;
          category: string;
          client_price: number;
          compatible_asset_type_ids: string[] | null;
          created_at: string | null;
          id: string;
          is_active: boolean | null;
          min_stock: number | null;
          name: string;
          purchase_price: number;
          unit: string;
          updated_at: string | null;
        };
        Insert: {
          article?: string | null;
          category: string;
          client_price?: number;
          compatible_asset_type_ids?: string[] | null;
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          min_stock?: number | null;
          name: string;
          purchase_price?: number;
          unit?: string;
          updated_at?: string | null;
        };
        Update: {
          article?: string | null;
          category?: string;
          client_price?: number;
          compatible_asset_type_ids?: string[] | null;
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          min_stock?: number | null;
          name?: string;
          purchase_price?: number;
          unit?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      payroll_periods: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          created_at: string | null;
          id: string;
          period_end: string;
          period_start: string;
          status: string;
          total_earned: number;
          total_paid: number;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string | null;
          id?: string;
          period_end: string;
          period_start: string;
          status?: string;
          total_earned?: number;
          total_paid?: number;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string | null;
          id?: string;
          period_end?: string;
          period_start?: string;
          status?: string;
          total_earned?: number;
          total_paid?: number;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payroll_periods_approved_by_fkey';
            columns: ['approved_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payroll_periods_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      payroll_rules: {
        Row: {
          asset_type_id: string | null;
          created_at: string | null;
          description: string | null;
          id: string;
          is_active: boolean | null;
          name: string;
          role: Database['public']['Enums']['user_role'];
          rule_type: string;
          trip_type: Database['public']['Enums']['trip_type'] | null;
          updated_at: string | null;
          value: number;
        };
        Insert: {
          asset_type_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          name: string;
          role: Database['public']['Enums']['user_role'];
          rule_type: string;
          trip_type?: Database['public']['Enums']['trip_type'] | null;
          updated_at?: string | null;
          value: number;
        };
        Update: {
          asset_type_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          name?: string;
          role?: Database['public']['Enums']['user_role'];
          rule_type?: string;
          trip_type?: Database['public']['Enums']['trip_type'] | null;
          updated_at?: string | null;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'payroll_rules_asset_type_id_fkey';
            columns: ['asset_type_id'];
            isOneToOne: false;
            referencedRelation: 'asset_types';
            referencedColumns: ['id'];
          },
        ];
      };
      purchase_requests: {
        Row: {
          approved_by: string | null;
          created_at: string | null;
          custom_part_name: string | null;
          id: string;
          notes: string | null;
          part_id: string | null;
          quantity: number;
          requested_by: string;
          service_order_id: string | null;
          status: string;
          updated_at: string | null;
        };
        Insert: {
          approved_by?: string | null;
          created_at?: string | null;
          custom_part_name?: string | null;
          id?: string;
          notes?: string | null;
          part_id?: string | null;
          quantity: number;
          requested_by: string;
          service_order_id?: string | null;
          status?: string;
          updated_at?: string | null;
        };
        Update: {
          approved_by?: string | null;
          created_at?: string | null;
          custom_part_name?: string | null;
          id?: string;
          notes?: string | null;
          part_id?: string | null;
          quantity?: number;
          requested_by?: string;
          service_order_id?: string | null;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'purchase_requests_approved_by_fkey';
            columns: ['approved_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'purchase_requests_part_id_fkey';
            columns: ['part_id'];
            isOneToOne: false;
            referencedRelation: 'parts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'purchase_requests_requested_by_fkey';
            columns: ['requested_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'purchase_requests_service_order_id_fkey';
            columns: ['service_order_id'];
            isOneToOne: false;
            referencedRelation: 'service_orders';
            referencedColumns: ['id'];
          },
        ];
      };
      service_order_parts: {
        Row: {
          client_price: number;
          created_at: string | null;
          id: string;
          part_id: string;
          part_movement_id: string | null;
          quantity: number;
          service_order_id: string;
          service_order_work_id: string | null;
          status: string;
          unit_price: number;
          updated_at: string | null;
        };
        Insert: {
          client_price: number;
          created_at?: string | null;
          id?: string;
          part_id: string;
          part_movement_id?: string | null;
          quantity: number;
          service_order_id: string;
          service_order_work_id?: string | null;
          status?: string;
          unit_price: number;
          updated_at?: string | null;
        };
        Update: {
          client_price?: number;
          created_at?: string | null;
          id?: string;
          part_id?: string;
          part_movement_id?: string | null;
          quantity?: number;
          service_order_id?: string;
          service_order_work_id?: string | null;
          status?: string;
          unit_price?: number;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'service_order_parts_part_id_fkey';
            columns: ['part_id'];
            isOneToOne: false;
            referencedRelation: 'parts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_order_parts_part_movement_id_fkey';
            columns: ['part_movement_id'];
            isOneToOne: false;
            referencedRelation: 'part_movements';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_order_parts_service_order_id_fkey';
            columns: ['service_order_id'];
            isOneToOne: false;
            referencedRelation: 'service_orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_order_parts_service_order_work_id_fkey';
            columns: ['service_order_work_id'];
            isOneToOne: false;
            referencedRelation: 'service_order_works';
            referencedColumns: ['id'];
          },
        ];
      };
      service_order_works: {
        Row: {
          actual_minutes: number | null;
          created_at: string | null;
          custom_work_description: string | null;
          custom_work_name: string | null;
          id: string;
          manual_entry: boolean | null;
          norm_minutes: number;
          notes: string | null;
          price_client: number;
          requires_admin_review: boolean | null;
          service_order_id: string;
          status: string;
          updated_at: string | null;
          work_catalog_id: string | null;
        };
        Insert: {
          actual_minutes?: number | null;
          created_at?: string | null;
          custom_work_description?: string | null;
          custom_work_name?: string | null;
          id?: string;
          manual_entry?: boolean | null;
          norm_minutes: number;
          notes?: string | null;
          price_client?: number;
          requires_admin_review?: boolean | null;
          service_order_id: string;
          status?: string;
          updated_at?: string | null;
          work_catalog_id?: string | null;
        };
        Update: {
          actual_minutes?: number | null;
          created_at?: string | null;
          custom_work_description?: string | null;
          custom_work_name?: string | null;
          id?: string;
          manual_entry?: boolean | null;
          norm_minutes?: number;
          notes?: string | null;
          price_client?: number;
          requires_admin_review?: boolean | null;
          service_order_id?: string;
          status?: string;
          updated_at?: string | null;
          work_catalog_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'service_order_works_service_order_id_fkey';
            columns: ['service_order_id'];
            isOneToOne: false;
            referencedRelation: 'service_orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_order_works_work_catalog_id_fkey';
            columns: ['work_catalog_id'];
            isOneToOne: false;
            referencedRelation: 'work_catalog';
            referencedColumns: ['id'];
          },
        ];
      };
      service_orders: {
        Row: {
          admin_note: string | null;
          approved_at: string | null;
          approved_by: string | null;
          asset_id: string | null;
          assigned_mechanic_id: string | null;
          cancelled_reason: string | null;
          client_name: string | null;
          client_phone: string | null;
          client_vehicle_brand: string | null;
          client_vehicle_model: string | null;
          client_vehicle_reg: string | null;
          counterparty_id: string | null;
          created_at: string | null;
          created_by: string;
          id: string;
          is_ready_for_pickup: boolean | null;
          lifecycle_status: Database['public']['Enums']['lifecycle_status'];
          machine_type: Database['public']['Enums']['service_order_machine_type'];
          mechanic_note: string | null;
          mechanic_pay: number | null;
          odometer_end: number | null;
          odometer_start: number | null;
          order_number: number;
          priority: string;
          problem_description: string | null;
          problem_photo_urls: string[] | null;
          status: string;
          updated_at: string | null;
        };
        Insert: {
          admin_note?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          asset_id?: string | null;
          assigned_mechanic_id?: string | null;
          cancelled_reason?: string | null;
          client_name?: string | null;
          client_phone?: string | null;
          client_vehicle_brand?: string | null;
          client_vehicle_model?: string | null;
          client_vehicle_reg?: string | null;
          counterparty_id?: string | null;
          created_at?: string | null;
          created_by: string;
          id?: string;
          is_ready_for_pickup?: boolean | null;
          lifecycle_status?: Database['public']['Enums']['lifecycle_status'];
          machine_type?: Database['public']['Enums']['service_order_machine_type'];
          mechanic_note?: string | null;
          mechanic_pay?: number | null;
          odometer_end?: number | null;
          odometer_start?: number | null;
          order_number?: number;
          priority?: string;
          problem_description?: string | null;
          problem_photo_urls?: string[] | null;
          status?: string;
          updated_at?: string | null;
        };
        Update: {
          admin_note?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          asset_id?: string | null;
          assigned_mechanic_id?: string | null;
          cancelled_reason?: string | null;
          client_name?: string | null;
          client_phone?: string | null;
          client_vehicle_brand?: string | null;
          client_vehicle_model?: string | null;
          client_vehicle_reg?: string | null;
          counterparty_id?: string | null;
          created_at?: string | null;
          created_by?: string;
          id?: string;
          is_ready_for_pickup?: boolean | null;
          lifecycle_status?: Database['public']['Enums']['lifecycle_status'];
          machine_type?: Database['public']['Enums']['service_order_machine_type'];
          mechanic_note?: string | null;
          mechanic_pay?: number | null;
          odometer_end?: number | null;
          odometer_start?: number | null;
          order_number?: number;
          priority?: string;
          problem_description?: string | null;
          problem_photo_urls?: string[] | null;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'service_orders_approved_by_fkey';
            columns: ['approved_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_orders_asset_id_fkey';
            columns: ['asset_id'];
            isOneToOne: false;
            referencedRelation: 'assets';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_orders_assigned_mechanic_id_fkey';
            columns: ['assigned_mechanic_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_orders_counterparty_id_fkey';
            columns: ['counterparty_id'];
            isOneToOne: false;
            referencedRelation: 'counterparties';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_orders_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      transaction_categories: {
        Row: {
          code: string;
          created_at: string | null;
          direction: Database['public']['Enums']['transaction_direction'];
          id: string;
          is_active: boolean | null;
          name: string;
        };
        Insert: {
          code: string;
          created_at?: string | null;
          direction: Database['public']['Enums']['transaction_direction'];
          id?: string;
          is_active?: boolean | null;
          name: string;
        };
        Update: {
          code?: string;
          created_at?: string | null;
          direction?: Database['public']['Enums']['transaction_direction'];
          id?: string;
          is_active?: boolean | null;
          name?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          amount: number;
          asset_id: string | null;
          cancelled_reason: string | null;
          category_id: string;
          counterparty_id: string | null;
          created_at: string | null;
          created_by: string;
          description: string | null;
          direction: Database['public']['Enums']['transaction_direction'];
          from_wallet_id: string | null;
          id: string;
          idempotency_key: string;
          lifecycle_status: Database['public']['Enums']['lifecycle_status'];
          photo_url: string | null;
          related_user_id: string | null;
          service_order_id: string | null;
          settlement_status: Database['public']['Enums']['settlement_status'];
          to_wallet_id: string | null;
          transaction_date: string;
          trip_order_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          amount: number;
          asset_id?: string | null;
          cancelled_reason?: string | null;
          category_id: string;
          counterparty_id?: string | null;
          created_at?: string | null;
          created_by: string;
          description?: string | null;
          direction: Database['public']['Enums']['transaction_direction'];
          from_wallet_id?: string | null;
          id?: string;
          idempotency_key: string;
          lifecycle_status?: Database['public']['Enums']['lifecycle_status'];
          photo_url?: string | null;
          related_user_id?: string | null;
          service_order_id?: string | null;
          settlement_status?: Database['public']['Enums']['settlement_status'];
          to_wallet_id?: string | null;
          transaction_date?: string;
          trip_order_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          amount?: number;
          asset_id?: string | null;
          cancelled_reason?: string | null;
          category_id?: string;
          counterparty_id?: string | null;
          created_at?: string | null;
          created_by?: string;
          description?: string | null;
          direction?: Database['public']['Enums']['transaction_direction'];
          from_wallet_id?: string | null;
          id?: string;
          idempotency_key?: string;
          lifecycle_status?: Database['public']['Enums']['lifecycle_status'];
          photo_url?: string | null;
          related_user_id?: string | null;
          service_order_id?: string | null;
          settlement_status?: Database['public']['Enums']['settlement_status'];
          to_wallet_id?: string | null;
          transaction_date?: string;
          trip_order_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_transactions_service_order';
            columns: ['service_order_id'];
            isOneToOne: false;
            referencedRelation: 'service_orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transactions_asset_id_fkey';
            columns: ['asset_id'];
            isOneToOne: false;
            referencedRelation: 'assets';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transactions_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'transaction_categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transactions_counterparty_id_fkey';
            columns: ['counterparty_id'];
            isOneToOne: false;
            referencedRelation: 'counterparties';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transactions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transactions_from_wallet_id_fkey';
            columns: ['from_wallet_id'];
            isOneToOne: false;
            referencedRelation: 'wallets';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transactions_related_user_id_fkey';
            columns: ['related_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transactions_to_wallet_id_fkey';
            columns: ['to_wallet_id'];
            isOneToOne: false;
            referencedRelation: 'wallets';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transactions_trip_order_id_fkey';
            columns: ['trip_order_id'];
            isOneToOne: false;
            referencedRelation: 'trip_orders';
            referencedColumns: ['id'];
          },
        ];
      };
      trip_expenses: {
        Row: {
          amount: number;
          category_id: string;
          created_at: string | null;
          description: string | null;
          id: string;
          idempotency_key: string;
          linked_expense_tx_id: string | null;
          payment_method: string;
          receipt_photo: string | null;
          trip_id: string;
        };
        Insert: {
          amount: number;
          category_id: string;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          idempotency_key: string;
          linked_expense_tx_id?: string | null;
          payment_method: string;
          receipt_photo?: string | null;
          trip_id: string;
        };
        Update: {
          amount?: number;
          category_id?: string;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          idempotency_key?: string;
          linked_expense_tx_id?: string | null;
          payment_method?: string;
          receipt_photo?: string | null;
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trip_expenses_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'transaction_categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trip_expenses_linked_expense_tx_id_fkey';
            columns: ['linked_expense_tx_id'];
            isOneToOne: false;
            referencedRelation: 'transactions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trip_expenses_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      trip_orders: {
        Row: {
          amount: number;
          cancelled_reason: string | null;
          counterparty_id: string | null;
          created_at: string | null;
          description: string | null;
          driver_pay: number;
          id: string;
          idempotency_key: string;
          lifecycle_status: Database['public']['Enums']['lifecycle_status'];
          loader_id: string | null;
          loader_pay: number;
          loader2_id: string | null;
          loader2_pay: number;
          payment_method: Database['public']['Enums']['payment_method'];
          settlement_status: Database['public']['Enums']['settlement_status'];
          trip_id: string;
          updated_at: string | null;
        };
        Insert: {
          amount: number;
          cancelled_reason?: string | null;
          counterparty_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          driver_pay?: number;
          id?: string;
          idempotency_key: string;
          lifecycle_status?: Database['public']['Enums']['lifecycle_status'];
          loader_id?: string | null;
          loader_pay?: number;
          loader2_id?: string | null;
          loader2_pay?: number;
          payment_method: Database['public']['Enums']['payment_method'];
          settlement_status?: Database['public']['Enums']['settlement_status'];
          trip_id: string;
          updated_at?: string | null;
        };
        Update: {
          amount?: number;
          cancelled_reason?: string | null;
          counterparty_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          driver_pay?: number;
          id?: string;
          idempotency_key?: string;
          lifecycle_status?: Database['public']['Enums']['lifecycle_status'];
          loader_id?: string | null;
          loader_pay?: number;
          loader2_id?: string | null;
          loader2_pay?: number;
          payment_method?: Database['public']['Enums']['payment_method'];
          settlement_status?: Database['public']['Enums']['settlement_status'];
          trip_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'trip_orders_counterparty_id_fkey';
            columns: ['counterparty_id'];
            isOneToOne: false;
            referencedRelation: 'counterparties';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trip_orders_loader_id_fkey';
            columns: ['loader_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trip_orders_loader2_id_fkey';
            columns: ['loader2_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trip_orders_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      trips: {
        Row: {
          admin_note: string | null;
          approved_at: string | null;
          approved_by: string | null;
          asset_id: string;
          created_at: string | null;
          driver_id: string;
          driver_note: string | null;
          ended_at: string | null;
          id: string;
          lifecycle_status: Database['public']['Enums']['lifecycle_status'];
          loader_id: string | null;
          loader2_id: string | null;
          loaders_count: number;
          odometer_end: number | null;
          odometer_photo_end_url: string | null;
          odometer_photo_start_url: string | null;
          odometer_start: number;
          started_at: string;
          status: Database['public']['Enums']['trip_status'];
          trip_number: number;
          trip_type: Database['public']['Enums']['trip_type'];
          updated_at: string | null;
        };
        Insert: {
          admin_note?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          asset_id: string;
          created_at?: string | null;
          driver_id: string;
          driver_note?: string | null;
          ended_at?: string | null;
          id?: string;
          lifecycle_status?: Database['public']['Enums']['lifecycle_status'];
          loader_id?: string | null;
          loader2_id?: string | null;
          loaders_count?: number;
          odometer_end?: number | null;
          odometer_photo_end_url?: string | null;
          odometer_photo_start_url?: string | null;
          odometer_start: number;
          started_at?: string;
          status?: Database['public']['Enums']['trip_status'];
          trip_number?: number;
          trip_type?: Database['public']['Enums']['trip_type'];
          updated_at?: string | null;
        };
        Update: {
          admin_note?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          asset_id?: string;
          created_at?: string | null;
          driver_id?: string;
          driver_note?: string | null;
          ended_at?: string | null;
          id?: string;
          lifecycle_status?: Database['public']['Enums']['lifecycle_status'];
          loader_id?: string | null;
          loader2_id?: string | null;
          loaders_count?: number;
          odometer_end?: number | null;
          odometer_photo_end_url?: string | null;
          odometer_photo_start_url?: string | null;
          odometer_start?: number;
          started_at?: string;
          status?: Database['public']['Enums']['trip_status'];
          trip_number?: number;
          trip_type?: Database['public']['Enums']['trip_type'];
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'trips_approved_by_fkey';
            columns: ['approved_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trips_asset_id_fkey';
            columns: ['asset_id'];
            isOneToOne: false;
            referencedRelation: 'assets';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trips_driver_id_fkey';
            columns: ['driver_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trips_loader_id_fkey';
            columns: ['loader_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trips_loader2_id_fkey';
            columns: ['loader2_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      users: {
        Row: {
          auto_settle: boolean;
          created_at: string | null;
          current_asset_id: string | null;
          id: string;
          is_active: boolean | null;
          max_user_id: string | null;
          name: string;
          notes: string | null;
          phone: string | null;
          roles: Database['public']['Enums']['user_role'][];
          updated_at: string | null;
        };
        Insert: {
          auto_settle?: boolean;
          created_at?: string | null;
          current_asset_id?: string | null;
          id?: string;
          is_active?: boolean | null;
          max_user_id?: string | null;
          name: string;
          notes?: string | null;
          phone?: string | null;
          roles?: Database['public']['Enums']['user_role'][];
          updated_at?: string | null;
        };
        Update: {
          auto_settle?: boolean;
          created_at?: string | null;
          current_asset_id?: string | null;
          id?: string;
          is_active?: boolean | null;
          max_user_id?: string | null;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          roles?: Database['public']['Enums']['user_role'][];
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_users_current_asset';
            columns: ['current_asset_id'];
            isOneToOne: false;
            referencedRelation: 'assets';
            referencedColumns: ['id'];
          },
        ];
      };
      wallets: {
        Row: {
          created_at: string | null;
          id: string;
          is_active: boolean | null;
          legal_entity_id: string | null;
          name: string;
          owner_user_id: string | null;
          type: Database['public']['Enums']['wallet_type'];
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          legal_entity_id?: string | null;
          name: string;
          owner_user_id?: string | null;
          type: Database['public']['Enums']['wallet_type'];
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          legal_entity_id?: string | null;
          name?: string;
          owner_user_id?: string | null;
          type?: Database['public']['Enums']['wallet_type'];
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'wallets_legal_entity_id_fkey';
            columns: ['legal_entity_id'];
            isOneToOne: false;
            referencedRelation: 'legal_entities';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wallets_owner_user_id_fkey';
            columns: ['owner_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      work_catalog: {
        Row: {
          applicable_asset_type_ids: string[] | null;
          code: string;
          created_at: string | null;
          default_price_client: number;
          description: string | null;
          id: string;
          internal_cost_rate: number;
          is_active: boolean | null;
          name: string;
          norm_minutes: number;
          updated_at: string | null;
        };
        Insert: {
          applicable_asset_type_ids?: string[] | null;
          code: string;
          created_at?: string | null;
          default_price_client?: number;
          description?: string | null;
          id?: string;
          internal_cost_rate?: number;
          is_active?: boolean | null;
          name: string;
          norm_minutes?: number;
          updated_at?: string | null;
        };
        Update: {
          applicable_asset_type_ids?: string[] | null;
          code?: string;
          created_at?: string | null;
          default_price_client?: number;
          description?: string | null;
          id?: string;
          internal_cost_rate?: number;
          is_active?: boolean | null;
          name?: string;
          norm_minutes?: number;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      work_time_logs: {
        Row: {
          created_at: string | null;
          id: string;
          manual_entry: boolean | null;
          pause_reason: string | null;
          pause_reason_text: string | null;
          service_order_work_id: string;
          started_at: string;
          status: string;
          stopped_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          manual_entry?: boolean | null;
          pause_reason?: string | null;
          pause_reason_text?: string | null;
          service_order_work_id: string;
          started_at?: string;
          status?: string;
          stopped_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          manual_entry?: boolean | null;
          pause_reason?: string | null;
          pause_reason_text?: string | null;
          service_order_work_id?: string;
          started_at?: string;
          status?: string;
          stopped_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'work_time_logs_service_order_work_id_fkey';
            columns: ['service_order_work_id'];
            isOneToOne: false;
            referencedRelation: 'service_order_works';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      auth_user_roles: {
        Args: never;
        Returns: Database['public']['Enums']['user_role'][];
      };
      is_admin_or_owner: { Args: never; Returns: boolean };
      show_limit: { Args: never; Returns: number };
      show_trgm: { Args: { '': string }; Returns: string[] };
    };
    Enums: {
      asset_status: 'active' | 'repair' | 'reserve' | 'sold' | 'written_off';
      counterparty_type: 'client' | 'supplier' | 'both';
      defect_status: 'open' | 'planned' | 'fixed' | 'dismissed';
      defect_urgency: 'critical' | 'soon' | 'low';
      lifecycle_status: 'draft' | 'approved' | 'returned' | 'cancelled';
      payment_method: 'cash' | 'qr' | 'bank_invoice' | 'debt_cash' | 'card_driver';
      service_order_machine_type: 'own' | 'client';
      settlement_status: 'pending' | 'completed';
      transaction_direction: 'income' | 'expense' | 'transfer';
      trip_status: 'in_progress' | 'completed' | 'cancelled';
      trip_type: 'local' | 'intercity' | 'moving' | 'hourly';
      user_role:
        | 'owner'
        | 'admin'
        | 'driver'
        | 'loader'
        | 'mechanic'
        | 'mechanic_lead'
        | 'accountant';
      wallet_type:
        | 'bank_account'
        | 'cash_register'
        | 'fuel_card'
        | 'driver_accountable'
        | 'owner_personal'
        | 'company_card';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      asset_status: ['active', 'repair', 'reserve', 'sold', 'written_off'],
      counterparty_type: ['client', 'supplier', 'both'],
      defect_status: ['open', 'planned', 'fixed', 'dismissed'],
      defect_urgency: ['critical', 'soon', 'low'],
      lifecycle_status: ['draft', 'approved', 'returned', 'cancelled'],
      payment_method: ['cash', 'qr', 'bank_invoice', 'debt_cash', 'card_driver'],
      service_order_machine_type: ['own', 'client'],
      settlement_status: ['pending', 'completed'],
      transaction_direction: ['income', 'expense', 'transfer'],
      trip_status: ['in_progress', 'completed', 'cancelled'],
      trip_type: ['local', 'intercity', 'moving', 'hourly'],
      user_role: ['owner', 'admin', 'driver', 'loader', 'mechanic', 'mechanic_lead', 'accountant'],
      wallet_type: [
        'bank_account',
        'cash_register',
        'fuel_card',
        'driver_accountable',
        'owner_personal',
        'company_card',
      ],
    },
  },
} as const;
