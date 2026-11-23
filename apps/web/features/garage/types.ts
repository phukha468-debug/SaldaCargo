export type Mechanic = {
  id: string;
  name: string;
  roles?: string[];
  mechanic_salary_pct?: string | null;
};

export type Asset = {
  id: string;
  short_name: string;
  reg_number: string;
  odometer_current?: number | null;
};

export type OrderRow = {
  id: string;
  order_number: number;
  status: string;
  priority: string;
  machine_type: 'own' | 'client';
  problem_description: string;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  effective_date?: string | null;
  asset: Asset | null;
  client_vehicle_brand: string | null;
  client_vehicle_reg: string | null;
  client_name: string | null;
  mechanic: Mechanic | null;
  works: Array<{ id: string; status: string }>;
};

export type DetailWork = {
  id: string;
  status: string;
  salary_paid: boolean;
  quantity: number;
  norm_minutes: number;
  actual_minutes: number;
  price_client: string | null;
  work_description: string | null;
  custom_work_name: string | null;
  custom_work_description?: string | null;
  created_at?: string | null;
  mechanic_id: string | null;
  second_mechanic_id: string | null;
  notes?: string | null;
  work_catalog: { id: string; name: string; norm_minutes: number } | null;
  time_logs: Array<{ id: string; started_at: string; stopped_at: string | null; status: string }>;
};

export type MechanicWithPct = Mechanic & { mechanic_salary_pct: string | null };

export type OrderDetailPart = {
  id: string;
  quantity: number;
  custom_part_name: string | null;
  unit: string | null;
  unit_price: string | null;
  client_price: string | null;
  part: { id: string; name: string; unit: string } | null;
};

export type OrderDetail = Omit<OrderRow, 'works' | 'mechanic'> & {
  lifecycle_status: string;
  admin_note: string | null;
  mechanic_note: string | null;
  mechanic_pay: string | null;
  second_mechanic_pay: string | null;
  mechanic: MechanicWithPct | null;
  second_mechanic: MechanicWithPct | null;
  client_vehicle_model: string | null;
  client_phone: string | null;
  odometer_start: number | null;
  odometer_end: number | null;
  works: DetailWork[];
  parts: OrderDetailPart[];
  transactions?: Array<{
    id: string;
    amount: string;
    description: string;
    category_id: string;
    related_user_id: string | null;
    related_user: { name: string } | null;
  }>;
};

export type MaintenanceItem = {
  id: string;
  work_name: string;
  interval_km: number | null;
  interval_months: number | null;
  last_done_km: number | null;
  last_done_at: string | null;
  next_due_km: number | null;
  next_due_at: string | null;
  alert_status: string;
  created_at: string;
  asset: { id: string; short_name: string; reg_number: string; odometer_current: number } | null;
};

export type SettingsData = {
  sto: { hourly_rate: string; hourly_rate_own: string };
  mechanics: Array<{ id: string; name: string; mechanic_salary_pct: string }>;
};

export interface CounterpartyOption {
  id: string;
  name: string;
  phone: string | null;
}

export type TabOrder = Omit<OrderRow, 'works'> & {
  lifecycle_status?: string;
  payment_received?: boolean;
  mechanic_note?: string | null;
  admin_note?: string | null;
  mechanic_pay?: string | number | null;
  second_mechanic_pay?: string | number | null;
  odometer_start?: number | null;
  odometer_end?: number | null;
  client_vehicle_model?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  works: Array<{
    id: string;
    status: string;
    salary_paid?: boolean;
    custom_work_name?: string | null;
    actual_minutes?: number | null;
    price_client?: string | null;
    norm_minutes?: number;
    work_catalog?: { name: string } | null;
  }>;
  parts?: Array<{
    id: string;
    custom_part_name?: string | null;
    quantity: number;
    unit_price?: string | null;
    client_price?: string | null;
    unit?: string | null;
    part?: { name: string; unit: string } | null;
  }>;
};

export type StoClient = {
  id: string;
  name: string;
  phone: string | null;
  vehicles_count: number;
  orders_count: number;
  total_revenue: string;
  last_order_date: string | null;
};

export type ClientVehicle = {
  id: string;
  brand: string;
  model: string | null;
  year: number | null;
  reg_number: string;
  vin: string | null;
  color: string | null;
  odometer_last: number | null;
  odometer_updated_at: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  counterparty: { id: string; name: string; phone: string | null } | null;
};

export type VehicleRule = {
  id: string;
  work_name: string;
  interval_km: number | null;
  interval_months: number | null;
  last_done_km: number | null;
  last_done_at: string | null;
};

export type VehicleRec = {
  id: string;
  text: string;
  due_km: number | null;
  due_date: string | null;
  is_done: boolean;
  done_at: string | null;
  created_at: string;
  created_user: { name: string } | null;
};

export type VehicleOrder = {
  id: string;
  order_number: number;
  created_at: string;
  status: string;
  lifecycle_status: string;
  problem_description: string | null;
  odometer_start: number | null;
  odometer_end: number | null;
  mechanic: { id: string; name: string } | null;
  works_cost: string;
  parts_cost: string;
  total_cost: string;
  works: Array<{
    id: string;
    status: string;
    price_client: string | null;
    custom_work_name: string | null;
    work_catalog: { name: string } | null;
  }>;
  parts: Array<{
    id: string;
    quantity: number;
    custom_part_name: string | null;
    part: { name: string; unit: string } | null;
  }>;
};

export type VehicleDetail = {
  vehicle: ClientVehicle;
  orders: VehicleOrder[];
  rules: VehicleRule[];
  recommendations: VehicleRec[];
};

export type StoClientVehicle = {
  id: string;
  brand: string;
  model: string | null;
  year: number | null;
  reg_number: string;
  vin: string | null;
  color: string | null;
  odometer_last: number | null;
  notes: string | null;
  total_spent: string;
  orders: Array<{
    id: string;
    order_number: number;
    created_at: string;
    status: string;
    lifecycle_status: string;
    problem_description: string | null;
    admin_note: string | null;
    total: string;
    mechanic: { name: string } | null;
    second_mechanic: { name: string } | null;
    works: Array<{
      id: string;
      custom_work_name: string | null;
      price_client: string | null;
      status: string;
      work_catalog: { name: string } | null;
    }>;
    parts: Array<{
      id: string;
      custom_part_name: string | null;
      quantity: number;
      unit: string | null;
      client_price: string | null;
      part: { name: string; unit: string } | null;
    }>;
  }>;
};

export type StoClientDetail = {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  vehicles: StoClientVehicle[];
};
