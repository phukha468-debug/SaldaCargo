export interface Counterparty {
  id: string;
  name: string;
}

export interface TripOrder {
  id: string;
  amount: string;
  driver_pay: string;
  loader_pay: string;
  loader2_pay: string;
  loader_id: string | null;
  loader2_id: string | null;
  loader: { id: string; name: string } | null;
  loader2: { id: string; name: string } | null;
  payment_method: string;
  settlement_status: string;
  lifecycle_status: string;
  counterparty_id: string | null;
  counterparty: { name: string } | null;
  invoice_paid_at?: string | null;
  updated_at?: string | null;
  description?: string | null;
  direction?: string;
  is_driver_loader?: boolean;
  driver_car_pay?: string | number;
  driver_loader_pay?: string | number;
  loaders_data?: Array<{ id: string; name?: string; pay?: string | number }>;
}

export interface TripForReview {
  id: string;
  trip_number: number;
  lifecycle_status: string;
  created_at?: string;
  started_at: string;
  ended_at: string | null;
  trip_type: string;
  odometer_start: number;
  odometer_end: number | null;
  driver_note: string | null;
  admin_note?: string | null;
  asset: {
    id?: string;
    short_name: string;
    reg_number: string;
    notes?: string | null;
    asset_type?: { code?: string | null; name?: string | null } | null;
  };
  driver: { id: string; name: string };
  loader: { id: string; name: string } | null;
  trip_orders: TripOrder[];
  trip_expenses: Array<{
    id: string;
    amount: string;
    payment_method: string;
    description: string | null;
    category: { name: string } | null;
  }>;
}

export interface ReviewServiceOrderWork {
  id: string;
  custom_work_name: string | null;
  work_description?: string | null;
  status: string;
  salary_paid: boolean;
  actual_minutes: number | null;
  price_client: string | null;
  norm_minutes: number | null;
  quantity?: number | null;
  mechanic_id: string | null;
  second_mechanic_id: string | null;
  mechanic_name?: string | null;
  second_mechanic_name?: string | null;
  work_catalog?: { name: string } | null;
  notes?: string | null;
}

export interface ReviewServiceOrder {
  id: string;
  order_number: number;
  machine_type: string;
  status: string;
  lifecycle_status: string;
  hourly_rate?: number | string | null;
  is_partial_work_review?: boolean;
  pending_review_works_count?: number;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  problem_description: string | null;
  admin_note?: string | null;
  mechanic_note: string | null;
  mechanic_pay: string | null;
  second_mechanic_pay: string | null;
  assigned_mechanic_id?: string | null;
  second_mechanic_id?: string | null;
  odometer_start?: number | null;
  odometer_end?: number | null;
  client_vehicle_brand?: string | null;
  client_vehicle_model?: string | null;
  client_vehicle_reg?: string | null;
  client_name?: string | null;
  asset?: {
    id?: string;
    short_name?: string;
    reg_number?: string;
    odometer_current?: number | null;
  } | null;
  mechanic?: { id: string; name: string; mechanic_salary_pct?: number | string | null } | null;
  second_mechanic?: {
    id: string;
    name: string;
    mechanic_salary_pct?: number | string | null;
  } | null;
  works?: ReviewServiceOrderWork[];
  parts?: Array<{
    id: string;
    custom_part_name: string | null;
    quantity: number;
    unit_price: string;
    client_price?: string | null;
    unit: string | null;
    part?: { name: string; unit: string | null } | null;
  }>;
}

export interface SettlementOrderItem {
  id: string;
  type: 'trip_order' | 'manual';
  amount: number;
}

export interface SettlementTransactionItem {
  id: string;
  amount: number;
  direction: 'income' | 'expense';
  description: string;
  created_at: string;
  counterparty_id: string | null;
  counterparty_name: string | null;
  orders: SettlementOrderItem[];
}
