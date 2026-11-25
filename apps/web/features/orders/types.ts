export interface RouteStop {
  id: string;
  loading_city: string;
  loading_address: string;
  loading_org?: string;
  loading_contact?: string;
  unloading_city: string;
  unloading_address: string;
  unloading_org?: string;
  cargo_name?: string;
  weight_kg?: number;
}

export interface TelematicsRouteStop {
  stop_key: string;
  merged_stop_keys?: string[];
  type?: 'loading' | 'unloading' | 'stop';
  geofence_id?: string | null;
  name: string;
  city?: string;
  raw_address?: string;
  lat?: number;
  lon?: number;
  arrived_at?: string;
  departed_at?: string;
  duration_min?: number;
  odometer_km?: number;
  is_known?: boolean;
  had_signal_gap?: boolean;
}

export type OrderRouteEntry = RouteStop | TelematicsRouteStop;

export interface BillingDocsWorkflow {
  waybill_type?: 'paper' | 'etrn'; // Строго один из двух: либо бумага (ТрН), либо ЭТрН!
  waybill_number?: string | null;
  invoice_issued?: boolean;
  invoice_number?: string | null;
  invoice_date?: string | null;
  tn_driver_delivered?: boolean;
  etrn_signed_edo?: boolean;
  epe_received_edo?: boolean;
  epe_number?: string | null;
  docs_sent_edo?: boolean;
  docs_sent_at?: string | null;
  client_accepted_edo?: boolean;
  client_accepted_at?: string | null;
  status?: 'in_progress' | 'accepted';
}

export interface ClientOrderPart {
  id: string;
  client_id: string;
  client_name: string;
  client_inn?: string;
  base_doc_number: string;
  cargo_name: string;
  weight_gross_kg: number | '';
  price_without_vat: number | '';
  forwarder_id?: string;
  forwarder_name?: string;
  payment_method?: 'bank_invoice' | 'cash';
  payment_terms?: string;
}

export interface AddressJson {
  raw?: string;
  address?: string;
  city?: string;
}

export interface RawRouteStop {
  loading_city?: string;
  loadingCity?: string;
  loading_address?: string;
  loadingAddress?: string;
  loading_org?: string;
  clientName?: string;
  unloading_city?: string;
  unloadingCity?: string;
  unloading_address?: string;
  unloadingAddress?: string;
  unloading_org?: string;
  cargo_name?: string;
  cargoName?: string;
  weight_kg?: number | string;
  weightTons?: number | string;
}

export interface RawParserPayload {
  routes?: RawRouteStop[];
  client_orders?: ClientOrderPart[];
  prevent_salda_auto_finish?: boolean;
  is_repair?: boolean;
  trip_type?: string;
  service_order_id?: string;
  detected_route_summary?: string;
  in_salda_transit?: boolean;
  visited_shaytanka?: boolean;
}

export interface OrderItem {
  id: string;
  order_number: number;
  source_type: string;
  status:
    | 'draft'
    | 'waiting_vehicle'
    | 'assigned'
    | 'in_progress'
    | 'pending_review'
    | 'docs_collection'
    | 'completed';
  base_doc_name: string;
  base_doc_number: string | null;
  base_doc_date: string | null;
  internal_order_number: string | null;
  created_at?: string;
  loading_org_name?: string;
  packaging_type?: string;

  client?: {
    id: string;
    name: string;
    inn: string;
    phone?: string;
    legal_address?: string;
    default_contract_number?: string;
  };
  forwarder?: { id: string; name: string; inn: string };
  shipper?: { id: string; name: string; inn: string };
  consignee?: { id: string; name: string; inn: string };
  vehicle?: {
    id: string;
    reg_number: string;
    brand_name: string;
    short_name: string;
    garage_number?: string;
    odometer_current?: number;
  };
  driver?: {
    id: string;
    name: string;
    full_name?: string;
    phone: string;
    tab_number?: string;
    license_series?: string;
    license_number?: string;
    license_class?: string;
    notes?: unknown;
  };
  loading_point?: { id: string; name: string; structured_address: unknown };
  trip?: {
    id: string;
    trip_number: number;
    odometer_start: number;
    odometer_end: number;
    admin_note?: string;
    driver_note?: string;
    started_at?: string;
    ended_at?: string;
    trip_orders?: Array<{ counterparty?: { name?: string } | null }>;
  };

  cargo_name: string;
  weight_gross_kg: number;
  places_count: number;
  price_without_vat: number;
  vat_rate: string;
  payment_terms: string;
  waybill_number: string | null;

  assigned_vehicle_id?: string | null;
  assigned_driver_id?: string | null;

  loading_address_json: AddressJson | null;
  unloading_address_json: AddressJson | null;
  planned_loading_at: string | null;
  planned_delivery_at: string | null;

  routes_json?: OrderRouteEntry[];
  client_orders?: ClientOrderPart[];
  prevent_salda_auto_finish?: boolean;
  salda_transit_count?: number;
  billing_docs?: BillingDocsWorkflow | null;
  raw_parser_payload?: RawParserPayload | null;
  is_trip_only_review?: boolean;
}

export type PipelineFolderId =
  | 'waiting_vehicle'
  | 'assigned'
  | 'in_progress'
  | 'pending_review'
  | 'docs_collection'
  | 'completed';

export interface OrderVehicleOption {
  id: string;
  reg_number: string;
  brand_name?: string;
  short_name?: string;
}

export interface OrderDriverOption {
  id: string;
  name: string;
  phone?: string | null;
  inn?: string | null;
  tab_number?: string | null;
  roles?: string[];
  passport_series?: string | null;
  passport_number?: string | null;
  passport_issued_by?: string | null;
  passport_issue_date?: string | null;
  passport_department_code?: string | null;
  license_series?: string | null;
  license_number?: string | null;
  license_issue_date?: string | null;
  license_class?: string | null;
}

export interface OrderCounterpartyOption {
  id: string;
  name: string;
  inn?: string | null;
}

export interface OrderPresetOption {
  id: string;
  title?: string;
  client_counterparty_id?: string;
  forwarder_counterparty_id?: string;
}

export interface SmartOrderFormState {
  base_doc_number: string;
  base_doc_date: string;
  client_id: string;
  client_name: string;
  client_inn: string;
  forwarder_id: string;
  forwarder_name: string;
  preset_id: string;
  loading_point_id: string;
  loading_address: string;
  loading_city: string;
  loading_org_name: string;
  loading_contact_fio?: string;
  unloading_address: string;
  unloading_city: string;
  cargo_name: string;
  weight_gross_kg: number | string;
  places_count: number;
  packaging_type: string;
  price_without_vat: number | string;
  payment_method: 'bank_invoice' | 'cash';
  payment_terms: string;
  planned_loading_at: string;
  planned_delivery_at: string;
  assigned_vehicle_id: string;
  assigned_driver_id: string;
}
