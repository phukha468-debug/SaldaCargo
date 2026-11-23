export type AtiOrder = {
  id: string;
  order_number: string;
  order_date: string;
  stage: number;
  doc_type: 'etrn' | 'paper';
  counterparty_id?: string | null;
  counterparty_name: string;
  counterparty_inn?: string;
  counterparty_contact?: string;
  counterparty_phone?: string;
  counterparty_email?: string;
  ati_code?: string;
  carrier_name: string;
  carrier_inn: string;
  carrier_contact: string;
  carrier_account: string;
  carrier_bank: string;
  carrier_bik: string;
  asset_name: string;
  asset_reg_number: string;
  driver_name: string;
  driver_phone: string;
  driver_passport: string;
  driver_license: string;
  shipper_name: string;
  pickup_address: string;
  pickup_date_time: string;
  pickup_contact: string;
  cargo_description: string;
  consignee_name: string;
  delivery_address: string;
  delivery_date: string;
  delivery_contact: string;
  price: number;
  payment_terms: string;
  postal_address?: string;
  postal_tracking_number?: string;
  docs_sent?: boolean;
  docs_sent_date?: string | null;
  docs_received?: boolean;
  docs_received_date?: string | null;
  payment_promised_date?: string | null;
  is_cancelled?: boolean;
  cancel_reason?: string;
  cancelled_at?: string;
  has_claim?: boolean;
  claim_status?: 'none' | 'issued' | 'agreed' | 'waiting_payment' | 'paid' | 'rejected';
  claim_number?: string;
  claim_date?: string;
  claim_amount?: number;
  claim_penalty_amount?: number;
  claim_empty_run_amount?: number;
  claim_idle_amount?: number;
  claim_due_days?: number;
  claim_due_date?: string;
  claim_agreed_at?: string;
  claim_paid_at?: string;
  claim_notes?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
};

export type AtiCounterpartyOption = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
};

export type AtiApiResponse = {
  success: boolean;
  orders: AtiOrder[];
  counterparties: AtiCounterpartyOption[];
  assets: { id: string; name: string; short_name: string; reg_number: string }[];
  drivers: { id: string; name: string; phone?: string }[];
};

export type AtiStageConfig = {
  title: string;
  shortTitle: string;
  colorDot: string;
  bgHeader: string;
  borderCol: string;
  btnForward: string;
  btnClass: string;
};

export type AgreeClaimState = {
  order: AtiOrder;
  amount: string;
  notes: string;
};
