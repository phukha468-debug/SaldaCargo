export const DEFAULT_WORK_DESCRIPTIONS: Record<string, string> = {};

export const SPECIALTY_LABELS: Record<string, string> = {
  welder: 'Сварщик',
  electrician: 'Электрик',
  painter: 'Маляр',
  mechanic_lead: 'Старший механик',
  mechanic: 'Механик',
  handyman: 'Разнорабочий',
  driver: 'Водитель',
  loader: 'Грузчик',
};

export const STATUS_LABEL: Record<string, string> = {
  in_progress: 'В работе',
  completed: 'Завершён',
  cancelled: 'Отменён',
};

export const STATUS_COLOR: Record<string, string> = {
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-500',
};

export const PRIORITY_LABEL: Record<string, string> = {
  low: 'Низкий',
  normal: 'Обычный',
  urgent: 'Срочно',
};

export const PRIORITY_COLOR: Record<string, string> = {
  low: 'bg-slate-100 text-slate-500',
  normal: 'bg-blue-50 text-blue-600',
  urgent: 'bg-red-100 text-red-600',
};

export const ALERT_LABEL: Record<string, string> = {
  overdue: 'СРОЧНО',
  soon: 'СКОРО',
  ok: 'В норме',
  active_order: 'Наряд открыт',
};

export const ALERT_COLOR: Record<string, string> = {
  overdue: 'bg-red-100 text-red-700',
  soon: 'bg-amber-100 text-amber-700',
  ok: 'bg-emerald-100 text-emerald-700',
  active_order: 'bg-slate-100 text-slate-600',
};

export const emptyForm = {
  machine_type: 'own' as 'own' | 'client',
  service_type: 'internal' as 'internal' | 'external',
  asset_id: '',
  client_vehicle_brand: '',
  client_vehicle_model: '',
  client_vehicle_reg: '',
  client_name: '',
  client_phone: '',
  problem_description: '',
  assigned_mechanic_id: '',
  odometer_start: '',
  priority: 'normal',
  admin_note: '',
  contractor_name: '',
  external_doc_number: '',
  order_date: new Date().toISOString().slice(0, 10),
  works_cost: '',
  parts_cost: '',
  is_completed: true,
  payment_wallet_id: '10000000-0000-0000-0000-000000000002',
};
