import type {
  CalcServiceOrderInput,
  CalcTripAssetInput,
  CalcTripExpenseInput,
  CalcTripInput,
  CalcTripOrderInput,
} from '@saldacargo/shared';
import type { LifecycleStatus } from '@saldacargo/shared-types';

export const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Наличные',
  qr: 'QR',
  bank_invoice: 'Безнал',
  debt_cash: 'Долг',
  card_driver: 'Карта',
};

export const PAYMENT_STYLES: Record<string, string> = {
  cash: 'bg-amber-50 text-amber-700 border-amber-200',
  qr: 'bg-purple-50 text-purple-700 border-purple-200',
  bank_invoice: 'bg-slate-100 text-slate-600 border-slate-200',
  debt_cash: 'bg-rose-50 text-rose-700 border-rose-200',
  card_driver: 'bg-blue-50 text-blue-700 border-blue-200',
};

export interface MiniappTripOrder extends CalcTripOrderInput {
  id: string;
  amount: string;
  driver_pay: string;
  payment_method: string;
  description?: string | null;
  address_to?: string | null;
  counterparty_name?: string | null;
  counterparty?: { id?: string; name?: string | null; is_legal_entity?: boolean } | null;
}

export interface MiniappTripExpense extends CalcTripExpenseInput {
  id: string;
  amount: string;
  payment_method?: string | null;
  description?: string | null;
  category?: { name?: string | null } | null;
}

export interface MiniappTripAsset extends CalcTripAssetInput {
  id?: string;
  short_name?: string | null;
  reg_number?: string | null;
}

export interface MiniappTrip extends CalcTripInput<MiniappTripOrder, MiniappTripExpense> {
  id: string;
  trip_number: number;
  status?: string;
  lifecycle_status: LifecycleStatus;
  started_at: string;
  ended_at?: string | null;
  created_at: string;
  driver_note?: string | null;
  admin_note?: string | null;
  asset?: MiniappTripAsset | null;
  driver?: { id?: string; name?: string | null } | null;
  loader?: { id?: string; name?: string | null } | null;
}

export interface MiniappServiceOrderWork {
  id?: string;
  status?: string | null;
  custom_work_name?: string | null;
  work_description?: string | null;
  work_catalog?: { name?: string | null } | null;
  actual_minutes?: number | string | null;
  norm_minutes?: number | string | null;
  quantity?: number | string | null;
  price_client?: string | number | null;
  notes?: string | null;
}

export interface MiniappServiceOrderPart {
  id?: string;
  custom_part_name?: string | null;
  part?: { name?: string | null; unit?: string | null } | null;
  quantity?: number | string | null;
  unit?: string | null;
  unit_price?: number | string | null;
  price?: number | string | null;
}

export interface MiniappServiceOrder extends CalcServiceOrderInput {
  id: string;
  order_number?: string | number | null;
  machine_type?: 'own' | 'client' | string;
  lifecycle_status: LifecycleStatus;
  created_at: string;
  hourly_rate?: number | string | null;
  salary_pct?: number | string | null;
  total_minutes?: number | string | null;
  works_total?: string | null;
  estimated_pay?: string | null;
  mechanic_pay?: string | null;
  odometer_start?: number | string | null;
  odometer_end?: number | string | null;
  client_vehicle_model?: string | null;
  client_vehicle_brand?: string | null;
  client_vehicle_reg?: string | null;
  mechanic_note?: string | null;
  parts_provided_by_service?: boolean | null;
  asset?: MiniappTripAsset | null;
  mechanic?: { id?: string; name?: string | null } | null;
  works?: MiniappServiceOrderWork[] | null;
  parts?: MiniappServiceOrderPart[] | null;
}

export interface VehicleGroup {
  assetKey: string;
  assetName: string;
  regNumber: string;
  isPrr: boolean;
  isTruck: boolean;
  trips: MiniappTrip[];
  serviceOrders: MiniappServiceOrder[];
  tripsRevenue: number;
  tripsPayroll: number;
  driverPayroll: number;
  loaderPayroll: number;
  loaderProfit: number;
  tripsFuel: number;
  tripsExpenses: number;
  tripsProfit: number;
  maintenanceParts: number;
  maintenanceSalary: number;
  maintenanceTotal: number;
  netProfit: number;
}
