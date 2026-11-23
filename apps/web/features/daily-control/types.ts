export const BANK_ID = '10000000-0000-0000-0000-000000000001';
export const CASH_ID = '10000000-0000-0000-0000-000000000002';
export const FUEL_CARD_ID = '10000000-0000-0000-0000-000000000004';

export type WalletFilter = 'all' | 'bank' | 'cash' | 'fuel_card';
export type PeriodMode = 'day' | 'week' | 'month';

export interface WarehousePartItem {
  id?: string;
  movement_id?: string;
  part_id?: string;
  name: string;
  brand: string;
  clientCarModel?: string | null;
  client_car_model?: string | null;
  article?: string | null;
  quantity: number;
  unit_price?: number;
}

export interface ModalWarehouseEntry {
  id: string;
  brand: string;
  clientCarModel: string;
  name: string;
  article: string;
  quantity: number;
  unitPrice: number | '';
}

export interface CategoryItem {
  id: string;
  name: string;
  code: string;
  direction?: 'income' | 'expense' | 'transfer' | string;
}

export interface RawTx {
  id: string;
  amount: string;
  direction: 'income' | 'expense' | 'transfer' | string;
  description: string | null;
  created_at: string;
  transaction_date?: string | null;
  from_wallet_id: string | null;
  to_wallet_id: string | null;
  category_id?: string | null;
  counterparty_id?: string | null;
  related_user_id?: string | null;
  trip_order_id?: string | null;
  trip_id?: string | null;
  idempotency_key?: string | null;
  category: { id: string; name: string; code: string } | null;
  counterparty: { id: string; name: string } | null;
  related_user: { id: string; name: string } | null;
  warehouse_part?: WarehousePartItem | null;
  warehouse_parts?: WarehousePartItem[];
}

export interface TripOrderTx {
  id: string;
  trip_id?: string;
  amount: string;
  created_at: string;
  payment_method: string;
  description: string | null;
  settlement_status?: string;
  lifecycle_status?: string;
  counterparty: { id: string; name: string } | null;
  trip: {
    id?: string;
    trip_number: number;
    driver_id?: string;
    driver: { id?: string; name: string } | null;
  } | null;
}

export interface CashCollectionTx {
  id: string;
  amount: string;
  created_at: string;
  note: string | null;
  driver: { name: string } | null;
}

export interface TBankOp {
  operationId: string;
  operationDate: string;
  operationTime?: string;
  trxnPostDate?: string;
  authorizationDate?: string;
  drawDate?: string;
  chargeDate?: string;
  typeOfOperation: 'Credit' | 'Debit' | string;
  operationAmount: number;
  rubleAmount?: number;
  description: string;
  payPurpose?: string;
  category?: string;
  documentNumber?: string;
  payer?: { name?: string; inn?: string; acct?: string };
  receiver?: { name?: string; inn?: string; acct?: string };
  counterParty?: { name?: string; inn?: string; account?: string };
}

export interface DailyBalanceData {
  date: string;
  is_today: boolean;
  wallets: {
    bank: {
      id: string;
      name: string;
      account_number: string;
      api_synced: boolean;
      morning: number;
      inflow: number;
      outflow: number;
      evening: number;
    };
    cash: {
      id: string;
      name: string;
      morning: number;
      inflow: number;
      outflow: number;
      evening: number;
    };
    fuel_card: {
      id: string;
      name: string;
      morning: number;
      inflow: number;
      outflow: number;
      evening: number;
    };
  };
  audit: {
    id: string;
    date: string;
    audited_at: string;
    audited_by: string;
    safe_cash_actual: number;
    safe_cash_expected: number;
    safe_discrepancy: number;
    bank_balance: number;
    fuel_card_balance: number;
    status: 'confirmed' | 'discrepancy' | 'pending';
    notes: string;
  } | null;
  transactions: RawTx[];
  trip_orders: TripOrderTx[];
  cash_collections: CashCollectionTx[];
  bank_operations?: TBankOp[];
  categories: CategoryItem[];
  calendar_overrides?: Array<{
    id: string;
    period: string;
    obligation_id: string;
    paid_amount: number | null;
    paid_at: string | null;
    custom_title?: string | null;
    custom_notes?: string | null;
  }>;
}

export interface PaymentCalendarItem {
  id: string;
  title: string;
  amount: number;
  due_day: number;
  status: string;
}

export interface GaragePartOption {
  id: string;
  name: string;
  category: string;
  article?: string;
  purchase_price?: number;
}

export interface EditingTxState {
  id: string;
  description: string;
  amount: number;
  categoryId?: string | null;
  categoryName?: string;
  direction: 'income' | 'expense' | 'transfer';
  toWalletId?: string | null;
  fromWalletId?: string | null;
  obligationId?: string | null;
  transactionDate?: string;
  relatedUserId?: string | null;
  warehousePart?: WarehousePartItem | null;
  warehouseParts?: WarehousePartItem[];
}

export interface IncomeSubItem {
  id: string;
  title: string;
  author: string;
  amount: number;
  time: string;
  rawTx?: RawTx;
}

export interface IncomeItem {
  id: string;
  title: string;
  category: string;
  wallet: 'bank' | 'cash' | 'fuel_card';
  walletName: string;
  author: string;
  amount: number;
  time?: string;
  dateSort?: number;
  rawTx?: RawTx;
  bankOp?: TBankOp;
  isLinked?: boolean;
  linkTypeLabel?: string;
  linkedTripNumber?: string | number;
  linkedDriverName?: string;
  canLinkToTrip?: boolean;
  suggestedOrder?: TripOrderTx;
  isGroup?: boolean;
  subItems?: IncomeSubItem[];
}

export interface ExpenseSubItem {
  id: string;
  title: string;
  author: string;
  amount: number;
  time: string;
  category?: string;
  categoryId?: string | null;
  wallet?: 'bank' | 'cash' | 'fuel_card';
  walletName?: string;
  rawTx?: RawTx;
  bankOp?: TBankOp;
  linkedObligationId?: string | null;
  linkedObligationTitle?: string | null;
}

export interface ExpenseItem {
  id: string;
  title: string;
  category: string;
  categoryId?: string | null;
  wallet: 'bank' | 'cash' | 'fuel_card';
  walletName: string;
  author: string;
  amount: number;
  time?: string;
  dateSort?: number;
  rawTx?: RawTx;
  bankOp?: TBankOp;
  linkedObligationId?: string | null;
  linkedObligationTitle?: string | null;
  isGroup?: boolean;
  subItems?: ExpenseSubItem[];
}

export interface LinkableOrderItem {
  id: string;
  trip_id: string;
  amount: string | number;
  payment_method: string;
  settlement_status: string;
  lifecycle_status: string;
  description?: string | null;
  created_at: string;
  trip_date?: string;
  order_amount?: number;
  is_match_amount?: boolean;
  is_match_date?: boolean;
  is_match_client?: boolean;
  is_already_linked?: boolean;
  score?: number;
  counterparty?: { id: string; name: string; inn?: string; contact_person?: string } | null;
  trip?: {
    id: string;
    trip_number: number;
    started_at: string;
    created_at: string;
    driver?: { id: string; name: string } | null;
  } | null;
}
