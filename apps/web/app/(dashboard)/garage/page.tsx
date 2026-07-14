'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef, useMemo } from 'react';
import { cn, Money } from '@saldacargo/ui';

// ─── Types ───────────────────────────────────────────────────────────────────

type Mechanic = { id: string; name: string };
type Asset = { id: string; short_name: string; reg_number: string };

type OrderRow = {
  id: string;
  order_number: number;
  status: string;
  priority: string;
  machine_type: 'own' | 'client';
  problem_description: string;
  created_at: string;
  asset: Asset | null;
  client_vehicle_brand: string | null;
  client_vehicle_reg: string | null;
  client_name: string | null;
  mechanic: Mechanic | null;
  works: Array<{ id: string; status: string }>;
};

type DetailWork = {
  id: string;
  status: string;
  salary_paid: boolean;
  quantity: number;
  norm_minutes: number;
  actual_minutes: number;
  price_client: string | null;
  work_description: string | null;
  custom_work_name: string | null;
  mechanic_id: string | null;
  second_mechanic_id: string | null;
  work_catalog: { id: string; name: string; norm_minutes: number } | null;
  time_logs: Array<{ id: string; started_at: string; stopped_at: string | null; status: string }>;
};

type MechanicWithPct = Mechanic & { mechanic_salary_pct: string | null };

type OrderDetail = Omit<OrderRow, 'works' | 'mechanic'> & {
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
  parts: Array<{
    id: string;
    quantity: number;
    custom_part_name: string | null;
    unit: string | null;
    unit_price: string | null;
    client_price: string | null;
    part: { id: string; name: string; unit: string } | null;
  }>;
};

type DashboardData = {
  repairRequests: Array<{
    id: string;
    created_at: string;
    custom_description: string;
    asset: { short_name: string; reg_number: string } | null;
    driver: { name: string } | null;
    fault: { name: string; category: string } | null;
  }>;
  activeOrders: Array<{
    id: string;
    order_number: number;
    status: string;
    created_at: string;
    machine_type: string;
    asset: { short_name: string; reg_number: string } | null;
    mechanic: { name: string } | null;
    second_mechanic: { name: string } | null;
  }>;
  pendingApproval: Array<{
    id: string;
    order_number: number;
    created_at: string;
    machine_type: string;
    asset: { short_name: string; reg_number: string } | null;
    mechanic: { name: string } | null;
    service_order_works: Array<{ norm_minutes: number; actual_minutes: number; status: string }>;
  }>;
  maintenanceAlerts: Array<{
    id: string;
    work_name: string;
    alert_status: string;
    next_due_km: number | null;
    next_due_at: string | null;
    asset: { short_name: string; reg_number: string; odometer_current: number } | null;
  }>;
  counts: {
    repairRequests: number;
    pendingApproval: number;
    activeOrders: number;
    maintenanceAlerts: number;
    vehiclesInRepair: number;
  };
  month: {
    completedOrders: number;
    revenue: string;
    salaryAccrued: string;
  };
};

type ServiceJson = {
  problem_description?: string;
  priority?: string;
  mechanic_note?: string;
  works?: Array<{ name: string; norm_minutes?: number }>;
};

type RepairRequest = {
  id: string;
  status: string;
  custom_description: string | null;
  admin_note: string | null;
  service_json: ServiceJson | null;
  created_at: string;
  reviewed_at: string | null;
  asset: { id: string; short_name: string; reg_number: string } | null;
  driver: { id: string; name: string } | null;
  fault: { id: string; name: string; category: string } | null;
  service_order: { id: string; order_number: number; status: string } | null;
};

type MaintenanceItem = {
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

type WorkCatalogItem = {
  id: string;
  code: string | null;
  name: string;
  category: string | null;
  norm_minutes: number | null;
  norm_minutes_valdai: number | null;
  default_price_client: string | null;
  default_price_client_valdai: string | null;
  internal_cost_rate: string | null;
  is_active: boolean;
};

type FaultCatalogItem = {
  id: string;
  name: string;
  category: string;
  is_active: boolean;
  created_at: string;
};

type MechanicStat = {
  mechanic_id: string;
  mechanic_name: string;
  salary_pct: number;
  orders_count: number;
  plan_norm_hours: number;
  fact_norm_hours: number;
  total_works_cost: string;
  accrued_salary: string;
  orders: Array<{
    id: string;
    order_number: number;
    created_at: string;
    machine_type: string;
    vehicle: string;
    works: Array<{
      name: string;
      norm_minutes: number;
      actual_minutes: number;
      price_client: string;
    }>;
  }>;
};

type VehicleHistoryItem = {
  id: string;
  order_number: number;
  created_at: string;
  status: string;
  lifecycle_status: string;
  machine_type: string;
  problem_description: string;
  odometer_start: number | null;
  mechanic: { name: string } | null;
  works: Array<{
    norm_minutes: number;
    actual_minutes: number;
    price_client: string;
    status: string;
    work_catalog: { name: string } | null;
  }>;
  parts: Array<{ quantity: number; unit_price: string; part: { name: string; unit: string } }>;
  works_cost: string;
  parts_cost: string;
  total_cost: string;
  total_norm_minutes: number;
  total_actual_minutes: number;
};

type SettingsData = {
  sto: { hourly_rate: string; hourly_rate_own: string };
  mechanics: Array<{ id: string; name: string; mechanic_salary_pct: string }>;
};

type GarageSection =
  | 'dashboard'
  | 'requests'
  | 'workorders'
  | 'maintenance'
  | 'worktypes'
  | 'faultcatalog'
  | 'repvehicles'
  | 'repmechanics'
  | 'clients'
  | 'settings';
type ReportTab = 'vehicles' | 'mechanics';

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  created: 'В очереди',
  in_progress: 'В работе',
  completed: 'Завершён',
  cancelled: 'Отменён',
};
const STATUS_COLOR: Record<string, string> = {
  created: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-500',
};
const PRIORITY_LABEL: Record<string, string> = {
  low: 'Низкий',
  normal: 'Обычный',
  urgent: 'Срочно',
};
const PRIORITY_COLOR: Record<string, string> = {
  low: 'bg-slate-100 text-slate-500',
  normal: 'bg-blue-50 text-blue-600',
  urgent: 'bg-red-100 text-red-600',
};
const ALERT_LABEL: Record<string, string> = {
  overdue: 'СРОЧНО',
  soon: 'СКОРО',
  ok: 'В норме',
  active_order: 'Наряд открыт',
};
const ALERT_COLOR: Record<string, string> = {
  overdue: 'bg-red-100 text-red-700',
  soon: 'bg-amber-100 text-amber-700',
  ok: 'bg-emerald-100 text-emerald-700',
  active_order: 'bg-slate-100 text-slate-600',
};
const FAULT_CATEGORIES: Record<string, string> = {
  engine: 'Двигатель',
  suspension: 'Ходовая',
  brakes: 'Тормоза',
  transmission: 'Трансмиссия',
  electrical: 'Электрика',
  body: 'Кузов',
  other: 'Прочее',
};

const emptyForm = {
  machine_type: 'own' as 'own' | 'client',
  asset_id: '',
  client_vehicle_brand: '',
  client_vehicle_model: '',
  client_vehicle_reg: '',
  client_name: '',
  client_phone: '',
  problem_description: '',
  assigned_mechanic_id: '',
  priority: 'normal',
  admin_note: '',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
function moneyVal(s: string | null | undefined): number {
  return parseFloat(s ?? '0');
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function todayLabel() {
  return new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' });
}

// ─── SVG Icons ───────────────────────────────────────────────────────────────

const Icons = {
  dashboard: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  ),
  requests: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  ),
  workorders: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    </svg>
  ),
  maintenance: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  worktypes: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  faultcatalog: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  repvehicles: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
      />
    </svg>
  ),
  repmechanics: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"
      />
    </svg>
  ),
  clients: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  ),
  settings: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
      />
    </svg>
  ),
};

// ═══════════════════════════ SIDEBAR ══════════════════════════════════════════

const ICON_MAP: Record<string, React.ReactNode> = {
  dashboard: Icons.dashboard,
  requests: Icons.requests,
  workorders: Icons.workorders,
  maintenance: Icons.maintenance,
  worktypes: Icons.worktypes,
  faultcatalog: Icons.faultcatalog,
  repvehicles: Icons.repvehicles,
  repmechanics: Icons.repmechanics,
  clients: Icons.clients,
  settings: Icons.settings,
};

type NavGroup = { label: string; items: { id: GarageSection; label: string; badgeKey?: string }[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Главное',
    items: [
      { id: 'dashboard', label: 'Дашборд', badgeKey: 'total' },
      { id: 'requests', label: 'Заявки', badgeKey: 'repairRequests' },
      { id: 'workorders', label: 'Заказ-наряды' },
      { id: 'maintenance', label: 'Регламенты ТО' },
    ],
  },
  {
    label: 'Справочники',
    items: [
      { id: 'worktypes', label: 'Виды работ' },
      { id: 'faultcatalog', label: 'Каталог неисправностей' },
    ],
  },
  {
    label: 'Отчёты',
    items: [
      { id: 'repvehicles', label: 'История автомобилей' },
      { id: 'repmechanics', label: 'По механикам' },
    ],
  },
  { label: 'Клиенты СТО', items: [{ id: 'clients', label: 'Карточки клиентов' }] },
  { label: 'Система', items: [{ id: 'settings', label: 'Настройки СТО' }] },
];

