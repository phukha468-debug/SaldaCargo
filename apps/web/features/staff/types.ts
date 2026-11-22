export type UserRole =
  | 'owner'
  | 'admin'
  | 'driver'
  | 'loader'
  | 'mechanic'
  | 'mechanic_lead'
  | 'accountant'
  | 'welder'
  | 'painter'
  | 'electrician'
  | 'handyman'
  | 'cleaner';

export type PassportData = Record<string, string | number | boolean | null | undefined>;

export type PayrollUser = {
  id: string;
  name: string;
  roles: UserRole[];
  auto_settle: boolean;
  max_user_id: string | null;
  pin_code?: string | null;
  current_asset_id?: string | null;
  phone: string | null;
  notes: string | null;
  passport_data?: PassportData | null;
  is_officially_employed?: boolean;
  official_salary_amount?: string;
  official_salary_day?: number;
  has_court_orders?: boolean;
  court_order_pct?: string;
  court_order_notes?: string | null;
  asset: { short_name: string; reg_number: string } | null;
  shifts: number;
  earned: string;
  paid: string;
  debt: string;
  unconfirmed_debt: string;
  advance_balance: string;
  advance_offset: string;
  payout: string;
  accountable_hold?: number;
  all_time_paid: string;
  history: Array<{
    id: string;
    amount: string;
    direction: string;
    description: string;
    created_at: string;
    updated_at?: string;
    settlement_status: string;
    category_id: string;
    employee_confirmed: boolean | null;
    from_wallet_id?: string | null;
  }>;
};

export type PayrollResponse = {
  drivers: PayrollUser[];
  loaders: PayrollUser[];
  mechanics: PayrollUser[];
  office: PayrollUser[];
  cleaners?: PayrollUser[];
  total_earned_month: string;
  total_paid_month: string;
  total_debt_alltime: string;
  total_payout_alltime: string;
  total_paid_alltime: string;
  total_accountable_hold?: string;
};

export type StaffUser = {
  id: string;
  name: string;
  phone: string | null;
  max_user_id: string | null;
  pin_code?: string | null;
  roles: UserRole[];
  current_asset_id: string | null;
  auto_settle: boolean;
  is_active: boolean;
  notes: string | null;
  passport_data?: PassportData | null;
  is_officially_employed?: boolean;
  official_salary_amount?: string;
  official_salary_day?: number;
  has_court_orders?: boolean;
  court_order_pct?: string;
  court_order_notes?: string | null;
};

export type Asset = { id: string; short_name: string; reg_number: string };

export type StaffTx = PayrollUser['history'][number] & {
  from_wallet?: { id: string; name: string; type: string } | null;
  transaction_date?: string | null;
  service_order_id?: string | null;
  trip_id?: string | null;
  service_order?: {
    id: string;
    order_number: number | string;
    machine_type: 'own' | 'client';
    client_name?: string | null;
    client_vehicle_brand?: string | null;
    client_vehicle_model?: string | null;
    client_vehicle_reg?: string | null;
    vehicle_label?: string;
    order_date?: string | null;
    created_at?: string | null;
    asset?: {
      id: string;
      short_name: string;
      reg_number: string;
    } | null;
  } | null;
  trip?: {
    id: string;
    trip_number?: string | number;
    vehicle_label?: string;
    started_at?: string | null;
    trip_date?: string | null;
    created_at?: string | null;
  } | null;
};

export type GroupedAccrualItem = {
  id: string;
  groupKey: string;
  isOrder: boolean;
  isTrip: boolean;
  title: string;
  orderNumber?: string;
  tripNumber?: string;
  service_order_id?: string | null;
  trip_id?: string | null;
  vehicle_desc?: string;
  eventDate?: string | null;
  paidDate?: string | null;
  category_id: string;
  source: string;
  latestDate: string;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  paidPct: number;
  settlement_status: 'completed' | 'pending' | 'partial';
  employee_confirmed?: boolean | null;
  works: Array<{
    id: string;
    title: string;
    amount: number;
    settlement_status: string;
    employee_confirmed: boolean | null;
    updated_at?: string | null;
    rawTx: StaffTx;
  }>;
};

export type GroupKey = 'drivers' | 'loaders' | 'workshop' | 'cleaners' | 'debts' | 'accountable';
