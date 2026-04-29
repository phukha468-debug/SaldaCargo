import type {
  LifecycleStatus,
  SettlementStatus,
  TripType,
  PaymentMethod,
  TransactionDirection,
  UserRole,
  AssetStatus,
  WalletType,
} from './enums';

// ─── Базовые типы ───────────────────────────────────────────────────────────

export type UUID = string;
export type ISODateString = string; // "2026-04-19T08:30:00Z"
export type MoneyString = string; // "1234.56" — всегда строка, никогда float!

// ─── Пользователь ───────────────────────────────────────────────────────────

export interface User {
  id: UUID;
  name: string;
  phone: string | null;
  max_user_id: string | null;
  roles: UserRole[];
  current_asset_id: UUID | null; // Закреплённая машина
  is_active: boolean;
  created_at: ISODateString;
  updated_at: ISODateString;
}

// ─── Актив (машина) ─────────────────────────────────────────────────────────

export interface Asset {
  id: UUID;
  reg_number: string;
  short_name: string;
  asset_type_id: UUID;
  year: number | null;
  status: AssetStatus;
  odometer_current: number;
  current_book_value: MoneyString;
  wialon_id: string | null;
  legal_entity_id: UUID;
  assigned_driver_id: UUID | null;
  created_at: ISODateString;
  updated_at: ISODateString;
}

// ─── Рейс ───────────────────────────────────────────────────────────────────

export interface Trip {
  id: UUID;
  trip_number: number;
  asset_id: UUID;
  driver_id: UUID;
  loader_id: UUID | null;
  trip_type: TripType;
  status: 'in_progress' | 'completed' | 'cancelled';
  lifecycle_status: LifecycleStatus;
  odometer_start: number;
  odometer_end: number | null;
  odometer_photo_start_url: string | null;
  odometer_photo_end_url: string | null;
  driver_note: string | null;
  admin_note: string | null;
  approved_by: UUID | null;
  approved_at: ISODateString | null;
  started_at: ISODateString;
  ended_at: ISODateString | null;
  created_at: ISODateString;
  updated_at: ISODateString;
}

// ─── Заказ в рейсе ──────────────────────────────────────────────────────────

export interface TripOrder {
  id: UUID;
  trip_id: UUID;
  counterparty_id: UUID | null;
  description: string | null;
  amount: MoneyString;
  driver_pay: MoneyString;
  loader_pay: MoneyString;
  payment_method: PaymentMethod;
  settlement_status: SettlementStatus;
  lifecycle_status: LifecycleStatus;
  idempotency_key: UUID;
  created_at: ISODateString;
  updated_at: ISODateString;
}

// ─── Транзакция ─────────────────────────────────────────────────────────────

export interface Transaction {
  id: UUID;
  direction: TransactionDirection;
  amount: MoneyString;
  category_id: UUID;
  from_wallet_id: UUID | null;
  to_wallet_id: UUID | null;
  counterparty_id: UUID | null;
  trip_order_id: UUID | null;
  service_order_id: UUID | null;
  lifecycle_status: LifecycleStatus;
  settlement_status: SettlementStatus;
  transaction_date: ISODateString;
  description: string | null;
  photo_url: string | null;
  idempotency_key: UUID;
  created_by: UUID;
  created_at: ISODateString;
  updated_at: ISODateString;
}

// ─── Кошелёк ────────────────────────────────────────────────────────────────

export interface Wallet {
  id: UUID;
  name: string;
  type: WalletType;
  owner_user_id: UUID | null;
  legal_entity_id: UUID;
  is_active: boolean;
  created_at: ISODateString;
}

// ─── Контрагент ─────────────────────────────────────────────────────────────

export interface Counterparty {
  id: UUID;
  name: string;
  phone: string | null;
  type: 'client' | 'supplier' | 'both';
  credit_limit: MoneyString | null;
  notes: string | null;
  is_active: boolean;
  created_at: ISODateString;
  updated_at: ISODateString;
}