function Sidebar({
  section,
  onChange,
  counts,
}: {
  section: GarageSection;
  onChange: (s: GarageSection) => void;
  counts: DashboardData['counts'] | null;
}) {
  const getBadge = (key?: string) => {
    if (!key || !counts) return null;
    if (key === 'total') {
      const total = counts.repairRequests + counts.pendingApproval + counts.maintenanceAlerts;
      return total > 0 ? total : null;
    }
    if (key === 'repairRequests') return counts.repairRequests > 0 ? counts.repairRequests : null;
    return null;
  };

  return (
    <aside className="w-56 min-h-full bg-slate-900 flex flex-col flex-shrink-0">
      <div className="px-5 py-5 border-b border-slate-700">
        <div className="text-white font-bold text-base">SaldaCargo</div>
        <div className="text-slate-400 text-xs mt-0.5">Раздел: Гараж</div>
      </div>
      <nav className="flex-1 py-3 px-2 overflow-y-auto">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            <div className="text-slate-500 text-xs font-semibold px-3 mb-1 mt-4 uppercase tracking-wider">
              {group.label}
            </div>
            {group.items.map((item) => {
              const badge = getBadge(item.badgeKey);
              const isActive =
                section === 'repvehicles' || section === 'repmechanics'
                  ? item.id === section
                  : section === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onChange(item.id)}
                  className={cn(
                    'nav-item w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer mb-0.5 text-left transition-all',
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-300',
                  )}
                >
                  {ICON_MAP[item.id]}
                  {item.label}
                  {badge &&
                    (item.label === 'Дашборд' ? (
                      <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                        {badge}
                      </span>
                    ) : (
                      <span className="ml-auto bg-amber-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                        {badge}
                      </span>
                    ))}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}

// ─── Default work descriptions (pre-filled on edit open) ─────────────────────

const DEFAULT_WORK_DESCRIPTIONS: Record<string, string> = {
  TO_1: 'ТО-1 выполнено: замена моторного масла, воздушного и топливного фильтров. Визуальный осмотр агрегатов проведён.',
  TO_2: 'ТО-2 выполнено: замена масла, всех фильтров, свечей, проверка тормозной системы, ходовой, уровней технических жидкостей.',
  OIL_CHANGE: 'Замена моторного масла и масляного фильтра. Уровень проверен после замены.',
  AIR_FILTER: 'Заменён воздушный фильтр двигателя.',
  FUEL_FILTER: 'Заменён топливный фильтр.',
  CABIN_FILTER: 'Заменён салонный фильтр.',
  ANTIFREEZE: 'Замена охлаждающей жидкости (антифриз). Система промыта, заправлена до нормы.',
  BRAKE_FLUID: 'Замена тормозной жидкости. Система прокачана, воздух удалён.',
  GUR_FLUID: 'Замена жидкости гидроусилителя руля.',
  TIMING_BELT:
    'Заменён ремень ГРМ в сборе с натяжителем и роликами. Метки установлены по регламенту.',
  TIMING_CHAIN:
    'Заменена цепь ГРМ, натяжитель и успокоитель. Фазы газораспределения выставлены по меткам.',
  ENGINE_DIAG:
    'Диагностика двигателя проведена. Считаны коды ошибок, составлен перечень неисправностей.',
  HEAD_GASKET:
    'Заменена прокладка ГБЦ. Головка снята, проверена на плоскостность, плоскость обработана.',
  VALVE_ADJUST: 'Регулировка тепловых зазоров клапанов выполнена по заводскому регламенту.',
  INJECTORS: 'Заменены форсунки. Давление топливной системы проверено после установки.',
  GLOW_PLUGS:
    'Заменены свечи накала. Резьба в колодцах очищена, затяжка выполнена с требуемым моментом.',
  SPARK_PLUGS: 'Заменены свечи зажигания. Зазоры выставлены по регламенту.',
  TURBO_REPLACE:
    'Заменён турбокомпрессор. Маслоподводящая и сливная трубки проверены, масло заменено.',
  TURBO_DIAG:
    'Диагностика турбокомпрессора: давление наддува, осевой и радиальный люфт крыльчатки проверены.',
  EGR_CLEAN: 'Клапан EGR очищен от нагара. Подвижность клапана проверена, установлен на место.',
  ENGINE_MOUNT: 'Заменены подушки (опоры) двигателя.',
  RADIATOR_REPLACE: 'Заменён радиатор системы охлаждения. Система промыта и заправлена антифризом.',
  THERMOSTAT: 'Заменён термостат. Система охлаждения проверена на герметичность.',
  WATER_PUMP: 'Заменена водяная помпа. ОЖ заменена, система прокачана.',
  BELT_DRIVE: 'Заменён приводной ремень навесного оборудования.',
  BELT_TENSIONER: 'Заменён натяжитель приводного ремня.',
  SEALS_GASKETS: 'Заменены сальники и прокладки двигателя. Подтёки устранены.',
  CLUTCH:
    'Заменён комплект сцепления: диск, корзина, выжимной подшипник. Коробка снята и установлена.',
  CLUTCH_CABLE: 'Заменён трос сцепления. Свободный ход педали отрегулирован.',
  CLUTCH_CYLINDER: 'Заменён главный/рабочий цилиндр сцепления. Система прокачана.',
  GEARBOX_OIL: 'Замена масла в коробке переключения передач.',
  REAR_AXLE_OIL: 'Замена масла в редукторе заднего моста.',
  GEARBOX_REPLACE: 'Заменена КПП. Установлена и отрегулирована.',
  GEARBOX_ADJUST: 'Регулировка механизма переключения передач / кулисы выполнена.',
  CARDAN_REPLACE: 'Заменён карданный вал в сборе. Крестовины и шлицевые соединения проверены.',
  CARDAN_CROSS: 'Заменена крестовина карданного вала. Вал сбалансирован после установки.',
  CARDAN_CROSS_150:
    'Заменена крестовина карданного вала (2.5 нч): карданный вал снят, крестовина выпрессована и запрессована, вал установлен обратно.',
  HUB_BEARING_FRONT: 'Заменён ступичный подшипник передней оси. Затяжка выполнена по регламенту.',
  HUB_BEARING_REAR: 'Заменён ступичный подшипник задней оси.',
  BRAKE_PADS_FRONT:
    'Заменены тормозные колодки передней оси. Суппорты очищены, направляющие смазаны.',
  BRAKE_PADS_REAR: 'Заменены тормозные колодки задней оси.',
  BRAKE_DISCS_FRONT: 'Заменены тормозные диски передней оси.',
  BRAKE_DRUMS_REAR: 'Заменены тормозные барабаны задней оси.',
  SHOCK_FRONT: 'Заменены амортизаторы передней подвески.',
  SHOCK_REAR: 'Заменены амортизаторы задней подвески.',
  ALIGNMENT: 'Регулировка развал-схождения выполнена. Параметры выставлены по заводским нормам.',
  SUSPENSION_DIAG:
    'Диагностика ходовой части: проверка люфтов, износ сайлентблоков, шаровых, рулевых наконечников.',
  BALL_JOINT: 'Заменена шаровая опора. Люфт в соединении устранён.',
  TIE_ROD: 'Заменена рулевая тяга. Схождение проверено после установки.',
  TIE_ROD_END: 'Заменён рулевой наконечник.',
  SILENTBLOCK_FRONT: 'Заменены сайлентблоки передних рычагов подвески.',
  SILENTBLOCK_REAR: 'Заменены сайлентблоки задней подвески.',
  SPRING_REPLACE: 'Заменена рессора / пружина подвески.',
  STABILIZER_BUSH: 'Заменены втулки стабилизатора поперечной устойчивости.',
  STABILIZER_LINK: 'Заменены стойки стабилизатора.',
  STEERING_RACK: 'Заменена рулевая рейка. Схождение передних колёс отрегулировано.',
  STEERING_PUMP: 'Заменён насос ГУР. Жидкость заменена, система прокачана.',
  WHEEL_BEARING: 'Заменён подшипник колеса.',
  ABS_SENSOR: 'Заменён датчик ABS. Работа системы проверена.',
  ALTERNATOR: 'Заменён генератор. Напряжение в бортсети после замены 14,0–14,5 В — норма.',
  STARTER: 'Заменён стартер. Работа проверена — запуск двигателя штатный.',
  ELECTRIC_DIAG:
    'Диагностика электрооборудования проведена. Коды ошибок считаны, неисправности задокументированы.',
  BATTERY_REPLACE: 'Заменена аккумуляторная батарея.',
  WIRING_REPAIR: 'Поиск и ремонт обрыва / КЗ в проводке. Повреждённый участок восстановлен.',
  HEADLIGHT_REPLACE: 'Заменена фара / задний фонарь.',
  LAMP_REPLACE: 'Заменены лампы освещения.',
  IGNITION_COIL: 'Заменена катушка зажигания.',
  WIRING_HARNESS: 'Заменён жгут проводки.',
  WIRING_HARNESS_PARTIAL:
    'Ремонт участка кабельной трассы: изоляция восстановлена, соединения обжаты и защищены термоусадкой.',
  ELECTRIC_CIRCUIT_CHECK:
    'Выходной контроль электрических цепей: все цепи прозвонены, обрывов и КЗ не выявлено.',
  ABS_EBS_DIAG:
    'Диагностика ABS/EBS проведена. Коды ошибок считаны, неисправности задокументированы.',
  ABS_CIRCUIT_CHECK:
    'Проверка цепи датчика ABS: сопротивление, питание, сигнал соответствуют норме.',
  ABS_SENSOR_REMOVE: 'Датчик ABS демонтирован.',
  ABS_SENSOR_INSTALL_ADJ:
    'Датчик ABS установлен, зазор между датчиком и ротором выставлен по регламенту.',
  ECU_RESET_TEST:
    'Ошибки ЭБУ сброшены. Финальное тестирование на ХХ и в движении — нарушений не выявлено.',
  BODY_REPAIR: 'Кузовной ремонт: правка, шпаклёвка, грунтование повреждённого участка.',
  BODY_PAINT: 'Окраска элемента кузова. Цвет подобран по заводскому коду.',
  GLASS_REPLACE: 'Заменено стекло. Герметик нанесён по периметру, выдержан до полимеризации.',
  DOOR_HANDLE: 'Заменена ручка двери / замок.',
  MIRROR_REPLACE: 'Заменено зеркало заднего вида.',
  WIPER_MECH: 'Заменена трапеция дворников.',
  HEATER_CORE:
    'Заменён радиатор печки. Приборная панель частично демонтирована, система охлаждения промыта.',
  HEATER_FAN: 'Заменён вентилятор отопителя (моторчик печки).',
  AC_CHARGE: 'Заправка кондиционера хладагентом. Давление в системе соответствует норме.',
  AC_COMPRESSOR: 'Заменён компрессор кондиционера.',
  EXHAUST_MUFFLER: 'Заменён глушитель.',
  EXHAUST_PIPE: 'Заменена приёмная труба выхлопной системы.',
  EXHAUST_GASKET: 'Заменена прокладка выпускного коллектора. Течь выхлопных газов устранена.',
  EXHAUST_FLEX: 'Заменена гофрированная вставка глушителя.',
  FUEL_PUMP: 'Заменён топливный насос.',
  FUEL_TANK: 'Заменён топливный бак.',
  FUEL_LINES: 'Заменены топливные магистрали (трубки / шланги).',
  TYRE_MOUNT_SET: 'Шиномонтаж комплекта (4 колеса): бортировка и балансировка.',
  TYRE_MOUNT_ONE: 'Шиномонтаж 1 колеса: бортировка и балансировка.',
  TYRE_BALANCE: 'Балансировка колеса выполнена.',
  TYRE_REPAIR: 'Ремонт прокола: жгутование / установка грибка.',
  GBO_BALLOON_LP:
    'Снятие и установка газового баллона (пропан). Соединения проверены на герметичность.',
  REAR_AXLE_REMOVE: 'Снятие и установка заднего моста в сборе.',
  REAR_AXLE_OVERHAUL: 'Разборка, дефектовка и сборка заднего моста. Изношенные детали заменены.',
  AXLE_WELD_PAINT:
    'Сварочно-восстановительные работы на чулке моста (заварка трещины / деформации), поверхность окрашена грунтом.',
  SPRING_STUD_REMOVE: 'Срезание закисших стремянок рессор.',
  SPRING_SILENTBLOCK_REPLACE: 'Заменены сайлентблоки рессор.',
  SHOCK_ABSORBER_BUSH: 'Заменены втулки амортизаторов.',
  BRAKE_BLEED: 'Прокачка тормозного контура. Воздух удалён, уровень ТЖ доведён до нормы.',
};

// ═══════════════════════════ MODALS (unchanged) ═══════════════════════════════

function OrderDetailModal({
  orderId,
  onClose,
  mechanics,
}: {
  orderId: string;
  onClose: () => void;
  mechanics: Mechanic[];
}) {
  const queryClient = useQueryClient();
  const backdropMouseDownOnSelf = useRef(false);
  const [editNote, setEditNote] = useState<string | null>(null);
  const [editMechanic, setEditMechanic] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [editPriority, setEditPriority] = useState<string | null>(null);
  const [showCloseDialog, setShowCloseDialog] = useState(false);

  const [showAddWork, setShowAddWork] = useState(false);
  const [workSearch, setWorkSearch] = useState('');
  const [workCatFilter, setWorkCatFilter] = useState<string | null>(null);
  const [confirmDeleteWorkId, setConfirmDeleteWorkId] = useState<string | null>(null);
  const [addWorkError, setAddWorkError] = useState<string | null>(null);
  const [addWorkQty, setAddWorkQty] = useState(1);
  const [isCustomWork, setIsCustomWork] = useState(false);
  const [customWorkName, setCustomWorkName] = useState('');
  const [customWorkPrice, setCustomWorkPrice] = useState('');
  const [editingWorkId, setEditingWorkId] = useState<string | null>(null);
  const [editWorkDesc, setEditWorkDesc] = useState('');
  const [editWorkQty, setEditWorkQty] = useState(1);
  const [editWorkPrice, setEditWorkPrice] = useState('');
  const [editWorkMechanic, setEditWorkMechanic] = useState<string | null>(null);
  const [editWorkSecondMechanic, setEditWorkSecondMechanic] = useState<string | null>(null);
  const [partPricesDraft, setPartPricesDraft] = useState<Record<string, string>>({});
  const [showAddPart, setShowAddPart] = useState(false);
  const [addPartName, setAddPartName] = useState('');
  const [addPartQty, setAddPartQty] = useState(1);
  const [addPartPrice, setAddPartPrice] = useState('');
  const [addPartError, setAddPartError] = useState<string | null>(null);

  const { data: order, isLoading } = useQuery<OrderDetail>({
    queryKey: ['garage-order', orderId],
    queryFn: async () => {
      const r = await fetch(`/api/garage/orders/${orderId}`);
      if (!r.ok) throw new Error('Ошибка');
      return r.json();
    },
    staleTime: 30000,
  });

  const patchMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetch(`/api/garage/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error('Ошибка');
      return r.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['garage-order', orderId] });
      // Обновляем список и дашборд только при смене lifecycle (закрытие/открытие наряда)
      if ('lifecycle_status' in variables) {
        queryClient.invalidateQueries({ queryKey: ['garage-orders'] });
        queryClient.invalidateQueries({ queryKey: ['garage-dashboard'] });
      }
      setEditNote(null);
      setEditMechanic(null);
      setEditSecondMechanic(null);
      setEditStatus(null);
      setEditPriority(null);
    },
  });

  const isClosed = order?.lifecycle_status === 'approved';

  const { data: workCatalog = [] } = useQuery<
    Array<{
      id: string;
      name: string;
      category: string | null;
      norm_minutes: number;
      norm_minutes_valdai: number | null;
      default_price_client: string | null;
    }>
  >({
    queryKey: ['garage-work-catalog'],
    queryFn: () => fetch('/api/garage/work-catalog').then((r) => r.json()),
    staleTime: 300000,
    enabled: showAddWork,
  });

  const addWorkMutation = useMutation({
    mutationFn: ({
      work_catalog_id,
      custom_work_name,
      price_client,
      quantity,
    }: {
      work_catalog_id?: string;
      custom_work_name?: string;
      price_client?: string;
      quantity: number;
    }) =>
      fetch(`/api/garage/orders/${orderId}/works`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ work_catalog_id, custom_work_name, price_client, quantity }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Ошибка');
        return d;
      }),
    onSuccess: () => {
      setAddWorkError(null);
      setWorkSearch('');
      setAddWorkQty(1);
      setIsCustomWork(false);
      setCustomWorkName('');
      setCustomWorkPrice('');
      setShowAddWork(false);
      queryClient.invalidateQueries({ queryKey: ['garage-order', orderId] });
    },
    onError: (err: Error) => {
      setAddWorkError(err.message);
    },
  });

  const deleteWorkMutation = useMutation({
    mutationFn: (workId: string) =>
      fetch(`/api/garage/orders/${orderId}/works/${workId}`, { method: 'DELETE' }).then((r) => {
        if (!r.ok) throw new Error('Ошибка');
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['garage-order', orderId] });
    },
  });

  const patchWorkMutation = useMutation({
    mutationFn: ({
      workId,
      body,
    }: {
      workId: string;
      body: {
        actual_minutes?: number;
        price_client?: string;
        status?: string;
        work_description?: string | null;
        quantity?: number;
        mechanic_id?: string | null;
        second_mechanic_id?: string | null;
      };
    }) =>
      fetch(`/api/garage/orders/${orderId}/works/${workId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Ошибка');
        return d;
      }),
    onSuccess: () => {
      setEditingWorkId(null);
      queryClient.invalidateQueries({ queryKey: ['garage-order', orderId] });
    },
  });

  const patchPartMutation = useMutation({
    mutationFn: ({ partId, client_price }: { partId: string; client_price: string }) =>
      fetch(`/api/garage/orders/${orderId}/parts/${partId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_price, unit_price: client_price }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Ошибка');
        return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['garage-order', orderId] });
    },
  });

  const addPartMutation = useMutation({
    mutationFn: (body: { custom_part_name: string; quantity: number; client_price?: string }) =>
      fetch(`/api/garage/orders/${orderId}/parts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Ошибка');
        return d;
      }),
    onSuccess: () => {
      setAddPartError(null);
      setAddPartName('');
      setAddPartQty(1);
      setAddPartPrice('');
      setShowAddPart(false);
      queryClient.invalidateQueries({ queryKey: ['garage-order', orderId] });
    },
    onError: (err: Error) => setAddPartError(err.message),
  });

  const deletePartMutation = useMutation({
    mutationFn: (partId: string) =>
      fetch(`/api/garage/orders/${orderId}/parts/${partId}`, { method: 'DELETE' }).then(
        async (r) => {
          if (!r.ok) throw new Error('Ошибка');
          return r.json();
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['garage-order', orderId] });
    },
  });

  // Sync part price drafts when order loads (only reset on order switch)
  useEffect(() => {
    if (!order) return;
    const draft: Record<string, string> = {};
    order.parts.forEach((p) => {
      const val = parseFloat(p.client_price ?? '0');
      draft[p.id] = val > 0 ? String(Math.round(val)) : '';
    });
    setPartPricesDraft(draft);
  }, [order?.id]);

  const filteredCatalog = workSearch.trim()
    ? workCatalog.filter((w) => w.name.toLowerCase().includes(workSearch.toLowerCase().trim()))
    : workCatFilter
      ? workCatalog.filter((w) => (w.category ?? 'Прочее') === workCatFilter)
      : workCatalog;

  const catalogCategories = [...new Set(workCatalog.map((w) => w.category ?? 'Прочее'))].sort();

  const totalNormMin =
    order?.works
      .filter((w) => w.status !== 'cancelled')
      .reduce((s, w) => s + w.norm_minutes * (w.quantity ?? 1), 0) ?? 0;
  const allWorksCompleted =
    (order?.works.length ?? 0) > 0 && (order?.works ?? []).every((w) => w.status === 'completed');

  const hourlyRate = order?.machine_type === 'own' ? 1600 : 2000;
  const dynamicTotal = (order?.works ?? [])
    .filter((w) => w.status !== 'cancelled')
    .reduce((sum, w) => {
      if (editingWorkId === w.id && editWorkPrice !== '') {
        return sum + parseFloat(editWorkPrice || '0');
      }
      return sum + parseFloat(w.price_client ?? '0');
    }, 0);

  const [deletePassword, setDeletePassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteOrderMutation = useMutation({
    mutationFn: (password: string) =>
      fetch(`/api/garage/orders/${orderId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Ошибка');
        return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['garage-orders'] });
      onClose();
    },
    onError: (err: Error) => setDeleteError(err.message),
  });

  function printWorks() {
    if (!order) return;
    window.open(`/api/garage/orders/${orderId}/print?doc=works`, '_blank', 'width=900,height=1000');
  }

  function printParts() {
    if (!order) return;
    window.open(`/api/garage/orders/${orderId}/print?doc=parts`, '_blank', 'width=900,height=1000');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        backdropMouseDownOnSelf.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (backdropMouseDownOnSelf.current && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Наряд #{order?.order_number ?? '...'}
            </h2>
            {order && <p className="text-xs text-slate-400">{fmtDate(order.created_at)}</p>}
          </div>
          <div className="flex items-center gap-2">
            {isClosed && (
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">
                Закрыт
              </span>
            )}
            {order && (
              <>
                <button
                  onClick={printWorks}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center gap-1.5"
                  title="Заказ-наряд на работы (клиентский документ)"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                    />
                  </svg>
                  Наряд
                </button>
                <button
                  onClick={printParts}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-violet-200 text-violet-600 hover:bg-violet-50 flex items-center gap-1.5"
                  title="Перечень запчастей (внутренний документ)"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  Запчасти
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading && <div className="p-6 text-sm text-slate-400 animate-pulse">Загрузка...</div>}
          {order && (
            <div className="p-6 space-y-6">
              <div className="flex flex-wrap gap-2 items-center">
                <span
                  className={cn(
                    'text-xs font-semibold px-3 py-1 rounded-full',
                    STATUS_COLOR[order.status],
                  )}
                >
                  {STATUS_LABEL[order.status] ?? order.status}
                </span>
                <span
                  className={cn(
                    'text-xs font-semibold px-3 py-1 rounded-full',
                    PRIORITY_COLOR[order.priority],
                  )}
                >
                  {PRIORITY_LABEL[order.priority] ?? order.priority}
                </span>
                <span className="text-sm font-bold text-slate-700">
                  {order.machine_type === 'own'
                    ? `${order.asset?.short_name} · ${order.asset?.reg_number}`
                    : `${order.client_vehicle_brand ?? ''} ${order.client_vehicle_model ?? ''} · ${order.client_vehicle_reg ?? ''}`}
                </span>
              </div>
              {order.machine_type === 'client' && (order.client_name || order.client_phone) && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1 font-semibold uppercase">Клиент</p>
                  {order.client_name && (
                    <p className="text-sm font-medium text-slate-800">{order.client_name}</p>
                  )}
                  {order.client_phone && (
                    <p className="text-sm text-slate-500">{order.client_phone}</p>
                  )}
                </div>
              )}
              <div>
                <p className="text-xs text-slate-500 mb-1 font-semibold uppercase">Описание</p>
                <p className="text-sm text-slate-800">{order.problem_description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1 font-semibold uppercase">Статус</p>
                  <select
                    value={editStatus ?? order.status}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  >
                    {Object.entries(STATUS_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                  {editStatus && editStatus !== order.status && (
                    <button
                      onClick={() => patchMutation.mutate({ status: editStatus })}
                      disabled={patchMutation.isPending}
                      className="mt-1 text-xs text-blue-600 font-semibold hover:underline"
                    >
                      Сохранить
                    </button>
                  )}
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1 font-semibold uppercase">Приоритет</p>
                  <select
                    value={editPriority ?? order.priority}
                    onChange={(e) => setEditPriority(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  >
                    {Object.entries(PRIORITY_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                  {editPriority && editPriority !== order.priority && (
                    <button
                      onClick={() => patchMutation.mutate({ priority: editPriority })}
                      disabled={patchMutation.isPending}
                      className="mt-1 text-xs text-blue-600 font-semibold hover:underline"
                    >
                      Сохранить
                    </button>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-slate-500 font-semibold uppercase">
                    Работы ({order.works.length})
                  </p>
                  <button
                    onClick={() => setShowAddWork((v) => !v)}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors"
                  >
                    {showAddWork ? '✕ Закрыть' : '+ Добавить'}
                  </button>
                </div>

                {showAddWork && (
                  <div className="mb-3 border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex gap-2 items-center flex-wrap">
                      {!isCustomWork ? (
                        <>
                          <input
                            autoFocus
                            type="text"
                            value={workSearch}
                            onChange={(e) => {
                              setWorkSearch(e.target.value);
                              setAddWorkError(null);
                            }}
                            placeholder="Поиск по названию..."
                            className="flex-1 text-sm bg-transparent outline-none placeholder-slate-400 min-w-[150px]"
                          />
                          <button
                            type="button"
                            onClick={() => setIsCustomWork(true)}
                            className="text-xs font-semibold text-blue-600 hover:underline shrink-0"
                          >
                            Ввести вручную
                          </button>
                        </>
                      ) : (
                        <>
                          <input
                            autoFocus
                            type="text"
                            value={customWorkName}
                            onChange={(e) => {
                              setCustomWorkName(e.target.value);
                              setAddWorkError(null);
                            }}
                            placeholder="Название работы..."
                            className="flex-1 text-sm bg-white border border-slate-200 rounded px-2 py-1 outline-none min-w-[150px]"
                          />
                          <input
                            type="number"
                            value={customWorkPrice}
                            onChange={(e) => {
                              setCustomWorkPrice(e.target.value);
                              setAddWorkError(null);
                            }}
                            placeholder="Цена (₽)"
                            className="w-20 text-sm bg-white border border-slate-200 rounded px-2 py-1 outline-none shrink-0"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!customWorkName.trim()) {
                                setAddWorkError('Введите название работы');
                                return;
                              }
                              addWorkMutation.mutate({
                                custom_work_name: customWorkName,
                                price_client: customWorkPrice || undefined,
                                quantity: addWorkQty,
                              });
                            }}
                            disabled={addWorkMutation.isPending}
                            className="text-xs bg-blue-600 text-white px-2 py-1.5 rounded font-semibold disabled:opacity-50 shrink-0"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsCustomWork(false)}
                            className="text-xs text-slate-500 hover:text-slate-700 shrink-0"
                          >
                            Отмена
                          </button>
                        </>
                      )}
                      <div className="flex items-center gap-1 shrink-0 border border-slate-300 rounded-lg overflow-hidden bg-white">
                        <button
                          type="button"
                          onClick={() => setAddWorkQty((q) => Math.max(1, q - 1))}
                          className="px-2 py-1 text-slate-500 hover:bg-slate-100 text-sm font-bold"
                        >
                          −
                        </button>
                        <span className="px-1 text-sm font-bold text-slate-800 min-w-[20px] text-center">
                          {addWorkQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => setAddWorkQty((q) => q + 1)}
                          className="px-2 py-1 text-slate-500 hover:bg-slate-100 text-sm font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    {addWorkError && (
                      <div className="px-3 py-2 bg-red-50 border-b border-red-200">
                        <p className="text-xs text-red-700 font-medium">{addWorkError}</p>
                      </div>
                    )}
                    {!workSearch.trim() && (
                      <div className="px-3 py-2 flex gap-1.5 flex-wrap border-b border-slate-100 bg-slate-50/70">
                        {catalogCategories.map((cat) => (
                          <button
                            key={cat}
                            onClick={() => setWorkCatFilter(workCatFilter === cat ? null : cat)}
                            className={cn(
                              'text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors',
                              workCatFilter === cat
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400',
                            )}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    )}
                    {!isCustomWork && (
                      <div className="max-h-60 overflow-y-auto">
                        {!workSearch.trim() && !workCatFilter ? (
                          <p className="text-xs text-slate-400 px-3 py-4 italic text-center">
                            Выберите категорию или введите название для поиска
                          </p>
                        ) : filteredCatalog.length === 0 ? (
                          <p className="text-xs text-slate-400 px-3 py-3 italic">
                            Ничего не найдено
                          </p>
                        ) : (
                          filteredCatalog.map((w) => (
                            <button
                              key={w.id}
                              onClick={() =>
                                addWorkMutation.mutate({
                                  work_catalog_id: w.id,
                                  quantity: addWorkQty,
                                })
                              }
                              disabled={addWorkMutation.isPending}
                              className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-slate-100 last:border-0 flex justify-between items-center group disabled:opacity-50"
                            >
                              <span className="text-sm text-slate-800 group-hover:text-blue-700">
                                {w.name}
                              </span>
                              <span className="text-xs text-slate-400 shrink-0 ml-2">
                                {(w.norm_minutes / 60).toFixed(1)} нч
                                {w.default_price_client
                                  ? ` · ${parseInt(w.default_price_client).toLocaleString('ru-RU')} ₽`
                                  : ''}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                {order.works.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">Работы не добавлены</p>
                ) : (
                  <div className="space-y-1">
                    {order.works.map((w) => {
                      const name = w.work_catalog?.name ?? w.custom_work_name ?? 'Без названия';
                      const isEditing = editingWorkId === w.id;
                      const isDone = w.status === 'completed';
                      const workCode = (w.work_catalog as unknown as { code?: string } | null)
                        ?.code;
                      const priceNum = parseFloat(w.price_client ?? '0');
                      const normHours = (w.norm_minutes * (w.quantity ?? 1)) / 60;
                      return (
                        <div key={w.id}>
                          <div
                            className={cn(
                              'group flex items-center gap-2 rounded-lg px-3 py-2.5 transition-all duration-150',
                              'hover:shadow-md hover:scale-[1.01] cursor-default',
                              isDone
                                ? 'bg-emerald-50/60 border border-emerald-100'
                                : 'bg-slate-50 border border-transparent',
                            )}
                          >
                            {/* Status circle */}
                            <div
                              className={cn(
                                'w-2.5 h-2.5 rounded-full flex-shrink-0',
                                isDone ? 'bg-emerald-500' : 'bg-red-400',
                              )}
                            />

                            {/* Name + hours */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800 leading-snug">
                                {name}
                                {(w.quantity ?? 1) > 1 && (
                                  <span className="ml-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                    ×{w.quantity}
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-slate-400">
                                {normHours.toFixed(1)} нч
                                {w.actual_minutes
                                  ? ` · факт ${(w.actual_minutes / 60).toFixed(1)} нч`
                                  : ''}
                              </p>
                            </div>

                            {/* Price — prominent */}
                            <span
                              className={cn(
                                'text-base font-black shrink-0',
                                isDone ? 'text-emerald-700' : 'text-slate-700',
                              )}
                            >
                              {priceNum > 0 ? `${priceNum.toLocaleString('ru-RU')} ₽` : '—'}
                            </span>

                            {/* Edit pencil — grows on hover */}
                            <button
                              onClick={() => {
                                if (isEditing) {
                                  setEditingWorkId(null);
                                  return;
                                }
                                setEditingWorkId(w.id);
                                setEditWorkPrice(
                                  w.price_client ?? String(Math.round(normHours * hourlyRate)),
                                );
                                setEditWorkDesc(
                                  w.work_description ??
                                    (workCode ? (DEFAULT_WORK_DESCRIPTIONS[workCode] ?? '') : ''),
                                );
                                setEditWorkQty(w.quantity ?? 1);
                                setEditWorkMechanic(w.mechanic_id ?? null);
                                setEditWorkSecondMechanic(w.second_mechanic_id ?? null);
                              }}
                              className="shrink-0 text-slate-300 group-hover:text-blue-500 transition-all duration-150 text-base hover:text-2xl hover:text-blue-700"
                              title="Редактировать"
                            >
                              ✏
                            </button>

                            {/* Delete */}
                            {confirmDeleteWorkId === w.id ? (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => {
                                    deleteWorkMutation.mutate(w.id);
                                    setConfirmDeleteWorkId(null);
                                  }}
                                  disabled={deleteWorkMutation.isPending}
                                  className="text-xs font-semibold text-rose-600 hover:text-rose-800 px-2 py-0.5 rounded bg-rose-50 border border-rose-200"
                                >
                                  Удалить
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteWorkId(null)}
                                  className="text-xs text-slate-400 hover:text-slate-600 px-1.5 py-0.5"
                                >
                                  Отмена
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteWorkId(w.id)}
                                className="text-slate-300 hover:text-rose-500 text-lg leading-none shrink-0"
                                title="Удалить"
                              >
                                ×
                              </button>
                            )}
                          </div>

                          {/* Edit panel */}
                          {isEditing &&
                            (() => {
                              const editPrice = parseFloat(editWorkPrice || '0');
                              const computedMinutes =
                                editPrice > 0
                                  ? Math.max(1, Math.round((editPrice / hourlyRate) * 60))
                                  : w.norm_minutes * editWorkQty;
                              const computedHours = computedMinutes / 60;
                              return (
                                <div className="mx-1 mb-1 border border-blue-200 bg-blue-50 rounded-b-xl px-4 py-3 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-black text-blue-800 uppercase tracking-wide">
                                      {isDone ? 'Редактировать работу' : 'Отметить выполненной'}
                                    </p>
                                    <span className="text-xs text-blue-500">
                                      Тариф: {hourlyRate.toLocaleString('ru-RU')} ₽/ч
                                    </span>
                                  </div>

                                  {/* Price + computed hours */}
                                  <div className="flex gap-3 items-end">
                                    <div className="flex-1">
                                      <label className="text-xs text-slate-500 block mb-1">
                                        Стоимость (₽)
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        step="100"
                                        value={editWorkPrice}
                                        onChange={(e) => setEditWorkPrice(e.target.value)}
                                        className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                                        placeholder="0"
                                      />
                                    </div>
                                    <div className="shrink-0 pb-1 text-right">
                                      <p className="text-xs text-slate-400">автоматически</p>
                                      <p className="text-lg font-black text-blue-700">
                                        {computedHours.toFixed(1)} нч
                                      </p>
                                    </div>
                                    <div style={{ width: '72px' }}>
                                      <label className="text-xs text-slate-500 block mb-1 text-center">
                                        Кол-во
                                      </label>
                                      <div className="flex items-center border border-blue-200 rounded-lg overflow-hidden bg-white">
                                        <button
                                          type="button"
                                          onClick={() => setEditWorkQty((q) => Math.max(1, q - 1))}
                                          className="px-2 py-2 text-slate-500 hover:bg-slate-100 text-sm font-bold"
                                        >
                                          −
                                        </button>
                                        <span className="flex-1 text-center text-sm font-semibold text-slate-800">
                                          {editWorkQty}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => setEditWorkQty((q) => q + 1)}
                                          className="px-2 py-2 text-slate-500 hover:bg-slate-100 text-sm font-bold"
                                        >
                                          +
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Description */}
                                  <div>
                                    <label className="text-xs text-slate-500 block mb-1">
                                      Описание для заказ-наряда
                                    </label>
                                    <textarea
                                      rows={2}
                                      value={editWorkDesc}
                                      onChange={(e) => setEditWorkDesc(e.target.value)}
                                      placeholder="Что именно сделано..."
                                      className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm resize-none bg-white"
                                    />
                                  </div>

                                  {/* Mechanic */}
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-xs text-slate-500 block mb-1">
                                        Исполнитель
                                      </label>
                                      <select
                                        value={editWorkMechanic ?? ''}
                                        onChange={(e) => setEditWorkMechanic(e.target.value)}
                                        className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white"
                                      >
                                        <option value="">— Не назначен —</option>
                                        {mechanics.map((m) => (
                                          <option key={m.id} value={m.id}>
                                            {m.name}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-xs text-slate-500 block mb-1">
                                        2-й исполнитель (опц.)
                                      </label>
                                      <select
                                        value={editWorkSecondMechanic ?? ''}
                                        onChange={(e) => setEditWorkSecondMechanic(e.target.value)}
                                        className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white"
                                        disabled={!editWorkMechanic}
                                      >
                                        <option value="">— Нет —</option>
                                        {mechanics.map((m) => (
                                          <option
                                            key={m.id}
                                            value={m.id}
                                            disabled={m.id === editWorkMechanic}
                                          >
                                            {m.name}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>

                                  {/* Actions */}
                                  <div className="flex gap-2">
                                    {!order.mechanic && !(editMechanic && editMechanic !== '') ? (
                                      <div className="flex-1 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold py-2 rounded-lg text-center">
                                        Сначала назначьте механика
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() =>
                                          patchWorkMutation.mutate({
                                            workId: w.id,
                                            body: {
                                              quantity: editWorkQty,
                                              actual_minutes: computedMinutes,
                                              price_client:
                                                editPrice > 0 ? editPrice.toFixed(2) : undefined,
                                              work_description: editWorkDesc || null,
                                              mechanic_id: editWorkMechanic || null,
                                              second_mechanic_id: editWorkSecondMechanic || null,
                                              status: 'completed',
                                            },
                                          })
                                        }
                                        disabled={patchWorkMutation.isPending}
                                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black py-2 rounded-lg disabled:opacity-50 uppercase tracking-wide"
                                      >
                                        {patchWorkMutation.isPending
                                          ? '...'
                                          : isDone
                                            ? '✓ Обновить'
                                            : '✓ Выполнено'}
                                      </button>
                                    )}
                                    {isDone && (
                                      <button
                                        onClick={() =>
                                          patchWorkMutation.mutate({
                                            workId: w.id,
                                            body: {
                                              quantity: editWorkQty,
                                              actual_minutes: computedMinutes,
                                              price_client:
                                                editPrice > 0 ? editPrice.toFixed(2) : undefined,
                                              work_description: editWorkDesc || null,
                                              mechanic_id: editWorkMechanic || null,
                                              second_mechanic_id: editWorkSecondMechanic || null,
                                            },
                                          })
                                        }
                                        disabled={patchWorkMutation.isPending}
                                        className="flex-1 bg-slate-700 hover:bg-slate-800 text-white text-xs font-black py-2 rounded-lg disabled:opacity-50 uppercase tracking-wide"
                                      >
                                        Сохранить
                                      </button>
                                    )}
                                    <button
                                      onClick={() => setEditingWorkId(null)}
                                      className="px-3 text-xs text-slate-500 hover:text-slate-700"
                                    >
                                      Отмена
                                    </button>
                                  </div>
                                  {patchWorkMutation.isError && (
                                    <div className="text-xs text-red-600 font-semibold bg-red-50 px-3 py-2 rounded-lg border border-red-100">
                                      Ошибка:{' '}
                                      {patchWorkMutation.error instanceof Error
                                        ? patchWorkMutation.error.message
                                        : 'Неизвестная ошибка'}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* Parts section regardless of length, so we can add to empty order */}
              <div className={order.parts.length === 0 && !showAddPart ? 'mb-2' : 'mb-0'}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-500 font-semibold uppercase">
                      Запчасти ({order.parts.length})
                    </p>
                    {order.parts.length > 0 && (
                      <p className="text-[10px] text-slate-400 italic hidden sm:block">
                        — цена пустая = запчасть клиента
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setShowAddPart((v) => !v)}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors"
                  >
                    {showAddPart ? '✕ Закрыть' : '+ Добавить'}
                  </button>
                </div>
                {showAddPart && (
                  <div className="mb-3 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl flex gap-2 items-center flex-wrap">
                    <input
                      autoFocus
                      type="text"
                      value={addPartName}
                      onChange={(e) => {
                        setAddPartName(e.target.value);
                        setAddPartError(null);
                      }}
                      placeholder="Название запчасти..."
                      className="flex-1 text-sm bg-white border border-slate-200 rounded px-2 py-1.5 outline-none min-w-[150px]"
                    />
                    <input
                      type="number"
                      value={addPartPrice}
                      onChange={(e) => {
                        setAddPartPrice(e.target.value);
                        setAddPartError(null);
                      }}
                      placeholder="Цена (₽)"
                      className="w-20 text-sm bg-white border border-slate-200 rounded px-2 py-1.5 outline-none shrink-0"
                    />
                    <div className="flex items-center gap-1 shrink-0 border border-slate-300 rounded-lg overflow-hidden bg-white">
                      <button
                        type="button"
                        onClick={() => setAddPartQty((q) => Math.max(1, q - 1))}
                        className="px-2 py-1.5 text-slate-500 hover:bg-slate-100 text-sm font-bold"
                      >
                        −
                      </button>
                      <span className="px-1 text-sm font-bold text-slate-800 min-w-[20px] text-center">
                        {addPartQty}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAddPartQty((q) => q + 1)}
                        className="px-2 py-1.5 text-slate-500 hover:bg-slate-100 text-sm font-bold"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!addPartName.trim()) {
                          setAddPartError('Введите название');
                          return;
                        }
                        addPartMutation.mutate({
                          custom_part_name: addPartName,
                          client_price: addPartPrice || undefined,
                          quantity: addPartQty,
                        });
                      }}
                      disabled={addPartMutation.isPending}
                      className="text-xs bg-slate-900 text-white px-3 py-2 rounded-lg font-semibold disabled:opacity-50 shrink-0"
                    >
                      Добавить
                    </button>
                    {addPartError && (
                      <div className="w-full mt-1">
                        <p className="text-xs text-red-600 font-medium">{addPartError}</p>
                      </div>
                    )}
                  </div>
                )}
                {order.parts.length > 0 && (
                  <>
                    <div className="space-y-1">
                      {order.parts.map((p) => {
                        const partName = p.part?.name ?? p.custom_part_name ?? '—';
                        const partUnit = p.part?.unit ?? p.unit ?? 'шт';
                        const draft = partPricesDraft[p.id] ?? '';
                        const savedPrice = parseFloat(p.client_price ?? '0');
                        return (
                          <div
                            key={p.id}
                            className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 group"
                          >
                            <span className="text-sm text-slate-800 flex-1 truncate">
                              {partName}
                            </span>
                            <span className="text-xs text-slate-500 shrink-0">
                              {p.quantity} {partUnit}
                            </span>
                            <div className="flex items-center shrink-0">
                              <input
                                type="number"
                                min="0"
                                value={draft}
                                onChange={(e) =>
                                  setPartPricesDraft((prev) => ({
                                    ...prev,
                                    [p.id]: e.target.value,
                                  }))
                                }
                                onBlur={() => {
                                  const newVal = parseFloat(draft || '0');
                                  if (Math.abs(newVal - savedPrice) > 0.01) {
                                    patchPartMutation.mutate({
                                      partId: p.id,
                                      client_price: newVal.toFixed(2),
                                    });
                                  }
                                }}
                                placeholder="Клиент"
                                className="w-24 text-right text-sm border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                              />
                              <span className="text-xs text-slate-400 ml-1.5">₽</span>
                              <button
                                onClick={() => deletePartMutation.mutate(p.id)}
                                disabled={deletePartMutation.isPending}
                                className="ml-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Удалить"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {order.parts.some((p) => parseFloat(p.client_price ?? '0') > 0) && (
                      <div className="mt-1.5 flex justify-end text-xs text-slate-500">
                        Итого запчасти:{' '}
                        <span className="font-semibold text-slate-700 ml-1">
                          {order.parts
                            .reduce(
                              (s, p) => s + parseFloat(p.client_price ?? '0') * (p.quantity ?? 1),
                              0,
                            )
                            .toLocaleString('ru-RU')}{' '}
                          ₽
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1 font-semibold uppercase">
                  Заметка (admin)
                </p>
                {editNote === null ? (
                  <div className="flex items-start gap-2">
                    <p className="text-sm text-slate-700 flex-1">
                      {order.admin_note || (
                        <span className="italic text-slate-400">Нет заметки</span>
                      )}
                    </p>
                    <button
                      onClick={() => setEditNote(order.admin_note ?? '')}
                      className="text-xs text-blue-600 hover:underline shrink-0"
                    >
                      Изменить
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      rows={3}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => patchMutation.mutate({ admin_note: editNote })}
                        disabled={patchMutation.isPending}
                        className="text-xs bg-slate-900 text-white px-4 py-1.5 rounded-lg font-semibold"
                      >
                        Сохранить
                      </button>
                      <button
                        onClick={() => setEditNote(null)}
                        className="text-xs text-slate-400 hover:text-slate-700"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {order.mechanic_note && (
                <div>
                  <p className="text-xs text-slate-500 mb-1 font-semibold uppercase">
                    Заметка механика
                  </p>
                  <p className="text-sm text-slate-700">{order.mechanic_note}</p>
                </div>
              )}
              {order.lifecycle_status === 'approved' &&
                (order.mechanic_pay || order.second_mechanic_pay) && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <p className="text-xs text-slate-500 mb-2 font-semibold uppercase">
                      ЗП начислено
                    </p>
                    {order.mechanic_pay && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-700">{order.mechanic?.name ?? 'Механик'}</span>
                        <span className="font-black text-emerald-700">
                          <Money amount={order.mechanic_pay} />
                        </span>
                      </div>
                    )}
                    {order.second_mechanic_pay && (
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-slate-700">
                          {order.second_mechanic?.name ?? 'Механик 2'}
                        </span>
                        <span className="font-black text-emerald-700">
                          <Money amount={order.second_mechanic_pay} />
                        </span>
                      </div>
                    )}
                  </div>
                )}
              <div className="border border-red-100 rounded-xl p-4 space-y-2">
                {!showDeleteConfirm ? (
                  <div className="flex gap-2">
                    {order.lifecycle_status === 'approved' && (
                      <button
                        onClick={() => {
                          patchMutation.mutate({ lifecycle_status: 'draft' });
                          onClose();
                        }}
                        disabled={patchMutation.isPending}
                        className="flex-1 border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold py-2 rounded-xl text-sm"
                      >
                        Открыть заново
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(true);
                        setDeleteError(null);
                      }}
                      className="flex-1 border border-red-200 text-red-500 hover:bg-red-50 font-semibold py-2 rounded-xl text-sm"
                    >
                      Удалить наряд
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-red-700">
                      Удаление необратимо — будут удалены работы, запчасти, таймеры и все
                      начисленные транзакции (ЗП, выручка СТО).
                    </p>
                    <input
                      type="password"
                      value={deletePassword}
                      onChange={(e) => {
                        setDeletePassword(e.target.value);
                        setDeleteError(null);
                      }}
                      placeholder="Пароль администратора"
                      className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') deleteOrderMutation.mutate(deletePassword);
                      }}
                    />
                    {deleteError && <p className="text-xs text-red-600">{deleteError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => deleteOrderMutation.mutate(deletePassword)}
                        disabled={deleteOrderMutation.isPending}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-xl text-sm disabled:opacity-50"
                      >
                        {deleteOrderMutation.isPending ? '...' : 'Удалить безвозвратно'}
                      </button>
                      <button
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeletePassword('');
                          setDeleteError(null);
                        }}
                        className="flex-1 border border-slate-200 text-slate-600 font-semibold py-2 rounded-xl text-sm"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        {order && (
          <div className="flex-shrink-0 border-t border-slate-100 px-6 py-4 bg-slate-50/50 rounded-b-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide">
                  Итого
                </p>
                <p className="text-2xl font-black text-slate-900">
                  {dynamicTotal.toLocaleString('ru-RU')} ₽
                </p>
                {totalNormMin > 0 && (
                  <p className="text-xs text-slate-400">{(totalNormMin / 60).toFixed(1)} нч план</p>
                )}
              </div>
              {!isClosed && allWorksCompleted && (
                <button
                  onClick={() => {
                    setShowCloseDialog(true);
                  }}
                  disabled={patchMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl text-sm disabled:opacity-50 shrink-0"
                >
                  Завершить наряд →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Диалог закрытия наряда с вводом зарплат */}
        {showCloseDialog &&
          order &&
          (() => {
            const worksTotal = order.works
              .filter((w) => w.status !== 'cancelled')
              .reduce((s, w) => s + parseFloat(w.price_client ?? '0'), 0);
            const partsTotal = order.parts.reduce(
              (s, p) => s + parseFloat(p.client_price ?? '0') * (p.quantity ?? 1),
              0,
            );
            const orderTotal = worksTotal + partsTotal;
            const totalActMin = order.works
              .filter((w) => w.status === 'completed')
              .reduce((s, w) => s + (w.actual_minutes > 0 ? w.actual_minutes : w.norm_minutes), 0);

            let totalPay = 0;
            order.works.forEach((w) => {
              if (w.status === 'cancelled') return;
              const mechs = [w.mechanic_id, w.second_mechanic_id].filter(Boolean);
              if (mechs.length === 0) return;
              const workPrice = parseFloat(w.price_client ?? '0');
              if (workPrice <= 0) return;
              const basePrice = mechs.length === 2 ? workPrice / 2 : workPrice;
              for (const mechId of mechs) {
                const mech = mechanics.find((m) => m.id === mechId);
                if (mech) {
                  const pct = parseFloat((mech as MechanicWithPct).mechanic_salary_pct ?? '50');
                  totalPay += (basePrice * pct) / 100;
                }
              }
            });
            const margin = orderTotal - totalPay;
            const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU');

            return (
              <div
                className="absolute inset-0 z-10 bg-white rounded-2xl flex flex-col"
                onMouseDown={(e) => e.stopPropagation()}
              >
                {/* Шапка */}
                <div className="flex-shrink-0 border-b border-slate-200 px-6 py-4 flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Завершить наряд #{order.order_number}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {order.machine_type === 'own'
                        ? `${order.asset?.short_name ?? ''} · ${order.asset?.reg_number ?? ''}`
                        : `${order.client_vehicle_brand ?? ''} ${order.client_vehicle_model ?? ''} · ${order.client_vehicle_reg ?? ''}`}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCloseDialog(false)}
                    className="text-slate-400 hover:text-slate-600 text-2xl leading-none ml-4"
                  >
                    ×
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                  {/* Итог по наряду */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 rounded-xl p-3 text-center">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">
                        Выручка
                      </p>
                      <p className="text-lg font-black text-slate-900">{fmt(orderTotal)} ₽</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 text-center">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">
                        Факт. часов
                      </p>
                      <p className="text-lg font-black text-slate-900">
                        {(totalActMin / 60).toFixed(1)} ч
                      </p>
                    </div>
                    <div
                      className={cn(
                        'rounded-xl p-3 text-center',
                        margin >= 0 ? 'bg-emerald-50' : 'bg-red-50',
                      )}
                    >
                      <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">
                        Маржа
                      </p>
                      <p
                        className={cn(
                          'text-lg font-black',
                          margin >= 0 ? 'text-emerald-700' : 'text-red-600',
                        )}
                      >
                        {fmt(margin)} ₽
                      </p>
                    </div>
                  </div>

                  {/* Список работ */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Работы
                    </div>
                    {order.works
                      .filter((w) => w.status !== 'cancelled')
                      .map((w) => (
                        <div
                          key={w.id}
                          className="flex items-center justify-between px-3 py-2 border-t border-slate-100 text-sm"
                        >
                          <span className="text-slate-700 truncate mr-2">
                            {w.work_catalog?.name ?? w.custom_work_name ?? '—'}
                          </span>
                          <span className="font-semibold text-slate-900 shrink-0">
                            {parseFloat(w.price_client ?? '0').toLocaleString('ru-RU')} ₽
                          </span>
                        </div>
                      ))}
                  </div>

                  {/* Запчасти */}
                  {order.parts.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                        <span>Запчасти</span>
                        {partsTotal > 0 && (
                          <span className="text-slate-600 normal-case font-semibold">
                            {partsTotal.toLocaleString('ru-RU')} ₽
                          </span>
                        )}
                      </div>
                      {order.parts.map((p) => {
                        const pPrice = parseFloat(p.client_price ?? '0');
                        const pName = p.part?.name ?? p.custom_part_name ?? '—';
                        const pUnit = p.part?.unit ?? p.unit ?? 'шт';
                        return (
                          <div
                            key={p.id}
                            className="flex items-center justify-between px-3 py-2 border-t border-slate-100 text-sm"
                          >
                            <span className="text-slate-700 truncate mr-2">
                              {pName}
                              <span className="text-slate-400 text-xs ml-1">
                                × {p.quantity} {pUnit}
                              </span>
                            </span>
                            {pPrice > 0 ? (
                              <span className="font-semibold text-slate-900 shrink-0">
                                {(pPrice * (p.quantity ?? 1)).toLocaleString('ru-RU')} ₽
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 italic shrink-0">Клиент</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ЗП механиков */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Зарплата исполнителей
                    </p>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-800 text-sm">
                      Зарплата исполнителям рассчитывается и начисляется автоматически по каждой
                      выполненной работе. Ручной ввод при закрытии наряда больше не требуется.
                    </div>
                  </div>
                </div>

                {/* Кнопки */}
                <div className="flex-shrink-0 border-t border-slate-100 px-6 py-4 flex gap-3">
                  <button
                    onClick={() => setShowCloseDialog(false)}
                    className="flex-1 border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold py-2.5 rounded-xl text-sm"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={() => {
                      const updates: Record<string, unknown> = {
                        lifecycle_status: 'approved',
                      };
                      patchMutation.mutate(updates);
                      setShowCloseDialog(false);
                      onClose();
                    }}
                    disabled={patchMutation.isPending}
                    className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50"
                  >
                    {patchMutation.isPending ? 'Сохраняем...' : 'Подтвердить и закрыть наряд'}
                  </button>
                </div>
              </div>
            );
          })()}
      </div>
    </div>
  );
}

// ─── Client Vehicle Selector ──────────────────────────────────────────────────

interface CounterpartyOption {
  id: string;
  name: string;
  phone: string | null;
}

function CounterpartySubForm({
  value,
  onChange,
  stoOnly = false,
}: {
  value: CounterpartyOption | null;
  onChange: (v: CounterpartyOption | null) => void;
  stoOnly?: boolean;
}) {
  const [cpSearch, setCpSearch] = useState('');
  const [showNewCp, setShowNewCp] = useState(false);
  const [newCpName, setNewCpName] = useState('');
  const [newCpPhone, setNewCpPhone] = useState('');
  const queryClient = useQueryClient();

  const { data: cpResults = [] } = useQuery<CounterpartyOption[]>({
    queryKey: ['cp-search', cpSearch, stoOnly],
    queryFn: async () => {
      const params = new URLSearchParams({ q: cpSearch });
      if (stoOnly) params.set('sto_only', '1');
      const r = await fetch(`/api/counterparties/search?${params}`);
      if (!r.ok) throw new Error('Ошибка загрузки');
      return r.json();
    },
    staleTime: 10_000,
  });

  const createCpMutation = useMutation({
    mutationFn: async () => {
      if (!newCpName.trim()) throw new Error('Введите имя клиента');
      const r = await fetch('/api/counterparties/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCpName.trim(), phone: newCpPhone.trim() || null }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Ошибка');
      return r.json() as Promise<CounterpartyOption>;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['cp-search'] });
      onChange(created);
      setShowNewCp(false);
      setNewCpName('');
      setNewCpPhone('');
    },
  });

  if (value) {
    return (
      <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{value.name}</p>
          {value.phone && <p className="text-xs text-slate-400">{value.phone}</p>}
        </div>
        <button
          onClick={() => onChange(null)}
          className="text-slate-400 hover:text-slate-600 text-lg leading-none ml-2"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {!showNewCp ? (
        <>
          <input
            value={cpSearch}
            onChange={(e) => setCpSearch(e.target.value)}
            placeholder="Поиск клиента по имени/телефону..."
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white"
          />
          {cpResults.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-32 overflow-y-auto">
              {cpResults.map((cp, i) => (
                <button
                  key={cp.id}
                  type="button"
                  onClick={() => {
                    onChange(cp);
                    setCpSearch('');
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 hover:bg-slate-50 text-sm',
                    i < cpResults.length - 1 && 'border-b border-slate-100',
                  )}
                >
                  <span className="font-medium text-slate-900">{cp.name}</span>
                  {cp.phone && <span className="text-slate-400 text-xs ml-2">{cp.phone}</span>}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowNewCp(true)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            + Новый клиент
          </button>
        </>
      ) : (
        <div className="space-y-1.5 bg-blue-50 border border-blue-100 rounded-lg p-2.5">
          <input
            value={newCpName}
            onChange={(e) => setNewCpName(e.target.value)}
            placeholder="Имя клиента *"
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white"
          />
          <input
            value={newCpPhone}
            onChange={(e) => setNewCpPhone(e.target.value)}
            placeholder="Телефон"
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white"
          />
          {createCpMutation.isError && (
            <p className="text-xs text-red-500">{(createCpMutation.error as Error).message}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowNewCp(false)}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 text-slate-600"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => createCpMutation.mutate()}
              disabled={createCpMutation.isPending}
              className="flex-[2] py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white disabled:bg-blue-300"
            >
              {createCpMutation.isPending ? '...' : 'Добавить клиента'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ClientVehicleSelector({
  value,
  onChange,
}: {
  value: ClientVehicle | null;
  onChange: (v: ClientVehicle | null) => void;
}) {
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newBrand, setNewBrand] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newReg, setNewReg] = useState('');
  const [newCounterparty, setNewCounterparty] = useState<CounterpartyOption | null>(null);
  const queryClient = useQueryClient();

  const { data: results = [], isFetching } = useQuery<ClientVehicle[]>({
    queryKey: ['client-vehicles-search', search],
    queryFn: async () => {
      const r = await fetch(`/api/garage/client-vehicles?search=${encodeURIComponent(search)}`);
      if (!r.ok) throw new Error('Ошибка загрузки');
      return r.json();
    },
    staleTime: 10_000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!newBrand.trim() || !newReg.trim()) throw new Error('Марка и госномер обязательны');
      const r = await fetch('/api/garage/client-vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: newBrand.trim(),
          model: newModel.trim() || null,
          reg_number: newReg.trim(),
          counterparty_id: newCounterparty?.id ?? null,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Ошибка');
      return r.json() as Promise<ClientVehicle>;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['client-vehicles-search'] });
      onChange(created);
      setShowCreate(false);
      setNewBrand('');
      setNewModel('');
      setNewReg('');
      setNewCounterparty(null);
    },
  });

  if (value) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {value.brand} {value.model} · {value.reg_number}
          </p>
          {value.counterparty && (
            <p className="text-xs text-slate-500">{value.counterparty.name}</p>
          )}
        </div>
        <button
          onClick={() => onChange(null)}
          className="text-slate-400 hover:text-slate-700 text-lg font-bold leading-none ml-3"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setShowCreate(false);
          }}
          placeholder="Поиск по марке, модели, госномеру..."
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
        {isFetching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            ...
          </span>
        )}
      </div>

      {results.length > 0 && (
        <div className="border border-slate-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
          {results.map((v, i) => (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                onChange(v);
                setSearch('');
              }}
              className={cn(
                'w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors',
                i < results.length - 1 && 'border-b border-slate-100',
              )}
            >
              <p className="text-sm font-medium text-slate-900">
                {v.brand} {v.model} · {v.reg_number}
              </p>
              {v.counterparty && <p className="text-xs text-slate-400">{v.counterparty.name}</p>}
            </button>
          ))}
        </div>
      )}

      {!showCreate ? (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="text-xs font-semibold text-blue-600 hover:text-blue-800"
        >
          + Добавить новый автомобиль
        </button>
      ) : (
        <div className="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50">
          <p className="text-xs font-semibold text-slate-500 uppercase">Новый автомобиль</p>
          <input
            value={newBrand}
            onChange={(e) => setNewBrand(e.target.value)}
            placeholder="Марка (Toyota) *"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
          />
          <input
            value={newModel}
            onChange={(e) => setNewModel(e.target.value)}
            placeholder="Модель (Camry)"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
          />
          <input
            value={newReg}
            onChange={(e) => setNewReg(e.target.value)}
            placeholder="Госномер (А001АА96) *"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
          />
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">
              Клиент (необязательно)
            </p>
            <CounterpartySubForm value={newCounterparty} onChange={setNewCounterparty} />
          </div>
          {createMutation.isError && (
            <p className="text-xs text-red-500">{(createMutation.error as Error).message}</p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setNewCounterparty(null);
              }}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 text-slate-600"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="flex-[2] py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white disabled:bg-slate-400"
            >
              {createMutation.isPending ? 'Сохраняем...' : 'Сохранить и выбрать'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateOrderModal({ onClose, assets }: { onClose: () => void; assets: Asset[] }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [selectedClientVehicle, setSelectedClientVehicle] = useState<ClientVehicle | null>(null);
  const [error, setError] = useState('');
  const createMutation = useMutation({
    mutationFn: async () => {
      if (form.machine_type === 'own' && !form.asset_id) {
        throw new Error('Выберите автомобиль из парка');
      }
      if (form.machine_type === 'client' && !selectedClientVehicle) {
        throw new Error('Выберите или создайте клиентский автомобиль');
      }

      const r = await fetch('/api/garage/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          client_vehicle_id: form.machine_type === 'client' ? selectedClientVehicle?.id : undefined,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? 'Ошибка');
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['garage-orders'] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });
  const set = (field: keyof typeof emptyForm, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Новый наряд</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">
              Тип машины *
            </label>
            <div className="flex gap-2">
              {(['own', 'client'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => set('machine_type', t)}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-sm font-semibold',
                    form.machine_type === t
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {t === 'own' ? 'Своя машина' : 'Клиентская'}
                </button>
              ))}
            </div>
          </div>
          {form.machine_type === 'own' ? (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">
                Машина *
              </label>
              <select
                value={form.asset_id}
                onChange={(e) => set('asset_id', e.target.value)}
                className={cn(
                  'w-full border rounded-lg px-3 py-2 text-sm',
                  !form.asset_id ? 'border-red-400 bg-red-50' : 'border-slate-200',
                )}
              >
                <option value="">— Выберите машину —</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.short_name} · {a.reg_number}
                  </option>
                ))}
              </select>
              {!form.asset_id && <p className="text-xs text-red-500 mt-0.5">Обязательно</p>}
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">
                Автомобиль клиента *
              </label>
              <ClientVehicleSelector
                value={selectedClientVehicle}
                onChange={setSelectedClientVehicle}
              />
              {!selectedClientVehicle && <p className="text-xs text-red-500 mt-0.5">Обязательно</p>}
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">
              Описание проблемы *
            </label>
            <textarea
              value={form.problem_description}
              onChange={(e) => set('problem_description', e.target.value)}
              rows={3}
              placeholder="Что случилось..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">
                Приоритет
              </label>
              <select
                value={form.priority}
                onChange={(e) => set('priority', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                {Object.entries(PRIORITY_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">
              Заметка
            </label>
            <input
              value={form.admin_note}
              onChange={(e) => set('admin_note', e.target.value)}
              placeholder="Дополнительно..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm font-semibold"
            >
              Отмена
            </button>
            <button
              onClick={() => createMutation.mutate()}
              disabled={
                createMutation.isPending ||
                (form.machine_type === 'own' ? !form.asset_id : !selectedClientVehicle) ||
                !form.problem_description.trim()
              }
              className="flex-[2] bg-slate-900 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {createMutation.isPending ? 'Создаём...' : 'Создать наряд'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type TabOrder = Omit<OrderRow, 'works'> & {
  lifecycle_status?: string;
  payment_received?: boolean;
  mechanic_note?: string | null;
  admin_note?: string | null;
  client_vehicle_model?: string | null;
  client_name?: string | null;
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
    quantity: number;
    unit_price?: string | null;
    part: { name: string; unit: string };
  }>;
};

// ─── Date Navigation ─────────────────────────────────────────────────────────

function DateNav({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const today = todayStr();
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => {
          const d = new Date(date);
          d.setDate(d.getDate() - 1);
          onChange(d.toISOString().slice(0, 10));
        }}
        className="p-1.5 rounded-lg hover:bg-slate-100"
      >
        <span className="material-symbols-outlined text-slate-500 text-[18px]">chevron_left</span>
      </button>
      <input
        type="date"
        value={date}
        max={today}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm font-semibold text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5"
      />
      <button
        onClick={() => {
          const d = new Date(date);
          d.setDate(d.getDate() + 1);
          onChange(d.toISOString().slice(0, 10));
        }}
        disabled={date >= today}
        className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30"
      >
        <span className="material-symbols-outlined text-slate-500 text-[18px]">chevron_right</span>
      </button>
      {date !== today && (
        <button
          onClick={() => onChange(today)}
          className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded border border-slate-200"
        >
          Сегодня
        </button>
      )}
    </div>
  );
}

function MonthNav({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const [y, mn] = month.split('-').map(Number) as [number, number];
  const shift = (delta: number) => {
    let newM = mn + delta;
    let newY = y;
    if (newM > 12) {
      newM = 1;
      newY += 1;
    }
    if (newM < 1) {
      newM = 12;
      newY -= 1;
    }
    onChange(`${newY}-${String(newM).padStart(2, '0')}`);
  };
  const currentMonth = todayStr().slice(0, 7);
  const label = new Date(y, mn - 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => shift(-1)} className="p-1.5 rounded-lg hover:bg-slate-100">
        <span className="material-symbols-outlined text-slate-500 text-[18px]">chevron_left</span>
      </button>
      <span className="text-sm font-semibold text-slate-700 capitalize min-w-[120px] text-center">
        {label}
      </span>
      <button
        onClick={() => shift(1)}
        disabled={month >= currentMonth}
        className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30"
      >
        <span className="material-symbols-outlined text-slate-500 text-[18px]">chevron_right</span>
      </button>
    </div>
  );
}

// ═══════════════════════════ DASHBOARD ═══════════════════════════════════════

function DashboardSection({
  onNav,
  onCreateOrder,
}: {
  onNav: (s: GarageSection) => void;
  onCreateOrder: () => void;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['garage-dashboard'],
    queryFn: () => fetch('/api/garage/dashboard').then((r) => r.json()),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const approveReq = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/garage/repair-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['garage-dashboard'] });
      qc.invalidateQueries({ queryKey: ['garage-repair-requests'] });
    },
  });
  const rejectReq = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/garage/repair-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['garage-dashboard'] });
      qc.invalidateQueries({ queryKey: ['garage-repair-requests'] });
    },
  });
  const approveOrder = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/garage/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lifecycle_status: 'approved' }),
      }).then((r) => {
        if (!r.ok) throw new Error('Ошибка утверждения');
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['garage-dashboard'] });
      qc.invalidateQueries({ queryKey: ['garage-orders'] });
    },
  });

  if (isLoading)
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );

  const c = data?.counts ?? {
    repairRequests: 0,
    pendingApproval: 0,
    activeOrders: 0,
    maintenanceAlerts: 0,
    vehiclesInRepair: 0,
  };
  const m = data?.month ?? { completedOrders: 0, revenue: '0.00', salaryAccrued: '0.00' };
  const monthName = new Date().toLocaleDateString('ru-RU', { month: 'long' });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Дашборд Гараж</h1>
          <p className="text-sm text-slate-400 mt-0.5">{todayLabel()} — оперативная сводка</p>
        </div>
        <button
          onClick={onCreateOrder}
          className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-slate-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Новый наряд
        </button>
      </div>

      {/* 5 KPI tiles */}
      <div className="grid grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="text-xs text-slate-400 mb-1">В ремонте сейчас</div>
          <div className="text-3xl font-bold text-slate-900">{c.vehiclesInRepair}</div>
          <div className="text-xs text-slate-500 mt-1">из {c.activeOrders} нарядов</div>
        </div>
        <div
          onClick={() => onNav('workorders')}
          className="bg-white border border-slate-200 rounded-2xl p-4 cursor-pointer hover:border-slate-400"
        >
          <div className="text-xs text-slate-400 mb-1">Активных нарядов</div>
          <div className="text-3xl font-bold text-blue-600">{c.activeOrders}</div>
          <div className="text-xs text-slate-500 mt-1">открыт / в работе</div>
        </div>
        <div
          onClick={() => onNav('workorders')}
          className="bg-white border border-slate-200 rounded-2xl p-4 cursor-pointer hover:border-slate-400"
        >
          <div className="text-xs text-amber-600 mb-1">На утверждении</div>
          <div className="text-3xl font-bold text-amber-600">{c.pendingApproval}</div>
          <div className="text-xs text-slate-500 mt-1">ждут Администратора</div>
        </div>
        <div
          onClick={() => onNav('maintenance')}
          className={cn(
            'bg-white border rounded-2xl p-4 cursor-pointer',
            c.maintenanceAlerts > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200',
          )}
        >
          <div className="text-xs text-red-500 mb-1 font-medium">Алертов ТО</div>
          <div className="text-3xl font-bold text-red-600">{c.maintenanceAlerts}</div>
          <div className="text-xs text-red-400 mt-1">требуют внимания</div>
        </div>
        <div
          onClick={() => onNav('requests')}
          className="bg-white border border-slate-200 rounded-2xl p-4 cursor-pointer hover:border-slate-400"
        >
          <div className="text-xs text-slate-400 mb-1">Заявок от водителей</div>
          <div className="text-3xl font-bold text-violet-600">{c.repairRequests}</div>
          <div className="text-xs text-slate-500 mt-1">ожидают одобрения</div>
        </div>
      </div>

      {/* Статистика за месяц */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <div className="text-xs text-emerald-600 font-semibold mb-1 uppercase tracking-wide">
            Завершено за {monthName}
          </div>
          <div className="text-3xl font-bold text-emerald-700">{m.completedOrders}</div>
          <div className="text-xs text-emerald-500 mt-1">нарядов закрыто</div>
        </div>
        <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4">
          <div className="text-xs text-sky-600 font-semibold mb-1 uppercase tracking-wide">
            Выручка за {monthName}
          </div>
          <div className="text-2xl font-bold text-sky-700">
            <Money amount={m.revenue} />
          </div>
          <div className="text-xs text-sky-500 mt-1">по закрытым нарядам</div>
        </div>
        <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4">
          <div className="text-xs text-violet-600 font-semibold mb-1 uppercase tracking-wide">
            Начислено механикам
          </div>
          <div className="text-2xl font-bold text-violet-700">
            <Money amount={m.salaryAccrued} />
          </div>
          <div className="text-xs text-violet-500 mt-1">ЗП за {monthName}</div>
        </div>
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* Alerts TO */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-red-500 rounded-full alert-pulse" />
            <h3 className="font-semibold text-slate-900 text-sm">Алерты ТО</h3>
          </div>
          {(data?.maintenanceAlerts ?? []).length === 0 ? (
            <p className="text-sm text-slate-400">Нет просроченных или ближайших ТО</p>
          ) : (
            <div className="space-y-2">
              {(data?.maintenanceAlerts ?? []).slice(0, 5).map((a) => (
                <div
                  key={a.id}
                  className={cn(
                    'rounded-xl p-3',
                    a.alert_status === 'overdue'
                      ? 'bg-red-50 border border-red-200'
                      : 'bg-amber-50 border border-amber-200',
                  )}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div
                        className={cn(
                          'font-medium text-sm',
                          a.alert_status === 'overdue' ? 'text-red-700' : 'text-amber-700',
                        )}
                      >
                        {a.asset?.short_name ?? '—'} {a.asset?.reg_number ?? ''}
                      </div>
                      <div
                        className={cn(
                          'text-xs mt-0.5',
                          a.alert_status === 'overdue' ? 'text-red-500' : 'text-amber-600',
                        )}
                      >
                        {a.work_name}
                      </div>
                    </div>
                    <span
                      className={cn(
                        'badge text-xs px-2 py-0.5 rounded-full font-medium',
                        ALERT_COLOR[a.alert_status],
                      )}
                    >
                      {ALERT_LABEL[a.alert_status]}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => onNav('workorders')}
                      className="text-xs font-medium px-3 py-1 rounded-lg bg-red-600 text-white hover:bg-red-700"
                    >
                      Создать наряд
                    </button>
                    <button className="text-xs font-medium px-3 py-1 rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50">
                      Закрыть
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Driver Requests + Pending Approval */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <h3 className="font-semibold text-slate-900 text-sm mb-3">Заявки от водителей</h3>
          {(data?.repairRequests ?? []).length === 0 ? (
            <p className="text-sm text-slate-400 mb-4">Нет новых заявок</p>
          ) : (
            <div className="space-y-2 mb-4">
              {(data?.repairRequests ?? []).slice(0, 3).map((r) => (
                <div key={r.id} className="bg-violet-50 border border-violet-200 rounded-xl p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium text-slate-900 text-sm">
                        {r.asset?.short_name ?? '—'}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        «{r.fault?.name ?? r.custom_description}»
                      </div>
                      <div className="text-xs text-slate-400">
                        Водитель: {r.driver?.name ?? '—'} · {fmtDate(r.created_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => approveReq.mutate(r.id)}
                      disabled={approveReq.isPending}
                      className="text-xs font-medium px-3 py-1 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
                    >
                      Одобрить
                    </button>
                    <button
                      onClick={() => rejectReq.mutate(r.id)}
                      disabled={rejectReq.isPending}
                      className="text-xs font-medium px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                    >
                      Отклонить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-slate-100 pt-3">
            <h3 className="font-semibold text-slate-900 text-sm mb-2">На утверждении</h3>
            {(data?.pendingApproval ?? []).length === 0 ? (
              <p className="text-sm text-slate-400">Нет нарядов на утверждении</p>
            ) : (
              <div className="space-y-2">
                {(data?.pendingApproval ?? []).slice(0, 3).map((o) => {
                  const normH =
                    (o.service_order_works ?? []).reduce(
                      (s: number, w: { norm_minutes?: number | null }) => s + (w.norm_minutes ?? 0),
                      0,
                    ) / 60;
                  const factH =
                    (o.service_order_works ?? []).reduce(
                      (s: number, w: { actual_minutes?: number | null }) =>
                        s + (w.actual_minutes ?? 0),
                      0,
                    ) / 60;
                  return (
                    <div key={o.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <div className="flex justify-between">
                        <div>
                          <div className="font-medium text-slate-900 text-sm">
                            НЗ-{o.order_number}
                          </div>
                          <div className="text-xs text-slate-500">
                            {o.asset?.short_name ?? '—'} · {o.mechanic?.name ?? '—'}
                          </div>
                        </div>
                        <span className="badge bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
                          {factH.toFixed(1)} / {normH.toFixed(1)} нч
                        </span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => approveOrder.mutate(o.id)}
                          disabled={approveOrder.isPending}
                          className="text-xs font-medium px-3 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          Утвердить
                        </button>
                        <button
                          onClick={() => onNav('workorders')}
                          className="text-xs font-medium px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                        >
                          Детали
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Active Orders */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <h3 className="font-semibold text-slate-900 text-sm mb-3">Активные наряды</h3>
          {(data?.activeOrders ?? []).length === 0 ? (
            <p className="text-sm text-slate-400">Нет активных нарядов</p>
          ) : (
            <div className="space-y-2">
              {(data?.activeOrders ?? []).slice(0, 5).map((o) => (
                <div key={o.id} className="border border-blue-200 bg-blue-50 rounded-xl p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-slate-900 text-sm">НЗ-{o.order_number}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {o.asset?.short_name ?? '—'} · {o.mechanic?.name ?? 'Не назначен'}
                      </div>
                    </div>
                    <span className="badge bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                      В работе
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════ REQUESTS (TABLE) ════════════════════════════════

function RequestsSection() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('new');

  const { data: requests = [], isLoading } = useQuery<RepairRequest[]>({
    queryKey: ['garage-repair-requests', statusFilter],
    queryFn: () =>
      fetch(`/api/garage/repair-requests?status=${statusFilter}`)
        .then((r) => r.json())
        .then((d) => (Array.isArray(d) ? d : [])),
    staleTime: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      fetch(`/api/garage/repair-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['garage-repair-requests'] });
      qc.invalidateQueries({ queryKey: ['garage-dashboard'] });
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Заявки от водителей</h1>
        <p className="text-sm text-slate-400 mt-0.5">Одобрение или отклонение заявок на ремонт</p>
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[
          { key: 'new', label: 'Новые' },
          { key: 'approved', label: 'Одобренные' },
          { key: 'rejected', label: 'Отклонённые' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
              statusFilter === f.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="h-48 bg-slate-100 rounded-2xl animate-pulse" />
      ) : requests.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center">
          <p className="text-5xl mb-3">📋</p>
          <p className="font-medium text-slate-500">Заявок нет</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Дата
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Автомобиль
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Водитель
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Описание
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Статус
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 text-slate-500">{fmtDate(r.created_at)}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-900">{r.asset?.short_name ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.driver?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {r.fault?.name ?? r.custom_description}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'badge text-xs px-2 py-0.5 rounded-full',
                        r.status === 'new'
                          ? 'bg-violet-100 text-violet-700'
                          : r.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {r.status === 'new'
                        ? 'Новая'
                        : r.status === 'approved'
                          ? 'Одобрена'
                          : 'Отклонена'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status === 'new' && (
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() =>
                            approveMutation.mutate({ id: r.id, body: { action: 'approve' } })
                          }
                          disabled={approveMutation.isPending}
                          className="text-xs font-medium px-3 py-1 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
                        >
                          Одобрить
                        </button>
                        <button
                          onClick={() =>
                            approveMutation.mutate({ id: r.id, body: { action: 'reject' } })
                          }
                          disabled={approveMutation.isPending}
                          className="text-xs font-medium px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                        >
                          Отклонить
                        </button>
                      </div>
                    )}
                    {r.status === 'approved' && r.service_order && (
                      <span className="text-xs text-slate-500">
                        → Наряд #{r.service_order.order_number}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════ AI IMPORT MODAL ═════════════════════════════════

type AiWork = {
  group?: string;
  custom_work_name: string;
  work_description?: string;
  norm_minutes: number;
  price_client: string;
};
type AiPart = {
  name: string;
  quantity: number;
  unit?: string;
  unit_price: string;
  total_price?: string;
};
type AiParsed = {
  order: {
    machine_type: 'client' | 'own';
    client_vehicle_brand?: string;
    client_vehicle_model?: string;
    client_vehicle_reg?: string;
    client_name?: string;
    client_phone?: string;
    odometer_start?: number | null;
    problem_description: string;
    priority?: string;
  };
  works: AiWork[];
  parts: AiPart[];
  totals: { works: string; parts: string; complications: string; total: string };
  recommendations?: string[];
  warranty_note?: string;
  delivery_note?: string | null;
};

function tryParseJson(raw: string): AiParsed | null {
  try {
    const parsed = JSON.parse(raw.trim());
    if (parsed && typeof parsed === 'object' && 'order' in parsed && 'works' in parsed) {
      if (parsed.order?.machine_type && !['own', 'client'].includes(parsed.order.machine_type)) {
        parsed.order.machine_type = 'own';
      }
      if (parsed.order?.priority && !['low', 'normal', 'urgent'].includes(parsed.order.priority)) {
        parsed.order.priority = 'normal';
      }
      return parsed as AiParsed;
    }
    return null;
  } catch {
    return null;
  }
}

function parseAiResponse(text: string): AiParsed | null {
  // 1. Точный маркер ```json-order
  const m1 = text.match(/```json-order\s*([\s\S]*?)```/);
  if (m1) return tryParseJson(m1[1] ?? '');

  // 2. Любой ```json блок с нужными ключами (LLM часто игнорирует нестандартный маркер)
  const jsonBlocks = [...text.matchAll(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/g)];
  for (const m of jsonBlocks) {
    const result = tryParseJson(m[1] ?? '');
    if (result) return result;
  }

  // 3. Последний JSON-объект {...} в тексте — крайний случай
  const rawBlocks = [...text.matchAll(/(\{[\s\S]*?"order"[\s\S]*?"works"[\s\S]*?\})\s*(?:```|$)/g)];
  for (const m of rawBlocks) {
    const result = tryParseJson(m[1] ?? '');
    if (result) return result;
  }

  return null;
}

function AiImportModal({
  onClose,
  assets,
  onCreated,
}: {
  onClose: () => void;
  assets: Asset[];
  onCreated: (id: string) => void;
}) {
  const aiBackdropDown = useRef(false);
  const [pasted, setPasted] = useState('');
  const [parsed, setParsed] = useState<AiParsed | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedClientVehicle, setSelectedClientVehicle] = useState<ClientVehicle | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function handleRecognize() {
    setParseError(null);
    const result = parseAiResponse(pasted);
    if (!result) {
      setParseError(
        'JSON не найден. Убедитесь, что в тексте есть блок с полями "order", "works", "parts".',
      );
      return;
    }
    setParsed(result);
  }

  async function handleCreate() {
    if (!parsed) return;
    if (parsed.order.machine_type === 'own' && !selectedAssetId) {
      setCreateError('Выберите машину из автопарка');
      return;
    }
    if (parsed.order.machine_type === 'client' && !selectedClientVehicle) {
      setCreateError('Выберите или создайте автомобиль клиента');
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const r = await fetch('/api/garage/orders/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order: {
            ...parsed.order,

            asset_id: parsed.order.machine_type === 'own' ? selectedAssetId : undefined,
            client_vehicle_id:
              parsed.order.machine_type === 'client' ? selectedClientVehicle?.id : undefined,
          },
          works: parsed.works,
          parts: parsed.parts ?? [],
          ai_generated_text: pasted,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Ошибка');
      onCreated(d.id);
      onClose();
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setCreating(false);
    }
  }

  const worksTotal = parsed?.works?.reduce((s, w) => s + parseFloat(w.price_client || '0'), 0) ?? 0;
  const partsTotal =
    parsed?.parts?.reduce((s, p) => s + parseFloat(p.unit_price || '0') * (p.quantity || 1), 0) ??
    0;
  const grandTotal = worksTotal + partsTotal;
  const totalNormH = parsed?.works?.reduce((s, w) => s + (w.norm_minutes || 0), 0) ?? 0;

  const canCreate =
    !creating &&
    !!parsed &&
    (parsed.order.machine_type === 'own' ? !!selectedAssetId : !!selectedClientVehicle);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        aiBackdropDown.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (aiBackdropDown.current && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          'bg-white rounded-2xl shadow-2xl flex flex-col transition-all',
          parsed ? 'w-full max-w-4xl max-h-[92vh]' : 'w-full max-w-xl max-h-[80vh]',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Шапка ── */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
              <svg
                className="w-4 h-4 text-violet-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Создать наряд через ИИ</h2>
              <p className="text-xs text-slate-400">
                {parsed
                  ? `Распознано: ${parsed.works.length} работ · ${grandTotal.toLocaleString('ru-RU')} ₽`
                  : 'Вставьте JSON-ответ от ИИ'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* ── Контент ── */}
        {!parsed ? (
          /* ─── Шаг 1: Ввод JSON ─── */
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-800 mb-1">Как использовать</p>
              <p className="text-xs leading-relaxed">
                Получите ответ ИИ со сметой (через наш промпт или свой), скопируйте его целиком и
                вставьте сюда. Система автоматически найдёт JSON с данными наряда.
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-2">
                Ответ от ИИ
              </label>
              <textarea
                rows={12}
                value={pasted}
                onChange={(e) => {
                  setPasted(e.target.value);
                  setParseError(null);
                }}
                placeholder={
                  'Вставьте сюда ответ от ChatGPT / Claude / другого ИИ...\n\nСистема найдёт JSON с данными наряда автоматически.'
                }
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 leading-relaxed"
              />
            </div>
            {parseError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                <span className="text-red-500 mt-0.5 shrink-0">✕</span>
                <p className="text-sm text-red-700">{parseError}</p>
              </div>
            )}
            <button
              onClick={handleRecognize}
              disabled={!pasted.trim()}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              Распознать наряд
            </button>
          </div>
        ) : (
          /* ─── Шаг 2: Подтверждение ─── */
          <div className="flex-1 overflow-hidden flex flex-col lg:flex-row min-h-0">
            {/* Левая колонка: данные из ИИ */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 border-r border-slate-100">
              {/* Шапка авто */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-900 px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-white font-bold text-sm">
                      {parsed.order.machine_type === 'client'
                        ? [parsed.order.client_vehicle_brand, parsed.order.client_vehicle_model]
                            .filter(Boolean)
                            .join(' ') || 'Клиентский авт.'
                        : 'Автопарк компании'}
                    </p>
                    <p className="text-slate-400 text-xs mt-0.5">
                      {parsed.order.client_vehicle_reg
                        ? `Госномер: ${parsed.order.client_vehicle_reg}`
                        : (parsed.order.client_name ?? '')}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'text-xs font-black px-2 py-1 rounded-full',
                      parsed.order.priority === 'urgent'
                        ? 'bg-red-500 text-white'
                        : parsed.order.priority === 'low'
                          ? 'bg-blue-200 text-blue-800'
                          : 'bg-slate-700 text-slate-200',
                    )}
                  >
                    {PRIORITY_LABEL[parsed.order.priority ?? 'normal']}
                  </span>
                </div>
                <div className="px-4 py-3 bg-slate-50 text-sm text-slate-700 border-t border-slate-200">
                  {parsed.order.problem_description}
                </div>
              </div>

              {/* Метрики */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-200">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Работы</p>
                  <p className="text-base font-black text-slate-900">
                    {worksTotal.toLocaleString('ru-RU')} ₽
                  </p>
                </div>
                {partsTotal > 0 && (
                  <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-200">
                    <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">
                      Запчасти
                    </p>
                    <p className="text-base font-black text-slate-900">
                      {partsTotal.toLocaleString('ru-RU')} ₽
                    </p>
                  </div>
                )}
                <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-200">
                  <p className="text-[10px] text-emerald-600 uppercase font-semibold mb-1">Итого</p>
                  <p className="text-base font-black text-emerald-800">
                    {grandTotal.toLocaleString('ru-RU')} ₽
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-200">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">
                    Нормочасы
                  </p>
                  <p className="text-base font-black text-slate-900">
                    {(totalNormH / 60).toFixed(1)} ч
                  </p>
                </div>
              </div>

              {/* Работы */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-3 py-2 border-b border-slate-200">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Работы · {parsed.works.length}
                  </span>
                </div>
                {parsed.works.map((w, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex items-start gap-3 px-3 py-2.5',
                      i > 0 && 'border-t border-slate-100',
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {w.custom_work_name}
                      </p>
                      {w.work_description && (
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                          {w.work_description}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {parseFloat(w.price_client).toLocaleString('ru-RU')} ₽
                      </p>
                      <p className="text-xs text-slate-400">
                        {(w.norm_minutes / 60).toFixed(1)} нч
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Запчасти */}
              {parsed.parts && parsed.parts.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-3 py-2 border-b border-slate-200">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Запчасти · {parsed.parts.length}
                    </span>
                  </div>
                  {parsed.parts.map((p, i) => (
                    <div
                      key={i}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5',
                        i > 0 && 'border-t border-slate-100',
                      )}
                    >
                      <p className="flex-1 text-sm text-slate-800">{p.name}</p>
                      <p className="text-xs text-slate-400 shrink-0">
                        {p.quantity} {p.unit || 'шт'}
                      </p>
                      <p className="text-sm font-semibold text-slate-900 shrink-0">
                        {(parseFloat(p.unit_price) * p.quantity).toLocaleString('ru-RU')} ₽
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Правая колонка: выбор машины и механика */}
            <div className="w-full lg:w-80 flex-shrink-0 flex flex-col border-t lg:border-t-0 border-slate-100">
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Привязка
                </p>

                {/* Машина */}
                {parsed.order.machine_type === 'own' ? (
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                      Машина из автопарка *
                    </label>
                    <select
                      value={selectedAssetId}
                      onChange={(e) => setSelectedAssetId(e.target.value)}
                      className={cn(
                        'w-full border rounded-xl px-3 py-2.5 text-sm bg-white',
                        !selectedAssetId ? 'border-red-300 bg-red-50' : 'border-slate-200',
                      )}
                    >
                      <option value="">— Выберите машину —</option>
                      {assets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.short_name} · {a.reg_number}
                        </option>
                      ))}
                    </select>
                    {!selectedAssetId && <p className="text-xs text-red-500 mt-1">Обязательно</p>}
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                      Автомобиль клиента *
                    </label>
                    <ClientVehicleSelector
                      value={selectedClientVehicle}
                      onChange={setSelectedClientVehicle}
                    />
                    {!selectedClientVehicle && (
                      <p className="text-xs text-red-500 mt-1">Обязательно</p>
                    )}
                  </div>
                )}

                {createError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                    <span className="text-red-500 shrink-0 mt-0.5">✕</span>
                    <p className="text-sm text-red-700">{createError}</p>
                  </div>
                )}
              </div>

              {/* Кнопки */}
              <div className="flex-shrink-0 border-t border-slate-100 px-5 py-4 space-y-2">
                <button
                  onClick={handleCreate}
                  disabled={!canCreate}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-40 transition-colors"
                >
                  {creating ? 'Создаём...' : 'Создать наряд →'}
                </button>
                <button
                  onClick={() => {
                    setParsed(null);
                    setParseError(null);
                    setCreateError(null);
                  }}
                  className="w-full border border-slate-200 text-slate-500 hover:bg-slate-50 font-semibold py-2 rounded-xl text-sm transition-colors"
                >
                  ← Вставить другой ответ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════ WORK ORDERS ═════════════════════════════════════

function WorkOrdersSection() {
  const [showCreate, setShowCreate] = useState(false);
  const [showAiImport, setShowAiImport] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'pending_payment' | 'archive' | 'requests'>(
    'active',
  );
  // Unified date filter — applies to all tabs
  const [dateMode, setDateMode] = useState<'all' | 'month' | 'day'>('all');
  const [filterDate, setFilterDate] = useState(todayStr());
  const [filterMonth, setFilterMonth] = useState(todayStr().slice(0, 7));
  // Text / type / status / mechanic filters (all client-side — instant)
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'own' | 'client'>('all');
  const [filterMechanic, setFilterMechanic] = useState('');
  const [filterStatus, setFilterStatus] = useState<
    'all' | 'created' | 'in_progress' | 'completed' | 'review'
  >('all');
  const [groupByVehicle, setGroupByVehicle] = useState(false);
  const qc = useQueryClient();

  // One "all" query covers active + review. Archive by date is separate.
  const { data: allOrders = [], isLoading: allLoading } = useQuery<TabOrder[]>({
    queryKey: ['garage-orders', 'all'],
    queryFn: () =>
      fetch('/api/garage/orders?filter=all')
        .then((r) => r.json())
        .then((d) => (Array.isArray(d) ? d : [])),
    staleTime: 60000,
    refetchInterval: 60000,
  });
  const archiveUrl =
    dateMode === 'day'
      ? `/api/garage/orders?filter=history&date=${filterDate}`
      : dateMode === 'month'
        ? `/api/garage/orders?filter=history&month=${filterMonth}`
        : `/api/garage/orders?filter=history`;
  const { data: historyOrders = [], isLoading: histLoading } = useQuery<TabOrder[]>({
    queryKey: [
      'garage-orders',
      'history',
      dateMode,
      dateMode === 'day' ? filterDate : dateMode === 'month' ? filterMonth : 'all',
    ],
    queryFn: () =>
      fetch(archiveUrl)
        .then((r) => r.json())
        .then((d) => (Array.isArray(d) ? d : [])),
    staleTime: 120000,
    enabled: activeTab === 'archive',
  });

  const { data: pendingPaymentOrders = [], isLoading: pendingLoading } = useQuery<TabOrder[]>({
    queryKey: ['garage-orders', 'pending_payment'],
    queryFn: () =>
      fetch('/api/garage/orders?filter=pending_payment')
        .then((r) => r.json())
        .then((d) => (Array.isArray(d) ? d : [])),
    staleTime: 30000,
    refetchInterval: 60000,
    enabled: activeTab === 'pending_payment',
  });

  // ── Repair requests (заявки водителей) ──
  const { data: repairRequests = [] } = useQuery<RepairRequest[]>({
    queryKey: ['garage-repair-requests', 'new'],
    queryFn: () =>
      fetch('/api/garage/repair-requests?status=pending_json')
        .then((r) => r.json())
        .then((d) => (Array.isArray(d) ? d : [])),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  // Attach JSON state
  const [attachId, setAttachId] = useState<string | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');

  // Approve modal state
  const [approveReqId, setApproveReqId] = useState<string | null>(null);
  const [approveMechanicId, setApproveMechanicId] = useState('');
  const [approveOdometer, setApproveOdometer] = useState('');
  const [approving, setApproving] = useState(false);

  const attachJsonMutation = useMutation({
    mutationFn: ({ id, service_json }: { id: string; service_json: unknown }) =>
      fetch(`/api/garage/repair-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'attach_json', service_json }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['garage-repair-requests'] });
      setAttachId(null);
      setJsonText('');
      setJsonError('');
    },
  });

  const approveReqMutation = useMutation({
    mutationFn: ({
      id,
      mechanic_id,
      odometer,
    }: {
      id: string;
      mechanic_id: string;
      odometer?: number;
    }) =>
      fetch(`/api/garage/repair-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', mechanic_id, odometer }),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? 'Ошибка');
        return json;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['garage-repair-requests'] });
      qc.invalidateQueries({ queryKey: ['garage-orders'] });
      qc.invalidateQueries({ queryKey: ['garage-dashboard'] });
      setApproveReqId(null);
      setApproveMechanicId('');
      setApproveOdometer('');
    },
  });

  const rejectReqMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/garage/repair-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['garage-repair-requests'] }),
  });

  const handleAttachJson = (id: string) => {
    setJsonError('');
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setJsonError('Невалидный JSON');
      return;
    }
    attachJsonMutation.mutate({ id, service_json: parsed });
  };

  const handleApproveRequest = async (id: string) => {
    if (!approveMechanicId) return;
    setApproving(true);
    try {
      await approveReqMutation.mutateAsync({
        id,
        mechanic_id: approveMechanicId,
        odometer: approveOdometer ? parseInt(approveOdometer) : undefined,
      });
    } finally {
      setApproving(false);
    }
  };

  const { data: mechanics = [] } = useQuery<Mechanic[]>({
    queryKey: ['mechanics-list'],
    queryFn: () => fetch('/api/users?role=mechanic').then((r) => r.json()),
    staleTime: 300000,
  });
  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ['assets-select'],
    queryFn: () => fetch('/api/garage/assets').then((r) => r.json()),
    staleTime: 300000,
  });

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      fetch(`/api/garage/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => {
        if (!r.ok) throw new Error('Ошибка');
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['garage-orders'] });
      qc.invalidateQueries({ queryKey: ['garage-dashboard'] });
    },
  });

  // Draft orders (in work)
  const activePool = useMemo(
    () => allOrders.filter((o) => o.lifecycle_status === 'draft'),
    [allOrders],
  );

  // Client orders approved but not yet paid — dedicated query, no limit issues
  const pendingPaymentPool = pendingPaymentOrders;

  // Counters for tab badges
  const inWorkCount = activePool.filter((o) => o.status === 'in_progress').length;
  const reviewCount = activePool.filter(
    (o) => o.lifecycle_status === 'draft' && o.status === 'completed',
  ).length;
  const pendingPaymentCount = pendingPaymentOrders.length;

  // Client-side filtered list (instant)
  const filteredOrders = useMemo(() => {
    const pool =
      activeTab === 'archive'
        ? historyOrders
        : activeTab === 'pending_payment'
          ? pendingPaymentPool
          : activePool;
    let result = pool;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (o) =>
          String(o.order_number).includes(q) ||
          o.asset?.short_name?.toLowerCase().includes(q) ||
          o.asset?.reg_number?.toLowerCase().includes(q) ||
          o.client_vehicle_brand?.toLowerCase().includes(q) ||
          (o as TabOrder & { client_vehicle_model?: string }).client_vehicle_model
            ?.toLowerCase()
            .includes(q) ||
          o.client_vehicle_reg?.toLowerCase().includes(q) ||
          (o.client_name as string | null)?.toLowerCase().includes(q) ||
          o.mechanic?.name?.toLowerCase().includes(q) ||
          o.problem_description?.toLowerCase().includes(q) ||
          (o.works ?? []).some((w) =>
            (w.work_catalog?.name ?? w.custom_work_name ?? '').toLowerCase().includes(q),
          ),
      );
    }
    if (filterType !== 'all') result = result.filter((o) => o.machine_type === filterType);
    if (filterMechanic) result = result.filter((o) => o.mechanic?.id === filterMechanic);
    if (filterStatus !== 'all') {
      if (filterStatus === 'review') {
        result = result.filter((o) => o.lifecycle_status === 'draft' && o.status === 'completed');
      } else {
        result = result.filter((o) => o.status === filterStatus);
      }
    }
    // Date filter for non-archive tabs (archive uses server-side filtering)
    if (activeTab !== 'archive' && dateMode !== 'all') {
      const prefix = dateMode === 'day' ? filterDate : filterMonth;
      result = result.filter((o) => o.created_at?.startsWith(prefix));
    }
    return result;
  }, [
    activePool,
    pendingPaymentOrders,
    historyOrders,
    activeTab,
    search,
    filterType,
    filterMechanic,
    filterStatus,
    dateMode,
    filterDate,
    filterMonth,
  ]);

  const totalCost = useMemo(
    () =>
      filteredOrders.reduce(
        (s, o) => s + (o.works ?? []).reduce((ws, w) => ws + moneyVal(w.price_client), 0),
        0,
      ),
    [filteredOrders],
  );

  const hasFilters = !!(
    search ||
    filterType !== 'all' ||
    filterMechanic ||
    filterStatus !== 'all' ||
    dateMode !== 'all'
  );

  function clearFilters() {
    setSearch('');
    setFilterType('all');
    setFilterMechanic('');
    setFilterStatus('all');
    setDateMode('all');
  }

  // ── Order card ──────────────────────────────────────────────────────────────
  function OrderCard({ o }: { o: TabOrder }) {
    const works = o.works ?? [];
    const cost = works.reduce((s, w) => s + moneyVal(w.price_client), 0);
    const normH = works.reduce((s, w) => s + (w.norm_minutes ?? 0), 0) / 60;
    const factH = works.reduce((s, w) => s + (w.actual_minutes ?? 0), 0) / 60;
    const isReview = o.lifecycle_status === 'draft' && o.status === 'completed';
    const isPendingPayment =
      o.lifecycle_status === 'approved' && o.machine_type === 'client' && !o.payment_received;
    const isClosed = o.lifecycle_status === 'approved' && !isPendingPayment;

    const vehicleLabel =
      o.machine_type === 'own'
        ? [o.asset?.short_name, o.asset?.reg_number].filter(Boolean).join(' · ')
        : [
            o.client_vehicle_brand,
            (o as TabOrder & { client_vehicle_model?: string }).client_vehicle_model,
            o.client_vehicle_reg,
          ]
            .filter(Boolean)
            .join(' ');
    const clientLabel = o.machine_type === 'client' ? (o.client_name as string | null) : null;

    const statusBadge = isClosed
      ? { label: 'Закрыт', cls: 'bg-emerald-100 text-emerald-700' }
      : isPendingPayment
        ? { label: 'Ждёт оплаты', cls: 'bg-orange-100 text-orange-700' }
        : isReview
          ? { label: 'На проверке', cls: 'bg-amber-100 text-amber-700' }
          : o.status === 'in_progress'
            ? { label: 'В работе', cls: 'bg-blue-100 text-blue-700' }
            : o.status === 'completed'
              ? { label: 'Завершён', cls: 'bg-slate-100 text-slate-600' }
              : { label: 'В очереди', cls: 'bg-slate-100 text-slate-500' };

    return (
      <div
        onClick={() => setSelectedOrderId(o.id)}
        className={cn(
          'bg-white border rounded-xl px-4 py-3.5 cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all flex gap-4 items-start',
          isReview ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200',
        )}
      >
        {/* Left: number + date + type */}
        <div className="shrink-0 w-20 flex flex-col gap-1.5">
          <span className="font-mono text-xs font-black text-slate-700">НЗ-{o.order_number}</span>
          <span
            className={cn(
              'text-[10px] font-semibold px-1.5 py-0.5 rounded w-fit',
              o.machine_type === 'own'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-amber-100 text-amber-700',
            )}
          >
            {o.machine_type === 'own' ? 'Свой' : 'Клиент'}
          </span>
          <span className="text-[10px] text-slate-400">
            {new Date(o.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
          </span>
        </div>

        {/* Center: vehicle + works */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-slate-900 truncate">
              {vehicleLabel || '—'}
            </span>
            {clientLabel && <span className="text-xs text-slate-500 truncate">{clientLabel}</span>}
          </div>
          {works.length === 0 ? (
            <span className="text-xs text-amber-600 italic">⚠ Работы не указаны</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {works.slice(0, 4).map((w) => (
                <span
                  key={w.id}
                  className={cn(
                    'text-[11px] px-2 py-0.5 rounded-full font-medium',
                    w.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-700'
                      : w.status === 'in_progress' || w.status === 'paused'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {w.work_catalog?.name ?? w.custom_work_name ?? '—'}
                </span>
              ))}
              {works.length > 4 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">
                  +{works.length - 4}
                </span>
              )}
            </div>
          )}
          {o.problem_description && (
            <p className="text-[11px] text-slate-400 truncate">{o.problem_description}</p>
          )}
        </div>

        {/* Right: mechanic + hours + status + cost */}
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          <span
            className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', statusBadge.cls)}
          >
            {statusBadge.label}
          </span>
          {cost > 0 && (
            <span className="text-sm font-bold text-slate-800">
              {cost.toLocaleString('ru-RU')} ₽
            </span>
          )}
          {o.mechanic?.name && (
            <span className="text-[11px] text-slate-500">{o.mechanic.name}</span>
          )}
          {normH > 0 && (
            <span className="text-[10px] font-mono text-slate-400">
              {normH.toFixed(1)}нч{factH > 0 ? ` / ${factH.toFixed(1)}` : ''}
            </span>
          )}
          {isPendingPayment && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!confirm(`Подтвердить оплату наряда НЗ-${o.order_number}?`)) return;
                patch.mutate({ id: o.id, body: { payment_received: true } });
              }}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 mt-1 shadow-sm"
            >
              Оплачено ✓
            </button>
          )}
          {isClosed && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                patch.mutate({ id: o.id, body: { lifecycle_status: 'draft' } });
              }}
              className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 mt-0.5"
            >
              Открыть заново
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Grouped by vehicle ──────────────────────────────────────────────────────
  const vehicleGroups = useMemo(() => {
    if (!groupByVehicle) return null;
    const map = new Map<string, { label: string; sublabel: string; orders: TabOrder[] }>();
    for (const o of filteredOrders) {
      const key = o.asset?.id ?? `cl:${o.client_vehicle_reg ?? o.id}`;
      if (!map.has(key)) {
        const label =
          o.machine_type === 'own'
            ? (o.asset?.short_name ?? 'Свой ТС')
            : [
                o.client_vehicle_brand,
                (o as TabOrder & { client_vehicle_model?: string }).client_vehicle_model,
              ]
                .filter(Boolean)
                .join(' ') || 'Клиентский ТС';
        const sublabel =
          o.machine_type === 'own'
            ? (o.asset?.reg_number ?? '')
            : (o.client_vehicle_reg ?? (o.client_name as string | null) ?? '');
        map.set(key, { label, sublabel, orders: [] });
      }
      map.get(key)!.orders.push(o);
    }
    return Array.from(map.values());
  }, [filteredOrders, groupByVehicle]);

  const isLoading =
    activeTab === 'archive'
      ? histLoading
      : activeTab === 'pending_payment'
        ? pendingLoading
        : allLoading;

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Заказ-наряды</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {isLoading
              ? 'Загрузка...'
              : `${filteredOrders.length} нарядов${totalCost > 0 ? ` · ${totalCost.toLocaleString('ru-RU')} ₽` : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAiImport(true)}
            className="bg-violet-600 text-white text-sm font-semibold px-3 py-2 rounded-xl hover:bg-violet-700 flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            ИИ
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-slate-900 text-white text-sm font-semibold px-3 py-2 rounded-xl hover:bg-slate-700 flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Новый наряд
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('active')}
          className={cn(
            'px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5',
            activeTab === 'active'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          В работе
          {inWorkCount > 0 && (
            <span className="bg-blue-500 text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {inWorkCount}
            </span>
          )}
          {reviewCount > 0 && (
            <span className="bg-amber-500 text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {reviewCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('pending_payment')}
          className={cn(
            'px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5',
            activeTab === 'pending_payment'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          Ждёт оплаты
          {pendingPaymentCount > 0 && (
            <span className="bg-orange-500 text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {pendingPaymentCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('archive')}
          className={cn(
            'px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors',
            activeTab === 'archive'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          Архив
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={cn(
            'px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5',
            activeTab === 'requests'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          Заявки
          {repairRequests.filter((r) => r.status === 'new').length > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {repairRequests.filter((r) => r.status === 'new').length}
            </span>
          )}
        </button>
      </div>

      {/* ── Global filter bar ── */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Поиск */}
        <div className="relative flex-1 min-w-52">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="НЗ-42, авто, клиент, механик, работа..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Тип */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl text-sm shrink-0">
          {(
            [
              ['all', 'Все'],
              ['own', 'Свои'],
              ['client', 'Клиент'],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilterType(v)}
              className={cn(
                'px-3 py-1 rounded-lg font-medium transition-colors',
                filterType === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
              )}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Статус */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 shrink-0"
        >
          <option value="all">Все статусы</option>
          <option value="created">В очереди</option>
          <option value="in_progress">В работе</option>
          <option value="review">На проверке</option>
          <option value="completed">Завершён</option>
        </select>

        {/* Механик */}
        <select
          value={filterMechanic}
          onChange={(e) => setFilterMechanic(e.target.value)}
          className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 shrink-0"
        >
          <option value="">Все механики</option>
          {mechanics.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        {/* Диапазон дат */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl text-sm shrink-0">
          {(
            [
              ['all', 'Все даты'],
              ['month', 'Месяц'],
              ['day', 'День'],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setDateMode(v)}
              className={cn(
                'px-3 py-1 rounded-lg font-medium transition-colors',
                dateMode === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
              )}
            >
              {l}
            </button>
          ))}
        </div>
        {dateMode === 'day' && <DateNav date={filterDate} onChange={setFilterDate} />}
        {dateMode === 'month' && <MonthNav month={filterMonth} onChange={setFilterMonth} />}

        {/* Группировка по машинам */}
        {activeTab !== 'archive' && (
          <button
            onClick={() => setGroupByVehicle((v) => !v)}
            className={cn(
              'text-sm font-semibold px-3 py-1.5 rounded-xl border transition-colors shrink-0',
              groupByVehicle
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 text-slate-500 hover:border-slate-400',
            )}
          >
            По машинам
          </button>
        )}

        {/* Сброс */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-slate-500 hover:text-slate-800 font-medium px-2 py-2 rounded-xl hover:bg-slate-100 transition-colors shrink-0"
          >
            × Сбросить
          </button>
        )}
      </div>

      {/* ── Заявки водителей ── */}
      {activeTab === 'requests' && (
        <div className="space-y-3">
          {repairRequests.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center">
              <p className="text-5xl mb-3">📋</p>
              <p className="font-semibold text-slate-500">Новых заявок нет</p>
            </div>
          )}
          {repairRequests.map((req) => {
            const sj = req.service_json;
            const isAttaching = attachId === req.id;
            const isApproving = approveReqId === req.id;
            return (
              <div
                key={req.id}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
              >
                {/* Заголовок */}
                <div className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm">
                        {req.asset?.short_name ?? '—'}
                      </span>
                      <span className="text-xs text-slate-400">{req.asset?.reg_number}</span>
                      <span className="text-xs text-slate-500">· {req.driver?.name ?? '—'}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(req.created_at).toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 mt-1">
                      {req.fault?.name ?? req.custom_description ?? '—'}
                    </p>
                  </div>
                  {/* Статус JSON */}
                  {sj ? (
                    <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                      JSON ✓
                    </span>
                  ) : (
                    <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                      Без JSON
                    </span>
                  )}
                </div>

                {/* Превью JSON если прикреплён */}
                {sj && !isApproving && (
                  <div className="px-4 pb-3 space-y-1">
                    {sj.problem_description && (
                      <p className="text-xs text-slate-600 italic">
                        &quot;{sj.problem_description}&quot;
                      </p>
                    )}
                    {sj.works && sj.works.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {sj.works.map((w, i) => (
                          <span
                            key={i}
                            className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full"
                          >
                            {w.name}
                            {w.norm_minutes ? ` (${w.norm_minutes} мин)` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                    {sj.priority && sj.priority !== 'normal' && (
                      <span
                        className={cn(
                          'inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1',
                          sj.priority === 'urgent'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-100 text-slate-500',
                        )}
                      >
                        {sj.priority === 'urgent' ? 'Срочно' : sj.priority}
                      </span>
                    )}
                  </div>
                )}

                {/* Блок прикрепления JSON */}
                {isAttaching && (
                  <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-2">
                    <p className="text-xs font-semibold text-slate-600">Вставьте JSON от ИИ:</p>
                    <textarea
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-slate-400 resize-none"
                      rows={6}
                      placeholder={
                        '{\n  "order": {\n    "problem_description": "...",\n    "priority": "normal"\n  },\n  "works": [\n    { "custom_work_name": "Замена колодок", "norm_minutes": 90, "price_client": "0" }\n  ],\n  "parts": []\n}'
                      }
                      value={jsonText}
                      onChange={(e) => setJsonText(e.target.value)}
                    />
                    {jsonError && <p className="text-xs text-rose-600 font-medium">{jsonError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAttachJson(req.id)}
                        disabled={!jsonText.trim() || attachJsonMutation.isPending}
                        className="bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-slate-700 disabled:opacity-50 transition-colors"
                      >
                        {attachJsonMutation.isPending ? 'Сохранение...' : 'Прикрепить'}
                      </button>
                      <button
                        onClick={() => {
                          setAttachId(null);
                          setJsonText('');
                          setJsonError('');
                        }}
                        className="text-xs text-slate-500 hover:text-slate-700 px-4 py-2 rounded-xl border border-slate-200"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                )}

                {/* Форма одобрения */}
                {isApproving && (
                  <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
                    <p className="text-xs font-semibold text-slate-700">Создать наряд</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                          Механик *
                        </label>
                        <select
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                          value={approveMechanicId}
                          onChange={(e) => setApproveMechanicId(e.target.value)}
                        >
                          <option value="">— выбрать —</option>
                          {mechanics.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                          Одометр (км)
                        </label>
                        <input
                          type="number"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                          placeholder="0"
                          value={approveOdometer}
                          onChange={(e) => setApproveOdometer(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveRequest(req.id)}
                        disabled={!approveMechanicId || approving}
                        className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                      >
                        {approving ? 'Создание...' : 'Создать наряд'}
                      </button>
                      <button
                        onClick={() => {
                          setApproveReqId(null);
                          setApproveMechanicId('');
                          setApproveOdometer('');
                        }}
                        className="text-xs text-slate-500 hover:text-slate-700 px-4 py-2 rounded-xl border border-slate-200"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                )}

                {/* Кнопки действий */}
                {!isAttaching && !isApproving && (
                  <div className="px-4 pb-3 border-t border-slate-100 pt-2.5 flex flex-col gap-2">
                    {req.status === 'approved' ? (
                      /* Заявка одобрена — наряд уже существует */
                      <div className="flex items-center gap-2 flex-wrap">
                        {req.service_order && (
                          <button
                            onClick={() => setSelectedOrderId(req.service_order!.id)}
                            className="text-sm font-bold bg-slate-900 text-white hover:bg-slate-700 px-4 py-2 rounded-xl transition-colors"
                          >
                            Открыть наряд #{req.service_order.order_number}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setAttachId(req.id);
                            setJsonText(sj ? JSON.stringify(sj, null, 2) : '');
                            setJsonError('');
                          }}
                          className="text-xs font-semibold text-violet-600 hover:text-violet-800 border border-violet-200 hover:border-violet-400 px-3 py-2 rounded-xl transition-colors"
                        >
                          {sj ? '✏️ Изменить JSON' : '+ Прикрепить JSON к наряду'}
                        </button>
                      </div>
                    ) : sj ? (
                      /* Новая заявка с JSON — одобрить */
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setApproveReqId(req.id);
                            setApproveMechanicId('');
                            setApproveOdometer('');
                          }}
                          className="text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 rounded-xl transition-colors"
                        >
                          ✓ Одобрить → Наряд
                        </button>
                        <button
                          onClick={() => {
                            setAttachId(req.id);
                            setJsonText(JSON.stringify(sj, null, 2));
                            setJsonError('');
                          }}
                          className="text-xs text-slate-400 hover:text-slate-600 underline"
                        >
                          изменить JSON
                        </button>
                      </div>
                    ) : (
                      /* Новая заявка без JSON */
                      <div className="space-y-2">
                        <button
                          onClick={() => {
                            setAttachId(req.id);
                            setJsonText('');
                            setJsonError('');
                          }}
                          className="w-full text-sm font-bold bg-violet-600 text-white hover:bg-violet-700 px-4 py-2 rounded-xl transition-colors"
                        >
                          Шаг 1: Прикрепить JSON от ИИ
                        </button>
                        <p className="text-[10px] text-slate-400 text-center">
                          Возьми описание водителя, дай ИИ — вставь сюда JSON
                        </p>
                        <button
                          onClick={() => {
                            setApproveReqId(req.id);
                            setApproveMechanicId('');
                            setApproveOdometer('');
                          }}
                          className="w-full text-xs text-slate-400 hover:text-slate-600 py-1 underline"
                        >
                          Одобрить без JSON (наряд без описания работ)
                        </button>
                      </div>
                    )}
                    {/* Удалить заявку */}
                    <button
                      onClick={() => {
                        if (confirm('Удалить заявку?')) rejectReqMutation.mutate(req.id);
                      }}
                      className="text-[10px] text-slate-300 hover:text-rose-500 self-start transition-colors"
                    >
                      удалить заявку
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── List (скрыт на вкладке Заявки) ── */}
      {activeTab !== 'requests' &&
        (isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center">
            <p className="text-5xl mb-3">🔧</p>
            <p className="font-semibold text-slate-500">
              {hasFilters ? 'Нарядов по фильтру не найдено' : 'Нарядов нет'}
            </p>
            {hasFilters && (
              <button onClick={clearFilters} className="mt-3 text-sm text-slate-400 underline">
                Сбросить фильтры
              </button>
            )}
          </div>
        ) : groupByVehicle && vehicleGroups ? (
          /* ── По машинам ── */
          <div className="space-y-3">
            {vehicleGroups.map((g) => (
              <div
                key={g.label + g.sublabel}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
              >
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center shrink-0">
                    <svg
                      className="w-3.5 h-3.5 text-slate-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1"
                      />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 text-sm">{g.label}</p>
                    {g.sublabel && <p className="text-xs text-slate-400">{g.sublabel}</p>}
                  </div>
                  <span className="text-xs font-semibold text-slate-400 shrink-0">
                    {g.orders.length} нар.
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {g.orders.map((o) => (
                    <OrderCard key={o.id} o={o} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ── Плоский список карточек ── */
          <div className="space-y-2">
            {filteredOrders.map((o) => (
              <OrderCard key={o.id} o={o} />
            ))}
          </div>
        ))}

      {showCreate && <CreateOrderModal onClose={() => setShowCreate(false)} assets={assets} />}
      {showAiImport && (
        <AiImportModal
          onClose={() => setShowAiImport(false)}
          assets={assets}
          onCreated={(id) => {
            qc.invalidateQueries({ queryKey: ['garage-orders'] });
            setShowAiImport(false);
            setSelectedOrderId(id);
          }}
        />
      )}
      {selectedOrderId && (
        <OrderDetailModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          mechanics={mechanics}
        />
      )}
    </div>
  );
}

// ═══════════════════════════ MAINTENANCE ═════════════════════════════════════

function MaintenanceSection() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MaintenanceItem>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    asset_id: '',
    work_name: '',
    interval_km: '',
    interval_months: '',
    last_done_km: '',
  });

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ['assets-select'],
    queryFn: () => fetch('/api/garage/assets').then((r) => r.json()),
    staleTime: 300000,
  });
  const { data: items = [], isLoading } = useQuery<MaintenanceItem[]>({
    queryKey: ['garage-maintenance'],
    queryFn: () =>
      fetch('/api/garage/maintenance')
        .then((r) => r.json())
        .then((d) => (Array.isArray(d) ? d : [])),
  });
  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch('/api/garage/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['garage-maintenance'] });
      qc.invalidateQueries({ queryKey: ['garage-dashboard'] });
      setShowCreate(false);
      setCreateForm({
        asset_id: '',
        work_name: '',
        interval_km: '',
        interval_months: '',
        last_done_km: '',
      });
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      fetch(`/api/garage/maintenance/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['garage-maintenance'] });
      setEditingId(null);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/garage/maintenance/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['garage-maintenance'] }),
  });

  const startEdit = (item: MaintenanceItem) => {
    setEditingId(item.id);
    setEditForm(item);
  };
  const remainingKm = (item: MaintenanceItem) => {
    const current = item.asset?.odometer_current ?? 0;
    const due = item.next_due_km ?? 0;
    if (!due || !current) return null;
    return due - current;
  };

  // Vehicle summary cards
  const vehicleMap = new Map<
    string,
    { asset: MaintenanceItem['asset']; overdue: number; soon: number }
  >();
  items.forEach((item) => {
    if (!item.asset) return;
    const key = item.asset.id;
    if (!vehicleMap.has(key)) vehicleMap.set(key, { asset: item.asset, overdue: 0, soon: 0 });
    const v = vehicleMap.get(key)!;
    if (item.alert_status === 'overdue') v.overdue++;
    else if (item.alert_status === 'soon') v.soon++;
  });
  const vehicles = Array.from(vehicleMap.values());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Регламенты ТО</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Плановое техническое обслуживание и контроль сроков
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-slate-700 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Добавить регламент
        </button>
      </div>

      {vehicles.length > 0 && (
        <div className={cn('grid gap-3', vehicles.length <= 4 ? 'grid-cols-4' : 'grid-cols-3')}>
          {vehicles.map(
            ({ asset, overdue, soon }) =>
              asset && (
                <div key={asset.id} className="bg-white border border-slate-200 rounded-2xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">{asset.short_name}</div>
                      <div className="text-xs text-slate-400">
                        {asset.odometer_current?.toLocaleString('ru-RU') ?? '—'} км
                      </div>
                    </div>
                    {overdue > 0 ? (
                      <div
                        className="w-2.5 h-2.5 bg-red-500 rounded-full mt-1"
                        style={{ animation: 'pulse 2s infinite' }}
                      />
                    ) : soon > 0 ? (
                      <div className="w-2.5 h-2.5 bg-amber-400 rounded-full mt-1" />
                    ) : (
                      <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full mt-1" />
                    )}
                  </div>
                  {overdue > 0 ? (
                    <div className="text-xs text-red-500 font-medium">{overdue} просрочено</div>
                  ) : (
                    <div className="text-xs text-slate-400">0 просрочено</div>
                  )}
                  {soon > 0 ? (
                    <div className="text-xs text-amber-600">{soon} скоро</div>
                  ) : (
                    <div className="text-xs text-slate-400">0 скоро</div>
                  )}
                </div>
              ),
          )}
        </div>
      )}

      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-bold text-slate-900 mb-4">Новый регламент ТО</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">
                  Автомобиль *
                </label>
                <select
                  value={createForm.asset_id}
                  onChange={(e) => setCreateForm({ ...createForm, asset_id: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">— Выберите —</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.short_name} · {a.reg_number}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">
                  Вид работы *
                </label>
                <input
                  value={createForm.work_name}
                  onChange={(e) => setCreateForm({ ...createForm, work_name: e.target.value })}
                  placeholder="Замена масла двигателя"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">
                    Интервал (км)
                  </label>
                  <input
                    type="number"
                    value={createForm.interval_km}
                    onChange={(e) => setCreateForm({ ...createForm, interval_km: e.target.value })}
                    placeholder="10000"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">
                    Интервал (мес.)
                  </label>
                  <input
                    type="number"
                    value={createForm.interval_months}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, interval_months: e.target.value })
                    }
                    placeholder="6"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">
                  Последнее выполнено (км)
                </label>
                <input
                  type="number"
                  value={createForm.last_done_km}
                  onChange={(e) => setCreateForm({ ...createForm, last_done_km: e.target.value })}
                  placeholder="80000"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm font-semibold"
                >
                  Отмена
                </button>
                <button
                  onClick={() =>
                    createMutation.mutate({
                      asset_id: createForm.asset_id,
                      work_name: createForm.work_name,
                      interval_km: createForm.interval_km
                        ? Number(createForm.interval_km)
                        : undefined,
                      interval_months: createForm.interval_months
                        ? Number(createForm.interval_months)
                        : undefined,
                      last_done_km: createForm.last_done_km
                        ? Number(createForm.last_done_km)
                        : undefined,
                    })
                  }
                  disabled={
                    createMutation.isPending || !createForm.asset_id || !createForm.work_name.trim()
                  }
                  className="flex-[2] bg-slate-900 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
                >
                  Создать
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {isLoading ? (
        <div className="h-48 bg-slate-100 rounded-2xl animate-pulse" />
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center">
          <p className="text-5xl mb-3">🔧</p>
          <p className="font-medium text-slate-500">Регламентов ТО нет</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Автомобиль
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Работа
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Интервал
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Последнее (км)
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  След. (км)
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Остаток
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Статус
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => {
                const rem = remainingKm(item);
                const isEditing = editingId === item.id;
                return (
                  <tr
                    key={item.id}
                    className={cn(
                      item.alert_status === 'overdue'
                        ? 'bg-red-50'
                        : item.alert_status === 'soon'
                          ? 'bg-amber-50'
                          : '',
                    )}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {item.asset?.short_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {isEditing ? (
                        <input
                          value={editForm.work_name ?? ''}
                          onChange={(e) => setEditForm({ ...editForm, work_name: e.target.value })}
                          className="border border-slate-200 rounded px-2 py-1 text-sm w-full"
                        />
                      ) : (
                        item.work_name
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">
                      {item.interval_km ? `${item.interval_km.toLocaleString('ru-RU')} км` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.last_done_km ?? ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, last_done_km: Number(e.target.value) })
                          }
                          className="border border-slate-200 rounded px-2 py-1 text-sm w-20 text-right"
                        />
                      ) : (
                        (item.last_done_km?.toLocaleString('ru-RU') ?? '—')
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.next_due_km ?? ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, next_due_km: Number(e.target.value) })
                          }
                          className="border border-slate-200 rounded px-2 py-1 text-sm w-20 text-right"
                        />
                      ) : (
                        (item.next_due_km?.toLocaleString('ru-RU') ?? '—')
                      )}
                    </td>
                    <td
                      className={cn(
                        'px-4 py-3 text-right font-semibold',
                        rem !== null
                          ? rem < 0
                            ? 'text-red-600'
                            : rem < 2000
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          : 'text-slate-400',
                      )}
                    >
                      {rem !== null ? `${rem.toLocaleString('ru-RU')} км` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'badge text-xs px-2 py-0.5 rounded-full',
                          ALERT_COLOR[item.alert_status],
                        )}
                      >
                        {ALERT_LABEL[item.alert_status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => updateMutation.mutate({ id: item.id, body: editForm })}
                            className="text-xs font-bold px-2 py-1 rounded bg-emerald-600 text-white"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-xs font-bold px-2 py-1 rounded border border-slate-200 text-slate-500"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => startEdit(item)}
                            className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded border border-slate-200"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => deleteMutation.mutate(item.id)}
                            className="text-xs text-slate-400 hover:text-red-600 px-2 py-1 rounded border border-slate-200"
                          >
                            🗑
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════ WORK CATALOG ════════════════════════════════════

function WorkCatalogSection() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<WorkCatalogItem>>({});
  const [createForm, setCreateForm] = useState({
    name: '',
    category: '',
    hours_gazelle: '',
    hours_valdai: '',
  });
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery<WorkCatalogItem[]>({
    queryKey: ['garage-work-catalog'],
    queryFn: () =>
      fetch('/api/garage/work-catalog')
        .then((r) => r.json())
        .then((d) => (Array.isArray(d) ? d : [])),
  });
  const { data: settings } = useQuery<SettingsData>({
    queryKey: ['garage-settings'],
    queryFn: () => fetch('/api/garage/settings').then((r) => r.json()),
    staleTime: 300000,
  });

  const rateClient = parseFloat(settings?.sto?.hourly_rate ?? '2000');
  const rateOwn = parseFloat(settings?.sto?.hourly_rate_own ?? '1600');

  const calcPrice = (minutes: number | null, rate: number): number => {
    if (!minutes) return 0;
    return Math.round((minutes / 60) * rate);
  };

  const minToH = (m: number | null): string => {
    if (m == null) return '—';
    const h = m / 60;
    return h % 1 === 0 ? h.toFixed(0) : h.toFixed(1);
  };

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetch('/api/garage/work-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Ошибка создания');
      return d;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['garage-work-catalog'] });
      setShowCreate(false);
      setCreateError(null);
      setCreateForm({ name: '', category: '', hours_gazelle: '', hours_valdai: '' });
    },
    onError: (err: Error) => setCreateError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      fetch(`/api/garage/work-catalog/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['garage-work-catalog'] });
      setEditingId(null);
    },
  });

  const filteredItems = categoryFilter ? items.filter((i) => i.category === categoryFilter) : items;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Виды работ</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Справочник нормачасов по типам автомобилей
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-slate-700 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Добавить вид работы
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setCategoryFilter(null)}
          className={cn(
            'text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors',
            categoryFilter === null
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400',
          )}
        >
          Все
        </button>
        {[...new Set(items.map((i) => i.category ?? 'Прочее'))].sort().map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat === categoryFilter ? null : cat)}
            className={cn(
              'text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors',
              categoryFilter === cat
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400',
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="h-48 bg-slate-100 rounded-2xl animate-pulse" />
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Вид работы
                </th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Категория
                </th>
                <th
                  className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase bg-slate-100"
                  colSpan={3}
                >
                  Газель
                </th>
                <th
                  className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase bg-blue-50/50"
                  colSpan={3}
                >
                  Валдай
                </th>
                <th className="px-3 py-3"></th>
              </tr>
              <tr>
                <th className="px-3"></th>
                <th className="px-3"></th>
                <th className="text-right px-2 py-2 text-[10px] font-medium text-slate-400 uppercase bg-slate-50">
                  нч
                </th>
                <th className="text-right px-2 py-2 text-[10px] font-medium text-slate-400 uppercase bg-slate-50">
                  клиент ₽
                </th>
                <th className="text-right px-2 py-2 text-[10px] font-medium text-slate-400 uppercase bg-slate-50">
                  свой ₽
                </th>
                <th className="text-right px-2 py-2 text-[10px] font-medium text-slate-400 uppercase bg-blue-50/30">
                  нч
                </th>
                <th className="text-right px-2 py-2 text-[10px] font-medium text-slate-400 uppercase bg-blue-50/30">
                  клиент ₽
                </th>
                <th className="text-right px-2 py-2 text-[10px] font-medium text-slate-400 uppercase bg-blue-50/30">
                  свой ₽
                </th>
                <th className="px-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item) => {
                const isEditing = editingId === item.id;
                const nG = item.norm_minutes;
                const nV = item.norm_minutes_valdai;
                return (
                  <tr
                    key={item.id}
                    className={cn('hover:bg-slate-50/60', !item.is_active && 'opacity-50')}
                  >
                    <td className="px-3 py-3 text-slate-800 font-medium">
                      {isEditing ? (
                        <input
                          value={editForm.name ?? ''}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="border border-slate-200 rounded px-2 py-1 text-sm w-full"
                        />
                      ) : (
                        item.name
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-500">
                      {isEditing ? (
                        <input
                          value={editForm.category ?? ''}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                          className="border border-slate-200 rounded px-2 py-1 text-sm w-24"
                        />
                      ) : (
                        (item.category ?? '—')
                      )}
                    </td>
                    <td className="px-2 py-3 text-right font-mono text-slate-600 bg-slate-50/50">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.5"
                          value={
                            editForm.norm_minutes != null
                              ? (editForm.norm_minutes / 60).toString()
                              : ''
                          }
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              norm_minutes: parseFloat(e.target.value || '0') * 60,
                            })
                          }
                          className="border border-slate-200 rounded px-2 py-1 text-sm w-14 text-right"
                        />
                      ) : (
                        minToH(nG)
                      )}
                    </td>
                    <td className="px-2 py-3 text-right font-semibold text-slate-700 bg-slate-50/50">
                      {isEditing
                        ? ''
                        : nG
                          ? `${calcPrice(nG, rateClient).toLocaleString('ru-RU')}`
                          : '—'}
                    </td>
                    <td className="px-2 py-3 text-right font-semibold text-emerald-700 bg-slate-50/50">
                      {isEditing
                        ? ''
                        : nG
                          ? `${calcPrice(nG, rateOwn).toLocaleString('ru-RU')}`
                          : '—'}
                    </td>
                    <td className="px-2 py-3 text-right font-mono text-slate-600 bg-blue-50/20">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.5"
                          value={
                            editForm.norm_minutes_valdai != null
                              ? (editForm.norm_minutes_valdai / 60).toString()
                              : ''
                          }
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              norm_minutes_valdai: parseFloat(e.target.value || '0') * 60,
                            })
                          }
                          className="border border-slate-200 rounded px-2 py-1 text-sm w-14 text-right"
                        />
                      ) : (
                        minToH(nV)
                      )}
                    </td>
                    <td className="px-2 py-3 text-right font-semibold text-slate-700 bg-blue-50/20">
                      {isEditing
                        ? ''
                        : nV
                          ? `${calcPrice(nV, rateClient).toLocaleString('ru-RU')}`
                          : '—'}
                    </td>
                    <td className="px-2 py-3 text-right font-semibold text-emerald-700 bg-blue-50/20">
                      {isEditing
                        ? ''
                        : nV
                          ? `${calcPrice(nV, rateOwn).toLocaleString('ru-RU')}`
                          : '—'}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {isEditing ? (
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() =>
                              updateMutation.mutate({ id: item.id, body: { ...editForm } })
                            }
                            className="text-xs font-bold px-2 py-1 rounded bg-emerald-600 text-white"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-xs font-bold px-2 py-1 rounded border border-slate-200 text-slate-500"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingId(item.id);
                            setEditForm(item);
                          }}
                          className="text-xs text-slate-400 hover:text-slate-700 px-2 py-1 rounded border border-slate-200"
                        >
                          ✏️
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-bold text-slate-900 mb-4">Новый вид работы</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">
                  Название *
                </label>
                <input
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Категория</label>
                <input
                  value={createForm.category}
                  onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">
                    Газель (нч)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="2.0"
                    value={createForm.hours_gazelle}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, hours_gazelle: e.target.value })
                    }
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">
                    Валдай (нч)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="2.5"
                    value={createForm.hours_valdai}
                    onChange={(e) => setCreateForm({ ...createForm, hours_valdai: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="text-xs text-slate-400">
                Цены: клиент = нч × {rateClient} ₽, свой парк = нч × {rateOwn} ₽
              </div>
              {createError && (
                <p className="text-xs text-red-600 font-medium bg-red-50 rounded-lg px-3 py-2">
                  {createError}
                </p>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowCreate(false);
                    setCreateError(null);
                  }}
                  className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm font-semibold"
                >
                  Отмена
                </button>
                <button
                  onClick={() =>
                    createMutation.mutate({
                      name: createForm.name,
                      category: createForm.category || null,
                      norm_minutes: parseFloat(createForm.hours_gazelle || '0') * 60 || null,
                      norm_minutes_valdai: parseFloat(createForm.hours_valdai || '0') * 60 || null,
                    })
                  }
                  disabled={createMutation.isPending || !createForm.name.trim()}
                  className="flex-[2] bg-slate-900 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
                >
                  Создать
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════ FAULT CATALOG ═══════════════════════════════════

function FaultCatalogSection() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<FaultCatalogItem>>({});
  const [createForm, setCreateForm] = useState({ name: '', category: 'other' });

  const { data: items = [], isLoading } = useQuery<FaultCatalogItem[]>({
    queryKey: ['garage-fault-catalog'],
    queryFn: () =>
      fetch('/api/garage/fault-catalog')
        .then((r) => r.json())
        .then((d) => (Array.isArray(d) ? d : [])),
  });
  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch('/api/garage/fault-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['garage-fault-catalog'] });
      setShowCreate(false);
      setCreateForm({ name: '', category: 'other' });
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      fetch(`/api/garage/fault-catalog/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['garage-fault-catalog'] });
      setEditingId(null);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Каталог неисправностей</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Симптомы на языке водителя — быстрый выбор при заявке
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-slate-700 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Добавить симптом
        </button>
      </div>

      {isLoading ? (
        <div className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((item) => {
            const isEditing = editingId === item.id;
            return (
              <div
                key={item.id}
                className={cn(
                  'bg-white border border-slate-200 rounded-2xl p-4',
                  !item.is_active && 'opacity-50',
                )}
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      value={editForm.name ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    />
                    <select
                      value={editForm.category ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    >
                      {Object.entries(FAULT_CATEGORIES).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateMutation.mutate({ id: item.id, body: editForm })}
                        className="text-xs font-bold px-3 py-1 rounded bg-emerald-600 text-white"
                      >
                        ✓ Сохранить
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs px-3 py-1 rounded border border-slate-200 text-slate-500"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{item.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {FAULT_CATEGORIES[item.category] ?? item.category}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingId(item.id);
                        setEditForm(item);
                      }}
                      className="text-xs text-slate-400 hover:text-slate-700 px-2 py-1 rounded border border-slate-200"
                    >
                      ✏️
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-bold text-slate-900 mb-4">Новый симптом</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">
                  Название *
                </label>
                <input
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="Скрип при торможении"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Категория</label>
                <select
                  value={createForm.category}
                  onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  {Object.entries(FAULT_CATEGORIES).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm font-semibold"
                >
                  Отмена
                </button>
                <button
                  onClick={() => createMutation.mutate(createForm)}
                  disabled={createMutation.isPending || !createForm.name.trim()}
                  className="flex-[2] bg-slate-900 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
                >
                  Создать
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════ REPORTS ═════════════════════════════════════════

function ReportsSection({ tab }: { tab: ReportTab }) {
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedAssetId, setSelectedAssetId] = useState('');

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ['assets-select'],
    queryFn: () => fetch('/api/garage/assets').then((r) => r.json()),
    staleTime: 300000,
  });
  const { data: vehicleHistory = [], isLoading: vhLoading } = useQuery<VehicleHistoryItem[]>({
    queryKey: ['garage-vehicle-history', selectedAssetId],
    queryFn: () =>
      selectedAssetId
        ? fetch(`/api/garage/vehicle-history?asset_id=${selectedAssetId}`)
            .then((r) => r.json())
            .then((d) => (Array.isArray(d) ? d : []))
        : Promise.resolve([]),
    enabled: tab === 'vehicles' && !!selectedAssetId,
  });
  const { data: mechanicStats = [], isLoading: msLoading } = useQuery<MechanicStat[]>({
    queryKey: ['garage-mechanic-stats', reportMonth],
    queryFn: () =>
      fetch(`/api/garage/mechanic-stats?month=${reportMonth}`)
        .then((r) => r.json())
        .then((d) => (Array.isArray(d) ? d : [])),
    enabled: tab === 'mechanics',
  });

  if (tab === 'vehicles')
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">История автомобилей</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Наряды на ремонт по конкретному автомобилю
          </p>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 block mb-1">
            Выберите автомобиль
          </label>
          <select
            value={selectedAssetId}
            onChange={(e) => setSelectedAssetId(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-64"
          >
            <option value="">— Выберите —</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.short_name} · {a.reg_number}
              </option>
            ))}
          </select>
        </div>
        {!selectedAssetId ? (
          <p className="text-sm text-slate-400">
            Выберите автомобиль для просмотра истории нарядов
          </p>
        ) : vhLoading ? (
          <div className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
        ) : vehicleHistory.length === 0 ? (
          <p className="text-sm text-slate-400">Нет нарядов</p>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    Дата
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    Наряд
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    Работы
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    Пробег
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    Нч
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    Стоимость
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vehicleHistory.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-slate-500">{fmtDate(o.created_at)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">
                      #{o.order_number}
                    </td>
                    <td className="px-4 py-3 text-slate-700 text-xs">
                      {(o.works ?? []).map((w) => w.work_catalog?.name ?? '—').join(', ')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {o.odometer_start?.toLocaleString('ru-RU') ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-xs">
                      {o.total_actual_minutes > 0
                        ? (o.total_actual_minutes / 60).toFixed(1)
                        : (o.total_norm_minutes / 60).toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900 text-xs">
                      {moneyVal(o.total_cost).toLocaleString('ru-RU')} ₽
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Статистика по механикам</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Нормачасы, наряды, план / факт, начисленная ЗП
          </p>
        </div>
        <MonthNav month={reportMonth} onChange={setReportMonth} />
      </div>
      {msLoading ? (
        <div className="h-48 bg-slate-100 rounded-2xl animate-pulse" />
      ) : mechanicStats.length === 0 ? (
        <p className="text-sm text-slate-400">Нет данных</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {mechanicStats.map((stat) => (
            <div
              key={stat.mechanic_id}
              className="bg-white border border-slate-200 rounded-2xl p-5"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="font-bold text-slate-900 text-lg">{stat.mechanic_name}</div>
                  <div className="text-sm text-slate-400">Механик · ставка {stat.salary_pct}%</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-slate-900">
                    {moneyVal(stat.accrued_salary).toLocaleString('ru-RU')} ₽
                  </div>
                  <div className="text-xs text-slate-400">начислено за месяц</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-slate-900">{stat.orders_count}</div>
                  <div className="text-xs text-slate-400 mt-0.5">нарядов</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-slate-900">
                    {stat.plan_norm_hours.toFixed(1)}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">план нч</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <div
                    className={cn(
                      'text-xl font-bold',
                      stat.fact_norm_hours >= stat.plan_norm_hours
                        ? 'text-emerald-600'
                        : 'text-amber-600',
                    )}
                  >
                    {stat.fact_norm_hours.toFixed(1)}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">факт нч</div>
                </div>
              </div>
              {stat.plan_norm_hours > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-slate-500 mb-1.5 flex justify-between">
                    <span>Выполнение плана</span>
                    <span className="font-medium">
                      {Math.round((stat.fact_norm_hours / stat.plan_norm_hours) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full">
                    <div
                      className={cn(
                        'h-2 rounded-full',
                        stat.fact_norm_hours >= stat.plan_norm_hours
                          ? 'bg-emerald-500'
                          : 'bg-blue-500',
                      )}
                      style={{
                        width: `${Math.min(Math.round((stat.fact_norm_hours / stat.plan_norm_hours) * 100), 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
              <div className="border-t border-slate-100 pt-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Начислено</span>
                  <span className="font-semibold text-slate-900">
                    {moneyVal(stat.accrued_salary).toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              </div>
              {stat.orders.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Наряды</p>
                  <div className="space-y-1">
                    {stat.orders.map((o) => (
                      <div key={o.id} className="flex justify-between text-xs">
                        <span className="text-slate-700">
                          #{o.order_number} · {o.vehicle}
                        </span>
                        <span className="text-slate-500">
                          {(
                            (o.works ?? []).reduce(
                              (s, w) => s + (w.actual_minutes ?? w.norm_minutes ?? 0),
                              0,
                            ) / 60
                          ).toFixed(1)}{' '}
                          нч
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════ SETTINGS ════════════════════════════════════════

function SettingsSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<SettingsData>({
    queryKey: ['garage-settings'],
    queryFn: () => fetch('/api/garage/settings').then((r) => r.json()),
  });
  const [rate, setRate] = useState('');
  const [rateOwn, setRateOwn] = useState('');
  const [mechPct, setMechPct] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data) return;
    setRate(data.sto?.hourly_rate ?? '2000');
    setRateOwn(data.sto?.hourly_rate_own ?? '1600');
    const pctMap: Record<string, string> = {};
    for (const m of data.mechanics ?? []) pctMap[m.id] = m.mechanic_salary_pct ?? '50';
    setMechPct(pctMap);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch('/api/garage/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['garage-settings'] }),
  });

  if (isLoading) return <div className="h-48 bg-slate-100 rounded-2xl animate-pulse" />;

  const sto = data?.sto ?? { hourly_rate: '2000.00', hourly_rate_own: '1600.00' };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Настройки СТО</h1>
        <p className="text-sm text-slate-400 mt-0.5">Ставки нормачаса и проценты механикам</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Финансовые параметры</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Ставка СТО — клиент (₽ за нормачас)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
              <button
                onClick={() => saveMutation.mutate({ hourly_rate: rate || sto.hourly_rate })}
                disabled={saveMutation.isPending}
                className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-xl"
              >
                Сохранить
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Цена нормачаса для клиента / расчёта стоимости работ
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Ставка СТО — свой автопарк (₽ за нормачас)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={rateOwn}
                onChange={(e) => setRateOwn(e.target.value)}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
              <button
                onClick={() =>
                  saveMutation.mutate({ hourly_rate_own: rateOwn || sto.hourly_rate_own })
                }
                disabled={saveMutation.isPending}
                className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-xl"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Ставки механиков</h3>
        <div className="space-y-3">
          {(data?.mechanics ?? []).map((m) => {
            const pct = parseFloat(m.mechanic_salary_pct ?? '50');
            const rateNum = parseFloat(sto.hourly_rate);
            const perHour = ((rateNum * pct) / 100).toFixed(0);
            return (
              <div key={m.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <div className="flex-1">
                  <div className="font-medium text-slate-900 text-sm">{m.name}</div>
                  <div className="text-xs text-slate-400">
                    При ставке СТО {rateNum} ₽/нч → получает {perHour} ₽/нч
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={mechPct[m.id] ?? pct.toString()}
                    onChange={(e) => setMechPct((prev) => ({ ...prev, [m.id]: e.target.value }))}
                    className="w-20 text-center border border-slate-200 rounded-lg px-2 py-1 text-sm"
                    min="0"
                    max="100"
                  />
                  <span className="text-slate-500 text-sm">%</span>
                  <button
                    onClick={() =>
                      saveMutation.mutate({
                        mechanic_id: m.id,
                        mechanic_salary_pct: mechPct[m.id] ?? pct.toString(),
                      })
                    }
                    disabled={saveMutation.isPending}
                    className="text-xs font-medium px-3 py-1 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
                  >
                    OK
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════ MAIN PAGE ═══════════════════════════════════════

export default function GaragePage() {
  const [section, setSection] = useState<GarageSection>('dashboard');
  const [showCreate, setShowCreate] = useState(false);

  const { data: dashData } = useQuery<DashboardData>({
    queryKey: ['garage-dashboard'],
    queryFn: () => fetch('/api/garage/dashboard').then((r) => r.json()),
    staleTime: 30000,
  });

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ['assets-select'],
    queryFn: () => fetch('/api/garage/assets').then((r) => r.json()),
    staleTime: 300000,
  });

  const counts = dashData?.counts ?? null;

  return (
    <div className="flex -mx-6 -mt-4" style={{ minHeight: 'calc(100vh - 64px - 32px)' }}>
      <Sidebar section={section} onChange={setSection} counts={counts} />
      <main className="flex-1 overflow-auto p-6">
        {section === 'dashboard' && (
          <DashboardSection onNav={setSection} onCreateOrder={() => setShowCreate(true)} />
        )}
        {section === 'requests' && <RequestsSection />}
        {section === 'workorders' && <WorkOrdersSection />}
        {section === 'maintenance' && <MaintenanceSection />}
        {section === 'worktypes' && <WorkCatalogSection />}
        {section === 'faultcatalog' && <FaultCatalogSection />}
        {section === 'repvehicles' && <ReportsSection tab="vehicles" />}
        {section === 'repmechanics' && <ReportsSection tab="mechanics" />}
        {section === 'clients' && <ClientsSection />}
        {section === 'settings' && <SettingsSection />}
      </main>
      {showCreate && <CreateOrderModal onClose={() => setShowCreate(false)} assets={assets} />}
    </div>
  );
}

// ═══════════════════════════ CLIENTS SECTION ══════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────────────────

type StoClient = {
  id: string;
  name: string;
  phone: string | null;
  vehicles_count: number;
  orders_count: number;
  total_revenue: string;
  last_order_date: string | null;
};

type ClientVehicle = {
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

type VehicleRule = {
  id: string;
  work_name: string;
  interval_km: number | null;
  interval_months: number | null;
  last_done_km: number | null;
  last_done_at: string | null;
};

type VehicleRec = {
  id: string;
  text: string;
  due_km: number | null;
  due_date: string | null;
  is_done: boolean;
  done_at: string | null;
  created_at: string;
  created_user: { name: string } | null;
};

type VehicleOrder = {
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

type VehicleDetail = {
  vehicle: ClientVehicle;
  orders: VehicleOrder[];
  rules: VehicleRule[];
  recommendations: VehicleRec[];
};

function ruleAlert(rule: VehicleRule, odometer: number | null): 'ok' | 'soon' | 'overdue' | null {
  const now = new Date();
  let kmStatus: 'ok' | 'soon' | 'overdue' | null = null;
  let dateStatus: 'ok' | 'soon' | 'overdue' | null = null;

  if (rule.interval_km && rule.last_done_km && odometer) {
    const nextKm = rule.last_done_km + rule.interval_km;
    const remaining = nextKm - odometer;
    if (remaining <= 0) kmStatus = 'overdue';
    else if (remaining <= rule.interval_km * 0.15) kmStatus = 'soon';
    else kmStatus = 'ok';
  }

  if (rule.interval_months && rule.last_done_at) {
    const nextDate = new Date(rule.last_done_at);
    nextDate.setMonth(nextDate.getMonth() + rule.interval_months);
    const daysLeft = Math.ceil((nextDate.getTime() - now.getTime()) / 86400000);
    if (daysLeft <= 0) dateStatus = 'overdue';
    else if (daysLeft <= 30) dateStatus = 'soon';
    else dateStatus = 'ok';
  }

  const statuses = [kmStatus, dateStatus].filter(Boolean) as Array<'ok' | 'soon' | 'overdue'>;
  if (statuses.includes('overdue')) return 'overdue';
  if (statuses.includes('soon')) return 'soon';
  if (statuses.includes('ok')) return 'ok';
  return null;
}

// ─── STO Clients Detail Types ─────────────────────────────────────────────────

type StoClientVehicle = {
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

type StoClientDetail = {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  vehicles: StoClientVehicle[];
};

// ─── Create Client Modal (клиент + первый автомобиль за один шаг) ────────────

function CreateClientModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [client, setClient] = useState({ name: '', phone: '' });
  const [vehicle, setVehicle] = useState({
    brand: '',
    model: '',
    reg_number: '',
    year: '',
    vin: '',
    color: '',
  });
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/garage/sto-clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...client, ...vehicle }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Ошибка');
      return d;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sto-clients'] });
      onCreated();
    },
    onError: (e: Error) => setError(e.message),
  });

  const canSubmit = client.name.trim() && vehicle.brand.trim() && vehicle.reg_number.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Новый клиент СТО</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-6 space-y-5">
          {/* Клиент */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Клиент</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                  Имя / организация *
                </label>
                <input
                  value={client.name}
                  onChange={(e) => setClient({ ...client, name: e.target.value })}
                  placeholder="Иванов Иван"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                  Телефон
                </label>
                <input
                  value={client.phone}
                  onChange={(e) => setClient({ ...client, phone: e.target.value })}
                  placeholder="+7 900 000-00-00"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Автомобиль */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
              Автомобиль
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                    Марка *
                  </label>
                  <input
                    value={vehicle.brand}
                    onChange={(e) => setVehicle({ ...vehicle, brand: e.target.value })}
                    placeholder="Toyota"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                    Модель
                  </label>
                  <input
                    value={vehicle.model}
                    onChange={(e) => setVehicle({ ...vehicle, model: e.target.value })}
                    placeholder="Camry"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                    Госномер *
                  </label>
                  <input
                    value={vehicle.reg_number}
                    onChange={(e) => setVehicle({ ...vehicle, reg_number: e.target.value })}
                    placeholder="А123ВС96"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                    Год
                  </label>
                  <input
                    value={vehicle.year}
                    onChange={(e) => setVehicle({ ...vehicle, year: e.target.value })}
                    placeholder="2020"
                    type="number"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                    VIN
                  </label>
                  <input
                    value={vehicle.vin}
                    onChange={(e) => setVehicle({ ...vehicle, vin: e.target.value })}
                    placeholder="JTMBE..."
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                    Цвет
                  </label>
                  <input
                    value={vehicle.color}
                    onChange={(e) => setVehicle({ ...vehicle, color: e.target.value })}
                    placeholder="Белый"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="border-t border-slate-100 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-slate-300 text-slate-700 font-semibold py-2.5 rounded-xl text-sm"
          >
            Отмена
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!canSubmit || mutation.isPending}
            className="flex-1 bg-slate-900 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-40"
          >
            {mutation.isPending ? '...' : 'Добавить клиента'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ClientsSection() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [showCreateVehicle, setShowCreateVehicle] = useState(false);

  const {
    data: clients = [],
    isLoading,
    error: clientsError,
  } = useQuery<StoClient[]>({
    queryKey: ['sto-clients', search],
    queryFn: async () => {
      const r = await fetch(`/api/garage/sto-clients?search=${encodeURIComponent(search)}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Ошибка загрузки');
      return Array.isArray(d) ? d : [];
    },
    staleTime: 30000,
  });

  const { data: detail, isLoading: detailLoading } = useQuery<StoClientDetail>({
    queryKey: ['sto-client-detail', selectedId],
    queryFn: async () => {
      const r = await fetch(`/api/garage/sto-clients/${selectedId}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Ошибка');
      return d;
    },
    enabled: !!selectedId,
    staleTime: 15000,
  });

  return (
    <div className="flex h-full gap-0 min-h-0">
      {/* ── Левая панель: список клиентов ── */}
      <div className="w-80 shrink-0 border-r border-slate-200 flex flex-col bg-white">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-base font-bold text-slate-900 flex-1">Клиенты СТО</h2>
            <button
              onClick={() => setShowCreateClient(true)}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              + Клиент
            </button>
            <button
              onClick={() => setShowCreateVehicle(true)}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-700"
            >
              + Авто
            </button>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени, телефону..."
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-sm text-slate-400">Загрузка...</div>
          ) : clientsError ? (
            <div className="p-4 text-sm text-red-500">
              Ошибка: {(clientsError as Error).message}
            </div>
          ) : clients.length === 0 ? (
            <div className="p-4 text-sm text-slate-400">
              {search ? 'Ничего не найдено' : 'Клиентов пока нет'}
            </div>
          ) : (
            clients.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={cn(
                  'w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors',
                  selectedId === c.id && 'bg-blue-50 border-l-2 border-l-blue-500',
                )}
              >
                <div className="font-semibold text-sm text-slate-900">{c.name}</div>
                {c.phone && <div className="text-xs text-slate-500 mt-0.5">{c.phone}</div>}
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-slate-400">
                    {c.vehicles_count} авто · {c.orders_count} нарядов
                  </span>
                  {parseFloat(c.total_revenue) > 0 && (
                    <span className="text-xs font-semibold text-emerald-700">
                      {parseFloat(c.total_revenue).toLocaleString('ru-RU')} ₽
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Правая панель: карточка клиента ── */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        {!selectedId ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            Выберите клиента из списка
          </div>
        ) : detailLoading ? (
          <div className="p-8 text-slate-400 text-sm">Загрузка...</div>
        ) : detail ? (
          <StoClientDetailView
            detail={detail}
            onUpdate={() => {
              qc.invalidateQueries({ queryKey: ['sto-client-detail', selectedId] });
              qc.invalidateQueries({ queryKey: ['sto-clients'] });
            }}
          />
        ) : null}
      </div>

      {showCreateClient && (
        <CreateClientModal
          onClose={() => setShowCreateClient(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['sto-clients'] });
            setShowCreateClient(false);
          }}
        />
      )}
      {showCreateVehicle && (
        <CreateVehicleModal
          onClose={() => setShowCreateVehicle(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['sto-clients'] });
            setShowCreateVehicle(false);
          }}
        />
      )}
    </div>
  );
}

function StoClientDetailView({
  detail,
  onUpdate,
}: {
  detail: StoClientDetail;
  onUpdate: () => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState(detail.name);
  const [editPhone, setEditPhone] = useState(detail.phone ?? '');
  const [editNotes, setEditNotes] = useState(detail.notes ?? '');
  const [expandedVehicle, setExpandedVehicle] = useState<string | null>(
    detail.vehicles.length === 1 ? (detail.vehicles[0]?.id ?? null) : null,
  );
  const [vehicleDetailId, setVehicleDetailId] = useState<string | null>(null);

  const { data: vehicleDetail, isLoading: vehicleDetailLoading } = useQuery<VehicleDetail>({
    queryKey: ['client-vehicle-detail', vehicleDetailId],
    queryFn: async () => {
      const r = await fetch(`/api/garage/client-vehicles/${vehicleDetailId}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Ошибка');
      return d;
    },
    enabled: !!vehicleDetailId,
    staleTime: 15000,
  });

  const patchClient = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/garage/sto-clients/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, phone: editPhone, notes: editNotes }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Ошибка');
      return d;
    },
    onSuccess: () => {
      setEditMode(false);
      onUpdate();
    },
  });

  const totalRevenue = detail.vehicles.reduce((s, v) => s + parseFloat(v.total_spent), 0);
  const totalOrders = detail.vehicles.reduce((s, v) => s + v.orders.length, 0);

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      {/* Шапка клиента */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        {editMode ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                  Имя
                </label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                  Телефон
                </label>
                <input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                Заметки
              </label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditMode(false)}
                className="text-sm text-slate-500 hover:underline"
              >
                Отмена
              </button>
              <button
                onClick={() => patchClient.mutate()}
                disabled={patchClient.isPending || !editName.trim()}
                className="text-sm px-4 py-1.5 bg-slate-900 text-white rounded-lg font-semibold disabled:opacity-40"
              >
                {patchClient.isPending ? '...' : 'Сохранить'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900">{detail.name}</h2>
              {detail.phone && <div className="text-sm text-slate-500 mt-0.5">{detail.phone}</div>}
              {detail.notes && (
                <div className="text-sm text-slate-400 mt-1 italic">{detail.notes}</div>
              )}
            </div>
            <div className="flex items-start gap-4 shrink-0">
              <div className="text-right">
                <div className="text-xs text-slate-400 uppercase font-semibold">Выручка</div>
                <div className="text-2xl font-black text-slate-900">
                  {totalRevenue.toLocaleString('ru-RU')} ₽
                </div>
                <div className="text-xs text-slate-400">
                  {detail.vehicles.length} авто · {totalOrders} нарядов
                </div>
              </div>
              <button
                onClick={() => setEditMode(true)}
                className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-semibold mt-1"
              >
                Изменить
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Список автомобилей */}
      {detail.vehicles.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-sm">
          У этого клиента нет автомобилей
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide px-1">
            Автомобили
          </h3>
          {detail.vehicles.map((v) => {
            const isExpanded = expandedVehicle === v.id;
            return (
              <div
                key={v.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
              >
                {/* Vehicle header */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="font-bold text-slate-900">
                        {v.brand} {v.model ?? ''} {v.year ? `· ${v.year}` : ''}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="font-mono text-sm text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {v.reg_number}
                        </span>
                        {v.vin && <span className="text-xs text-slate-400">VIN: {v.vin}</span>}
                        {v.odometer_last && (
                          <span className="text-xs text-slate-400">
                            {v.odometer_last.toLocaleString('ru-RU')} км
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-black text-slate-900">
                        {parseFloat(v.total_spent).toLocaleString('ru-RU')} ₽
                      </div>
                      <div className="text-xs text-slate-400">{v.orders.length} нарядов</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      onClick={() => setExpandedVehicle(isExpanded ? null : v.id)}
                      className="text-xs text-blue-500 hover:text-blue-700"
                    >
                      {isExpanded ? '▲ Скрыть историю' : '▼ История нарядов'}
                    </button>
                    <button
                      onClick={() => setVehicleDetailId(vehicleDetailId === v.id ? null : v.id)}
                      className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-2 py-0.5"
                    >
                      {vehicleDetailId === v.id ? 'Скрыть карточку' : 'Карточка ТО'}
                    </button>
                  </div>
                </div>

                {/* Full vehicle card (maintenance rules & recommendations) */}
                {vehicleDetailId === v.id && (
                  <div className="border-t border-slate-100">
                    {vehicleDetailLoading ? (
                      <div className="p-4 text-sm text-slate-400">Загрузка карточки...</div>
                    ) : vehicleDetail ? (
                      <VehicleCard
                        detail={vehicleDetail}
                        onUpdate={() => {
                          onUpdate();
                        }}
                      />
                    ) : null}
                  </div>
                )}

                {/* Order history */}
                {isExpanded && (
                  <div className="border-t border-slate-100 divide-y divide-slate-100">
                    {v.orders.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-slate-400">
                        Нарядов нет
                      </div>
                    ) : (
                      v.orders.map((o) => (
                        <div key={o.id} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-bold text-slate-900 text-sm">
                                Наряд #{o.order_number}
                              </span>
                              <span
                                className={cn(
                                  'ml-2 text-xs px-2 py-0.5 rounded-full font-semibold',
                                  o.lifecycle_status === 'approved'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : o.lifecycle_status === 'cancelled'
                                      ? 'bg-red-100 text-red-600'
                                      : 'bg-amber-100 text-amber-700',
                                )}
                              >
                                {o.lifecycle_status === 'approved'
                                  ? 'Принят'
                                  : o.lifecycle_status === 'cancelled'
                                    ? 'Отменён'
                                    : 'В работе'}
                              </span>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-black text-slate-900 text-sm">
                                {parseFloat(o.total).toLocaleString('ru-RU')} ₽
                              </div>
                              <div className="text-xs text-slate-400">
                                {new Date(o.created_at).toLocaleDateString('ru-RU')}
                              </div>
                            </div>
                          </div>
                          {o.problem_description && (
                            <p className="text-xs text-slate-500 mt-1">{o.problem_description}</p>
                          )}
                          {(o.mechanic || o.second_mechanic) && (
                            <div className="text-xs text-slate-400 mt-0.5">
                              Мастер:{' '}
                              {[o.mechanic?.name, o.second_mechanic?.name]
                                .filter(Boolean)
                                .join(', ')}
                            </div>
                          )}
                          {o.works.length > 0 && (
                            <div className="mt-2 space-y-0.5">
                              {o.works.map((w) => (
                                <div
                                  key={w.id}
                                  className="flex justify-between text-xs text-slate-600"
                                >
                                  <span>{w.work_catalog?.name ?? w.custom_work_name ?? '—'}</span>
                                  {w.price_client && (
                                    <span className="font-mono text-slate-500">
                                      {parseFloat(w.price_client).toLocaleString('ru-RU')} ₽
                                    </span>
                                  )}
                                </div>
                              ))}
                              {o.parts.map((p) => (
                                <div
                                  key={p.id}
                                  className="flex justify-between text-xs text-slate-400 italic"
                                >
                                  <span>
                                    {p.part?.name ?? p.custom_part_name ?? '—'} × {p.quantity}{' '}
                                    {p.unit ?? p.part?.unit ?? ''}
                                  </span>
                                  {p.client_price && (
                                    <span className="font-mono not-italic">
                                      {(parseFloat(p.client_price) * p.quantity).toLocaleString(
                                        'ru-RU',
                                      )}{' '}
                                      ₽
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {o.admin_note && (
                            <div className="mt-1 text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">
                              Заметка: {o.admin_note}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VehicleCard({ detail, onUpdate }: { detail: VehicleDetail; onUpdate: () => void }) {
  const { vehicle, orders, rules, recommendations } = detail;
  const [tab, setTab] = useState<'history' | 'rules' | 'recs'>('history');
  const [editOdo, setEditOdo] = useState('');
  const [showAddRule, setShowAddRule] = useState(false);
  const [showAddRec, setShowAddRec] = useState('');
  const [editNotes, setEditNotes] = useState<string | null>(null);

  const patchVehicle = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch(`/api/garage/client-vehicles/${vehicle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: onUpdate,
  });

  const addRec = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch(`/api/garage/client-vehicles/${vehicle.id}/recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      setShowAddRec('');
      onUpdate();
    },
  });

  const patchRec = useMutation({
    mutationFn: ({ recId, body }: { recId: string; body: Record<string, unknown> }) =>
      fetch(`/api/garage/client-vehicles/${vehicle.id}/recommendations?rec_id=${recId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: onUpdate,
  });

  const addRule = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch(`/api/garage/client-vehicles/${vehicle.id}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      setShowAddRule(false);
      onUpdate();
    },
  });

  const patchRule = useMutation({
    mutationFn: ({ ruleId, body }: { ruleId: string; body: Record<string, unknown> }) =>
      fetch(`/api/garage/client-vehicles/${vehicle.id}/rules?rule_id=${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: onUpdate,
  });

  const totalSpent = orders.reduce((s, o) => s + parseFloat(o.total_cost), 0);
  const openRecs = recommendations.filter((r) => !r.is_done);
  const alertRules = rules.filter((r) => {
    const st = ruleAlert(r, vehicle.odometer_last);
    return st === 'overdue' || st === 'soon';
  });

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Шапка машины */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900">
              {vehicle.brand} {vehicle.model ?? ''} {vehicle.year ? `· ${vehicle.year}` : ''}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="font-mono text-sm font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                {vehicle.reg_number}
              </span>
              {vehicle.vin && <span className="text-xs text-slate-400">VIN: {vehicle.vin}</span>}
              {vehicle.color && <span className="text-xs text-slate-400">{vehicle.color}</span>}
            </div>
            {vehicle.counterparty && (
              <div className="mt-2 text-sm text-slate-600">
                Клиент: <span className="font-semibold">{vehicle.counterparty.name}</span>
                {vehicle.counterparty.phone && (
                  <span className="text-slate-400 ml-2">{vehicle.counterparty.phone}</span>
                )}
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs text-slate-400 uppercase font-semibold">Потрачено всего</div>
            <div className="text-2xl font-black text-slate-900">
              {totalSpent.toLocaleString('ru-RU')} ₽
            </div>
            <div className="text-xs text-slate-400">{orders.length} визитов</div>
          </div>
        </div>

        {/* Одометр */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-3">
          <div className="flex-1">
            <span className="text-xs text-slate-400 uppercase font-semibold">Одометр</span>
            <div className="text-base font-bold text-slate-900">
              {vehicle.odometer_last
                ? `${vehicle.odometer_last.toLocaleString('ru-RU')} км`
                : 'не указан'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={editOdo}
              onChange={(e) => setEditOdo(e.target.value)}
              placeholder="Обновить..."
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-36"
            />
            <button
              onClick={() => {
                if (!editOdo) return;
                patchVehicle.mutate({ odometer_last: editOdo });
                setEditOdo('');
              }}
              disabled={!editOdo || patchVehicle.isPending}
              className="text-xs px-3 py-1.5 bg-slate-900 text-white rounded-lg font-semibold disabled:opacity-40"
            >
              Сохранить
            </button>
          </div>
        </div>

        {/* Предупреждения */}
        {(alertRules.length > 0 || openRecs.length > 0) && (
          <div className="mt-4 space-y-2">
            {alertRules.map((rule) => {
              const st = ruleAlert(rule, vehicle.odometer_last);
              return (
                <div
                  key={rule.id}
                  className={cn(
                    'flex items-start gap-2 text-sm px-3 py-2 rounded-lg',
                    st === 'overdue' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700',
                  )}
                >
                  <span className="font-bold shrink-0">{st === 'overdue' ? '⚠' : '!'}</span>
                  <span>
                    <span className="font-semibold">{rule.work_name}</span>
                    {st === 'overdue' ? ' — просрочено' : ' — скоро'}
                    {rule.interval_km && rule.last_done_km && vehicle.odometer_last && (
                      <span className="ml-1 text-xs opacity-70">
                        (осталось{' '}
                        {(
                          rule.last_done_km +
                          rule.interval_km -
                          vehicle.odometer_last
                        ).toLocaleString('ru-RU')}{' '}
                        км)
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
            {openRecs.length > 0 && (
              <div className="bg-blue-50 text-blue-700 text-sm px-3 py-2 rounded-lg">
                <span className="font-semibold">{openRecs.length} открытых рекомендаций</span> от
                мастера
              </div>
            )}
          </div>
        )}

        {/* Заметки */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          {editNotes !== null ? (
            <div className="flex gap-2">
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"
                placeholder="Особенности, пожелания клиента..."
              />
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => {
                    patchVehicle.mutate({ notes: editNotes });
                    setEditNotes(null);
                  }}
                  className="text-xs px-3 py-1.5 bg-slate-900 text-white rounded-lg font-semibold"
                >
                  Сохранить
                </button>
                <button
                  onClick={() => setEditNotes(null)}
                  className="text-xs text-slate-500 hover:underline"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditNotes(vehicle.notes ?? '')}
              className="text-sm text-slate-400 hover:text-slate-700 text-left w-full"
            >
              {vehicle.notes ? vehicle.notes : '+ Добавить заметку по автомобилю...'}
            </button>
          )}
        </div>
      </div>

      {/* Вкладки */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
        {(
          [
            { id: 'history' as const, label: `История (${orders.length})` },
            { id: 'rules' as const, label: `Регламент (${rules.length})` },
            { id: 'recs' as const, label: `Рекомендации (${recommendations.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 text-sm font-semibold py-2 rounded-lg transition-colors',
              tab === t.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* История нарядов */}
      {tab === 'history' && (
        <div className="space-y-3">
          {orders.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              Нарядов по этой машине нет
            </div>
          ) : (
            orders.map((o) => (
              <div key={o.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="font-bold text-slate-900">Наряд #{o.order_number}</span>
                    <span
                      className={cn(
                        'ml-2 text-xs px-2 py-0.5 rounded-full font-semibold',
                        STATUS_COLOR[o.status],
                      )}
                    >
                      {STATUS_LABEL[o.status]}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-black text-slate-900">
                      {parseFloat(o.total_cost).toLocaleString('ru-RU')} ₽
                    </div>
                    <div className="text-xs text-slate-400">
                      {new Date(o.created_at).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                </div>
                {o.problem_description && (
                  <p className="text-sm text-slate-600 mb-2">{o.problem_description}</p>
                )}
                {o.mechanic && (
                  <div className="text-xs text-slate-400 mb-2">Мастер: {o.mechanic.name}</div>
                )}
                {o.odometer_start && (
                  <div className="text-xs text-slate-400">
                    Одометр: {o.odometer_start.toLocaleString('ru-RU')} км
                    {o.odometer_end ? ` → ${o.odometer_end.toLocaleString('ru-RU')} км` : ''}
                  </div>
                )}
                {o.works.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                    {o.works.map((w) => (
                      <div key={w.id} className="flex justify-between text-xs text-slate-600">
                        <span>{w.work_catalog?.name ?? w.custom_work_name ?? '—'}</span>
                        {w.price_client && (
                          <span className="font-mono">
                            {parseFloat(w.price_client).toLocaleString('ru-RU')} ₽
                          </span>
                        )}
                      </div>
                    ))}
                    {o.parts.length > 0 &&
                      o.parts.map((p) => (
                        <div key={p.id} className="flex justify-between text-xs text-slate-500">
                          <span className="italic">
                            {p.part?.name ?? p.custom_part_name ?? '—'} × {p.quantity}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Регламенты ТО */}
      {tab === 'rules' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddRule(true)}
              className="text-xs font-semibold px-3 py-1.5 bg-slate-900 text-white rounded-lg"
            >
              + Добавить регламент
            </button>
          </div>
          {showAddRule && (
            <AddRuleForm
              onSubmit={(body) => addRule.mutate(body)}
              onCancel={() => setShowAddRule(false)}
              isPending={addRule.isPending}
            />
          )}
          {rules.length === 0 && !showAddRule ? (
            <div className="text-center py-8 text-slate-400 text-sm">Регламенты не настроены</div>
          ) : (
            rules.map((rule) => {
              const st = ruleAlert(rule, vehicle.odometer_last);
              return (
                <div
                  key={rule.id}
                  className={cn(
                    'bg-white rounded-xl border p-4',
                    st === 'overdue'
                      ? 'border-red-200'
                      : st === 'soon'
                        ? 'border-amber-200'
                        : 'border-slate-200',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-slate-900">{rule.work_name}</div>
                    {st && (
                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full font-semibold shrink-0',
                          st === 'overdue'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700',
                        )}
                      >
                        {st === 'overdue' ? 'Просрочено' : 'Скоро'}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 space-y-0.5">
                    {rule.interval_km && (
                      <div>Каждые {rule.interval_km.toLocaleString('ru-RU')} км</div>
                    )}
                    {rule.interval_months && <div>Каждые {rule.interval_months} мес.</div>}
                    {rule.last_done_km && (
                      <div>
                        Последний раз: {rule.last_done_km.toLocaleString('ru-RU')} км
                        {rule.last_done_at
                          ? ` · ${new Date(rule.last_done_at).toLocaleDateString('ru-RU')}`
                          : ''}
                      </div>
                    )}
                    {rule.interval_km && rule.last_done_km && vehicle.odometer_last && (
                      <div
                        className={cn(
                          'font-semibold',
                          st === 'overdue'
                            ? 'text-red-600'
                            : st === 'soon'
                              ? 'text-amber-600'
                              : 'text-emerald-600',
                        )}
                      >
                        Следующий: {(rule.last_done_km + rule.interval_km).toLocaleString('ru-RU')}{' '}
                        км (осталось{' '}
                        {(
                          rule.last_done_km +
                          rule.interval_km -
                          vehicle.odometer_last
                        ).toLocaleString('ru-RU')}{' '}
                        км)
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => {
                        const km = prompt('Одометр при последней замене (км):');
                        const date = prompt('Дата последней замены (ГГГГ-ММ-ДД):');
                        if (km)
                          patchRule.mutate({
                            ruleId: rule.id,
                            body: { last_done_km: km, last_done_at: date || null },
                          });
                      }}
                      className="text-xs px-3 py-1 border border-slate-300 rounded-lg hover:bg-slate-50 font-semibold"
                    >
                      Обновить данные
                    </button>
                    <button
                      onClick={() =>
                        patchRule.mutate({ ruleId: rule.id, body: { is_active: false } })
                      }
                      className="text-xs px-2 py-1 text-red-400 hover:text-red-600"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Рекомендации */}
      {tab === 'recs' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddRec('new')}
              className="text-xs font-semibold px-3 py-1.5 bg-slate-900 text-white rounded-lg"
            >
              + Добавить рекомендацию
            </button>
          </div>
          {showAddRec === 'new' && (
            <AddRecForm
              onSubmit={(text, dueKm, dueDate) =>
                addRec.mutate({ text, due_km: dueKm || null, due_date: dueDate || null })
              }
              onCancel={() => setShowAddRec('')}
              isPending={addRec.isPending}
            />
          )}
          {recommendations.length === 0 && showAddRec !== 'new' ? (
            <div className="text-center py-8 text-slate-400 text-sm">Рекомендаций нет</div>
          ) : (
            <div className="space-y-2">
              {recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className={cn(
                    'bg-white rounded-xl border p-4',
                    rec.is_done ? 'border-slate-100 opacity-60' : 'border-slate-200',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() =>
                        patchRec.mutate({ recId: rec.id, body: { is_done: !rec.is_done } })
                      }
                      className={cn(
                        'mt-0.5 w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center',
                        rec.is_done ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300',
                      )}
                    >
                      {rec.is_done && <span className="text-white text-xs font-bold">✓</span>}
                    </button>
                    <div className="flex-1">
                      <p
                        className={cn(
                          'text-sm',
                          rec.is_done ? 'line-through text-slate-400' : 'text-slate-800',
                        )}
                      >
                        {rec.text}
                      </p>
                      <div className="flex flex-wrap gap-3 mt-1">
                        {rec.due_km && (
                          <span className="text-xs text-slate-400">
                            до {rec.due_km.toLocaleString('ru-RU')} км
                          </span>
                        )}
                        {rec.due_date && (
                          <span className="text-xs text-slate-400">
                            до {new Date(rec.due_date).toLocaleDateString('ru-RU')}
                          </span>
                        )}
                        <span className="text-xs text-slate-300">
                          {new Date(rec.created_at).toLocaleDateString('ru-RU')}
                          {rec.created_user && ` · ${rec.created_user.name}`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddRuleForm({
  onSubmit,
  onCancel,
  isPending,
}: {
  onSubmit: (body: Record<string, unknown>) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [workName, setWorkName] = useState('');
  const [intervalKm, setIntervalKm] = useState('');
  const [intervalMonths, setIntervalMonths] = useState('');
  const [lastKm, setLastKm] = useState('');
  const [lastDate, setLastDate] = useState('');

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-slate-700">Новый регламент</p>
      <input
        type="text"
        value={workName}
        onChange={(e) => setWorkName(e.target.value)}
        placeholder="Название работы (напр. Замена масла)"
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          value={intervalKm}
          onChange={(e) => setIntervalKm(e.target.value)}
          placeholder="Интервал, км"
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="number"
          value={intervalMonths}
          onChange={(e) => setIntervalMonths(e.target.value)}
          placeholder="Интервал, мес."
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          value={lastKm}
          onChange={(e) => setLastKm(e.target.value)}
          placeholder="Последний раз, км"
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={lastDate}
          onChange={(e) => setLastDate(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 border border-slate-300 text-slate-600 rounded-lg py-2 text-sm font-semibold"
        >
          Отмена
        </button>
        <button
          disabled={!workName || isPending}
          onClick={() =>
            onSubmit({
              work_name: workName,
              interval_km: intervalKm,
              interval_months: intervalMonths,
              last_done_km: lastKm,
              last_done_at: lastDate,
            })
          }
          className="flex-1 bg-slate-900 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-40"
        >
          Добавить
        </button>
      </div>
    </div>
  );
}

function AddRecForm({
  onSubmit,
  onCancel,
  isPending,
}: {
  onSubmit: (text: string, dueKm: string, dueDate: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [text, setText] = useState('');
  const [dueKm, setDueKm] = useState('');
  const [dueDate, setDueDate] = useState('');

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-slate-700">Новая рекомендация</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="Что рекомендует мастер..."
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          value={dueKm}
          onChange={(e) => setDueKm(e.target.value)}
          placeholder="Сделать до, км"
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 border border-slate-300 text-slate-600 rounded-lg py-2 text-sm font-semibold"
        >
          Отмена
        </button>
        <button
          disabled={!text || isPending}
          onClick={() => onSubmit(text, dueKm, dueDate)}
          className="flex-1 bg-slate-900 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-40"
        >
          Добавить
        </button>
      </div>
    </div>
  );
}

function CreateVehicleModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id?: string) => void;
}) {
  const [form, setForm] = useState({
    brand: '',
    model: '',
    year: '',
    reg_number: '',
    vin: '',
    color: '',
    odometer_last: '',
    notes: '',
  });
  const [selectedCounterparty, setSelectedCounterparty] = useState<CounterpartyOption | null>(null);
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/garage/client-vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, counterparty_id: selectedCounterparty?.id ?? null }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Ошибка');
      return d;
    },
    onSuccess: (data) => onCreated(data.id),
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Новый автомобиль клиента</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                Марка *
              </label>
              <input
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                placeholder="Toyota"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                Модель
              </label>
              <input
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="Camry"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                Госномер *
              </label>
              <input
                value={form.reg_number}
                onChange={(e) => setForm({ ...form, reg_number: e.target.value })}
                placeholder="А123ВС96"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                Год
              </label>
              <input
                type="number"
                value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value })}
                placeholder="2020"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                VIN
              </label>
              <input
                value={form.vin}
                onChange={(e) => setForm({ ...form, vin: e.target.value })}
                placeholder="JTMBE..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
                Цвет
              </label>
              <input
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                placeholder="Белый"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
              Клиент
            </label>
            <CounterpartySubForm
              value={selectedCounterparty}
              onChange={setSelectedCounterparty}
              stoOnly
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase mb-1 block">
              Текущий одометр, км
            </label>
            <input
              type="number"
              value={form.odometer_last}
              onChange={(e) => setForm({ ...form, odometer_last: e.target.value })}
              placeholder="150000"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="border-t border-slate-100 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-slate-300 text-slate-700 font-semibold py-2.5 rounded-xl text-sm"
          >
            Отмена
          </button>
          <button
            disabled={!form.brand || !form.reg_number || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="flex-1 bg-slate-900 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-40"
          >
            {createMutation.isPending ? '...' : 'Добавить автомобиль'}
          </button>
        </div>
      </div>
    </div>
  );
}
