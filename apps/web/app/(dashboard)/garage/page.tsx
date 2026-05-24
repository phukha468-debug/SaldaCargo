'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
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
  work_catalog: { id: string; name: string; norm_minutes: number } | null;
  time_logs: Array<{ id: string; started_at: string; stopped_at: string | null; status: string }>;
};

type OrderDetail = Omit<OrderRow, 'works'> & {
  lifecycle_status: string;
  admin_note: string | null;
  mechanic_note: string | null;
  mechanic_pay: string | null;
  second_mechanic_pay: string | null;
  second_mechanic: Mechanic | null;
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

type RepairRequest = {
  id: string;
  status: string;
  custom_description: string | null;
  admin_note: string | null;
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
  const [editNote, setEditNote] = useState<string | null>(null);
  const [editMechanic, setEditMechanic] = useState<string | null>(null);
  const [editSecondMechanic, setEditSecondMechanic] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [editPriority, setEditPriority] = useState<string | null>(null);
  const [showAddWork, setShowAddWork] = useState(false);
  const [workSearch, setWorkSearch] = useState('');
  const [workCatFilter, setWorkCatFilter] = useState<string | null>(null);
  const [confirmDeleteWorkId, setConfirmDeleteWorkId] = useState<string | null>(null);
  const [addWorkError, setAddWorkError] = useState<string | null>(null);
  const [addWorkQty, setAddWorkQty] = useState(1);
  const [editingWorkId, setEditingWorkId] = useState<string | null>(null);
  const [editWorkDesc, setEditWorkDesc] = useState('');
  const [editWorkQty, setEditWorkQty] = useState(1);
  const [editWorkPrice, setEditWorkPrice] = useState('');

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
    mutationFn: ({ work_catalog_id, quantity }: { work_catalog_id: string; quantity: number }) =>
      fetch(`/api/garage/orders/${orderId}/works`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ work_catalog_id, quantity }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Ошибка');
        return d;
      }),
    onSuccess: () => {
      setAddWorkError(null);
      setWorkSearch('');
      setAddWorkQty(1);
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
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl max-h-[92vh] flex flex-col"
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
                <p className="text-xs text-slate-500 mb-1 font-semibold uppercase">Механик 1</p>
                <select
                  value={editMechanic ?? order.mechanic?.id ?? ''}
                  onChange={(e) => setEditMechanic(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">— Не назначен —</option>
                  {mechanics.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                {editMechanic !== null && editMechanic !== (order.mechanic?.id ?? '') && (
                  <button
                    onClick={() =>
                      patchMutation.mutate({ assigned_mechanic_id: editMechanic || null })
                    }
                    disabled={patchMutation.isPending}
                    className="mt-1 text-xs text-blue-600 font-semibold hover:underline"
                  >
                    Сохранить
                  </button>
                )}
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-1 font-semibold uppercase">Механик 2</p>
                <select
                  value={editSecondMechanic ?? order.second_mechanic?.id ?? ''}
                  onChange={(e) => setEditSecondMechanic(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">— Не назначен —</option>
                  {mechanics.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                {editSecondMechanic !== null &&
                  editSecondMechanic !== (order.second_mechanic?.id ?? '') && (
                    <button
                      onClick={() =>
                        patchMutation.mutate({ second_mechanic_id: editSecondMechanic || null })
                      }
                      disabled={patchMutation.isPending}
                      className="mt-1 text-xs text-blue-600 font-semibold hover:underline"
                    >
                      Сохранить
                    </button>
                  )}
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
                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex gap-2 items-center">
                      <input
                        autoFocus
                        type="text"
                        value={workSearch}
                        onChange={(e) => {
                          setWorkSearch(e.target.value);
                          setAddWorkError(null);
                        }}
                        placeholder="Поиск по названию..."
                        className="flex-1 text-sm bg-transparent outline-none placeholder-slate-400"
                      />
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
                      {addWorkMutation.isPending && (
                        <span className="text-xs text-slate-400 shrink-0">Добавляем...</span>
                      )}
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
                    <div className="max-h-60 overflow-y-auto">
                      {!workSearch.trim() && !workCatFilter ? (
                        <p className="text-xs text-slate-400 px-3 py-4 italic text-center">
                          Выберите категорию или введите название для поиска
                        </p>
                      ) : filteredCatalog.length === 0 ? (
                        <p className="text-xs text-slate-400 px-3 py-3 italic">Ничего не найдено</p>
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
                                </div>
                              );
                            })()}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {order.parts.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-2 font-semibold uppercase">
                    Запчасти ({order.parts.length})
                  </p>
                  <div className="space-y-1">
                    {order.parts.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2"
                      >
                        <span className="text-sm text-slate-800">
                          {p.part?.name ?? p.custom_part_name ?? '—'}
                        </span>
                        <span className="text-sm font-semibold text-slate-700">
                          {p.quantity} {p.part?.unit ?? p.unit ?? 'шт'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                    patchMutation.mutate({ lifecycle_status: 'approved' });
                    onClose();
                  }}
                  disabled={patchMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl text-sm disabled:opacity-50 shrink-0"
                >
                  {patchMutation.isPending ? '...' : 'Завершить наряд →'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateOrderModal({
  onClose,
  mechanics,
  assets,
}: {
  onClose: () => void;
  mechanics: Mechanic[];
  assets: Asset[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const createMutation = useMutation({
    mutationFn: async (body: typeof emptyForm) => {
      const r = await fetch('/api/garage/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
          ) : (
            <div className="space-y-3">
              {(
                [
                  {
                    field: 'client_vehicle_brand' as const,
                    label: 'Марка *',
                    placeholder: 'Toyota',
                  },
                  { field: 'client_vehicle_model' as const, label: 'Модель', placeholder: 'Camry' },
                  {
                    field: 'client_vehicle_reg' as const,
                    label: 'Госномер',
                    placeholder: 'А001АА96',
                  },
                  {
                    field: 'client_name' as const,
                    label: 'Имя клиента',
                    placeholder: 'Иван Иванов',
                  },
                  {
                    field: 'client_phone' as const,
                    label: 'Телефон',
                    placeholder: '+7 900 000-00-00',
                  },
                ] as const
              ).map(({ field, label, placeholder }) => (
                <div key={field}>
                  <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">
                    {label}
                  </label>
                  <input
                    value={form[field]}
                    onChange={(e) => set(field, e.target.value)}
                    placeholder={placeholder}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              ))}
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
                Механик
              </label>
              <select
                value={form.assigned_mechanic_id}
                onChange={(e) => set('assigned_mechanic_id', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
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
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending}
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
    const d = new Date(y, mn - 1 + delta, 1);
    onChange(d.toISOString().slice(0, 7));
  };
  const label = new Date(y, mn - 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => shift(-1)} className="p-1.5 rounded-lg hover:bg-slate-100">
        <span className="material-symbols-outlined text-slate-500 text-[18px]">chevron_left</span>
      </button>
      <span className="text-sm font-semibold text-slate-700 capitalize min-w-[120px] text-center">
        {label}
      </span>
      <button onClick={() => shift(1)} className="p-1.5 rounded-lg hover:bg-slate-100">
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
  mechanics,
  onCreated,
}: {
  onClose: () => void;
  mechanics: Mechanic[];
  onCreated: (id: string) => void;
}) {
  const [tab, setTab] = useState<'prompt' | 'import'>('prompt');
  const [prompt, setPrompt] = useState<string | null>(null);
  const [promptLoading, setPromptLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState('');
  const [parsed, setParsed] = useState<AiParsed | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [selectedMechanic, setSelectedMechanic] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Загружаем промпт при открытии вкладки
  async function loadPrompt() {
    if (prompt) return;
    setPromptLoading(true);
    try {
      const r = await fetch('/api/garage/ai-prompt');
      const d = await r.json();
      setPrompt(d.prompt ?? '');
    } finally {
      setPromptLoading(false);
    }
  }

  function handleTabChange(t: 'prompt' | 'import') {
    setTab(t);
    if (t === 'prompt') loadPrompt();
  }

  async function copyPrompt() {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleRecognize() {
    setParseError(null);
    const result = parseAiResponse(pasted);
    if (!result) {
      setParseError(
        'Не удалось найти JSON с данными наряда. Убедитесь, что скопировали весь ответ ИИ целиком — включая JSON-блок в конце с полями "order", "works", "parts".',
      );
      return;
    }
    setParsed(result);
  }

  async function handleCreate() {
    if (!parsed) return;
    setCreating(true);
    setCreateError(null);
    try {
      const r = await fetch('/api/garage/orders/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order: {
            ...parsed.order,
            assigned_mechanic_id: selectedMechanic || undefined,
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Создать наряд через ИИ</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Скопируйте промпт → вставьте в ChatGPT/Claude → вставьте ответ сюда
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl">
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 flex gap-1 px-6 pt-3">
          {(
            [
              { key: 'prompt', label: '1. Промпт для ИИ' },
              { key: 'import', label: '2. Вставить ответ' },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              className={cn(
                'text-sm font-semibold px-4 py-2 rounded-t-lg border-b-2 transition-colors',
                tab === t.key
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-600',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
          {/* Tab 1: Промпт */}
          {tab === 'prompt' && (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                <p className="font-semibold mb-1">Как использовать:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>
                    Нажмите «Скопировать промпт» и вставьте его в ChatGPT как «System Instructions»
                    или в Claude как «Project Instructions»
                  </li>
                  <li>В следующем сообщении опишите автомобиль и проблему</li>
                  <li>Скопируйте весь ответ ИИ целиком и перейдите на вкладку «Вставить ответ»</li>
                </ol>
              </div>
              <button
                onClick={copyPrompt}
                disabled={promptLoading || !prompt}
                className={cn(
                  'w-full font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2',
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-900 hover:bg-slate-700 text-white disabled:opacity-50',
                )}
              >
                {promptLoading ? (
                  'Загрузка...'
                ) : copied ? (
                  '✓ Скопировано!'
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    Скопировать промпт
                  </>
                )}
              </button>
              {prompt && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-medium">
                    Содержимое промпта (для справки)
                  </div>
                  <pre className="text-xs text-slate-600 p-3 overflow-x-auto whitespace-pre-wrap max-h-64 font-mono leading-relaxed">
                    {prompt}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Вставить ответ */}
          {tab === 'import' && (
            <div className="space-y-4">
              {!parsed ? (
                <>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase block mb-1.5">
                      Вставьте полный ответ от ИИ
                    </label>
                    <textarea
                      rows={10}
                      value={pasted}
                      onChange={(e) => {
                        setPasted(e.target.value);
                        setParseError(null);
                      }}
                      placeholder="Скопируйте и вставьте сюда весь ответ от ChatGPT или Claude, включая смету и JSON-блок..."
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                  {parseError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                      {parseError}
                    </div>
                  )}
                  <button
                    onClick={handleRecognize}
                    disabled={!pasted.trim()}
                    className="w-full bg-slate-900 hover:bg-slate-700 text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-40"
                  >
                    Распознать наряд →
                  </button>
                </>
              ) : (
                <div className="space-y-5">
                  {/* Авто и клиент */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-1">
                    <p className="text-xs font-semibold text-blue-700 uppercase mb-2">
                      Автомобиль и клиент
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <div className="text-slate-500">Марка/модель</div>
                      <div className="font-medium text-slate-800">
                        {[parsed.order.client_vehicle_brand, parsed.order.client_vehicle_model]
                          .filter(Boolean)
                          .join(' ') || '—'}
                      </div>
                      <div className="text-slate-500">Госномер</div>
                      <div className="font-medium text-slate-800">
                        {parsed.order.client_vehicle_reg || '—'}
                      </div>
                      {parsed.order.client_name && (
                        <>
                          <div className="text-slate-500">Клиент</div>
                          <div className="font-medium text-slate-800">
                            {parsed.order.client_name}
                          </div>
                        </>
                      )}
                      <div className="text-slate-500">Приоритет</div>
                      <div className="font-medium text-slate-800">
                        {PRIORITY_LABEL[parsed.order.priority ?? 'normal'] ?? parsed.order.priority}
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-blue-200">
                      <p className="text-xs text-slate-500 mb-0.5">Описание проблемы</p>
                      <p className="text-sm text-slate-800">{parsed.order.problem_description}</p>
                    </div>
                  </div>

                  {/* Работы */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase mb-2">
                      Работы ({parsed.works.length})
                    </p>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                            <th className="text-left px-3 py-2">Работа</th>
                            <th className="text-right px-3 py-2 w-16">Нч</th>
                            <th className="text-right px-3 py-2 w-24">Стоимость</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsed.works.map((w, i) => (
                            <tr key={i} className="border-b border-slate-100 last:border-0">
                              <td className="px-3 py-2">
                                <p className="font-medium text-slate-800">{w.custom_work_name}</p>
                                {w.work_description && (
                                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                                    {w.work_description}
                                  </p>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right text-slate-500 tabular-nums">
                                {(w.norm_minutes / 60).toFixed(1)}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-slate-800 tabular-nums">
                                {parseFloat(w.price_client).toLocaleString('ru-RU')} ₽
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50">
                            <td
                              colSpan={2}
                              className="px-3 py-2 text-xs text-slate-500 font-semibold"
                            >
                              Итого работы
                            </td>
                            <td className="px-3 py-2 text-right font-black text-slate-800 tabular-nums">
                              {worksTotal.toLocaleString('ru-RU')} ₽
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Запчасти */}
                  {parsed.parts && parsed.parts.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-2">
                        Запчасти ({parsed.parts.length})
                      </p>
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                              <th className="text-left px-3 py-2">Наименование</th>
                              <th className="text-right px-3 py-2 w-16">Кол-во</th>
                              <th className="text-right px-3 py-2 w-24">Сумма</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parsed.parts.map((p, i) => (
                              <tr key={i} className="border-b border-slate-100 last:border-0">
                                <td className="px-3 py-2 font-medium text-slate-800">{p.name}</td>
                                <td className="px-3 py-2 text-right text-slate-500 tabular-nums">
                                  {p.quantity} {p.unit || 'шт'}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-slate-800 tabular-nums">
                                  {(parseFloat(p.unit_price) * p.quantity).toLocaleString('ru-RU')}{' '}
                                  ₽
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-50">
                              <td
                                colSpan={2}
                                className="px-3 py-2 text-xs text-slate-500 font-semibold"
                              >
                                Итого запчасти
                              </td>
                              <td className="px-3 py-2 text-right font-black text-slate-800 tabular-nums">
                                {partsTotal.toLocaleString('ru-RU')} ₽
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Итого */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-emerald-700 font-semibold uppercase">
                        Итого к оплате
                      </p>
                      {parsed.recommendations && parsed.recommendations.length > 0 && (
                        <p className="text-xs text-slate-500 mt-1">
                          {parsed.recommendations.length} рекомендаций от ИИ
                        </p>
                      )}
                    </div>
                    <p className="text-2xl font-black text-emerald-800">
                      {(worksTotal + partsTotal).toLocaleString('ru-RU')} ₽
                    </p>
                  </div>

                  {/* Назначить механика */}
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase block mb-1.5">
                      Назначить механика
                    </label>
                    <select
                      value={selectedMechanic}
                      onChange={(e) => setSelectedMechanic(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm"
                    >
                      <option value="">— Назначить позже —</option>
                      {mechanics.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {createError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                      {createError}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setParsed(null);
                        setParseError(null);
                      }}
                      className="flex-1 border border-slate-200 text-slate-600 font-semibold py-2.5 rounded-xl text-sm hover:bg-slate-50"
                    >
                      ← Изменить ответ
                    </button>
                    <button
                      onClick={handleCreate}
                      disabled={creating}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50"
                    >
                      {creating ? 'Создаём...' : 'Создать наряд →'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════ WORK ORDERS ═════════════════════════════════════

type WOTab = 'all' | 'active' | 'pending' | 'approved';

function WorkOrdersSection() {
  const [woTab, setWoTab] = useState<WOTab>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showAiImport, setShowAiImport] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [historyDate, setHistoryDate] = useState(todayStr());
  const qc = useQueryClient();

  const { data: allOrders = [] } = useQuery<TabOrder[]>({
    queryKey: ['garage-orders', 'all'],
    queryFn: () =>
      fetch('/api/garage/orders?filter=all')
        .then((r) => r.json())
        .then((d) => (Array.isArray(d) ? d : [])),
    staleTime: 120000,
  });
  const { data: activeOrders = [] } = useQuery<TabOrder[]>({
    queryKey: ['garage-orders', 'active'],
    queryFn: () =>
      fetch('/api/garage/orders?filter=active')
        .then((r) => r.json())
        .then((d) => (Array.isArray(d) ? d : [])),
    staleTime: 120000,
  });
  const { data: pendingOrders = [] } = useQuery<TabOrder[]>({
    queryKey: ['garage-orders', 'review'],
    queryFn: () =>
      fetch('/api/garage/orders?filter=review')
        .then((r) => r.json())
        .then((d) => (Array.isArray(d) ? d : [])),
    staleTime: 120000,
  });
  const { data: historyOrders = [], isLoading: histLoading } = useQuery<TabOrder[]>({
    queryKey: ['garage-orders', 'history', historyDate],
    queryFn: () =>
      fetch(`/api/garage/orders?filter=history&date=${historyDate}`)
        .then((r) => r.json())
        .then((d) => (Array.isArray(d) ? d : [])),
    staleTime: 120000,
    enabled: woTab === 'approved',
  });

  const { data: mechanics = [] } = useQuery<Mechanic[]>({
    queryKey: ['mechanics-list'],
    queryFn: () => fetch('/api/users?role=mechanic').then((r) => r.json()),
    staleTime: 300000,
  });
  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ['assets-select'],
    queryFn: async () => {
      const json = await fetch('/api/fleet').then((r) => r.json());
      return Array.isArray(json?.assets) ? json.assets : [];
    },
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

  const getOrders = (): TabOrder[] => {
    if (woTab === 'all')
      return allOrders.filter(
        (o) => o.lifecycle_status !== 'cancelled' && o.lifecycle_status !== 'returned',
      );
    if (woTab === 'active') return activeOrders;
    if (woTab === 'pending') return pendingOrders;
    return historyOrders;
  };

  const orders = getOrders();
  const counts = {
    all: allOrders.length,
    active: activeOrders.length,
    pending: pendingOrders.length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Заказ-наряды</h1>
          <p className="text-sm text-slate-400 mt-0.5">Все наряды на ремонт и обслуживание</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAiImport(true)}
            className="bg-violet-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-violet-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            Создать через ИИ
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-slate-700 flex items-center gap-2"
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

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[
          { key: 'all' as WOTab, label: 'Все', count: counts.all },
          { key: 'active' as WOTab, label: 'Активные', count: counts.active },
          { key: 'pending' as WOTab, label: 'На проверке', count: counts.pending },
          { key: 'approved' as WOTab, label: 'Архив' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setWoTab(t.key)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
              woTab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
            )}
          >
            {t.label}
            {(t.count ?? 0) > 0 && <span className="ml-1 text-slate-400">({t.count})</span>}
          </button>
        ))}
      </div>

      {woTab === 'approved' && <DateNav date={historyDate} onChange={setHistoryDate} />}

      {histLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center">
          <p className="text-5xl mb-3">🔧</p>
          <p className="font-medium text-slate-500">Нарядов нет</p>
        </div>
      ) : woTab === 'active' ? (
        // ── Grouped by vehicle ─────────────────────────────────────────────────
        (() => {
          type VehicleGroup = {
            key: string;
            label: string;
            sublabel: string;
            orders: TabOrder[];
          };
          const groupMap = new Map<string, VehicleGroup>();
          for (const o of orders) {
            const key = o.asset?.id ?? `client:${o.client_vehicle_reg ?? o.id}`;
            if (!groupMap.has(key)) {
              const label =
                o.machine_type === 'own'
                  ? (o.asset?.short_name ?? 'Свой ТС')
                  : `${o.client_vehicle_brand ?? ''} ${o.client_vehicle_model ?? ''}`.trim() ||
                    'Клиентский ТС';
              const sublabel =
                o.machine_type === 'own'
                  ? (o.asset?.reg_number ?? '')
                  : (o.client_vehicle_reg ?? o.client_name ?? '');
              groupMap.set(key, { key, label, sublabel, orders: [] });
            }
            groupMap.get(key)!.orders.push(o);
          }
          const groups = Array.from(groupMap.values());
          return (
            <div className="space-y-4">
              {groups.map((g) => (
                <div
                  key={g.key}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
                >
                  {/* Vehicle header */}
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                      <svg
                        className="w-4 h-4 text-slate-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{g.label}</p>
                      {g.sublabel && <p className="text-xs text-slate-500">{g.sublabel}</p>}
                    </div>
                    <span className="ml-auto text-xs font-semibold text-slate-400">
                      {g.orders.length} {g.orders.length === 1 ? 'наряд' : 'нарядов'}
                    </span>
                  </div>
                  {/* Orders list */}
                  <div className="divide-y divide-slate-100">
                    {g.orders.map((o) => {
                      const works = o.works ?? [];
                      const normH = works.reduce((s, w) => s + (w.norm_minutes ?? 0), 0) / 60;
                      const factH = works.reduce((s, w) => s + (w.actual_minutes ?? 0), 0) / 60;
                      const cost = works.reduce((s, w) => s + moneyVal(w.price_client), 0);
                      const noWorks = works.length === 0;
                      return (
                        <div
                          key={o.id}
                          onClick={() => setSelectedOrderId(o.id)}
                          className="px-4 py-3 hover:bg-slate-50/70 cursor-pointer flex items-start gap-3"
                        >
                          <div className="shrink-0 pt-0.5">
                            <span className="font-mono text-xs font-bold text-slate-500">
                              НЗ-{o.order_number}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            {noWorks ? (
                              <p className="text-xs italic text-amber-600 font-medium">
                                ⚠ Виды работ не указаны — нажмите для добавления
                              </p>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {works.map((w) => {
                                  const wname = w.work_catalog?.name ?? w.custom_work_name ?? '—';
                                  return (
                                    <span
                                      key={w.id}
                                      className={cn(
                                        'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium',
                                        w.status === 'completed'
                                          ? 'bg-emerald-100 text-emerald-700'
                                          : w.status === 'in_progress' || w.status === 'paused'
                                            ? 'bg-amber-100 text-amber-700'
                                            : 'bg-slate-100 text-slate-600',
                                      )}
                                    >
                                      {wname}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                            {o.mechanic?.name && (
                              <p className="text-xs text-slate-400 mt-1">
                                {o.mechanic.name}
                                {normH > 0 && (
                                  <span className="ml-2 font-mono">
                                    {normH.toFixed(1)}нч
                                    {factH > 0 && ` / факт ${factH.toFixed(1)}`}
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0 flex flex-col items-end gap-1">
                            <span
                              className={cn(
                                'text-xs px-2 py-0.5 rounded-full font-semibold',
                                STATUS_COLOR[o.status],
                              )}
                            >
                              {STATUS_LABEL[o.status] ?? o.status}
                            </span>
                            {cost > 0 && (
                              <span className="text-xs font-bold text-slate-700">
                                {cost.toLocaleString('ru-RU')} ₽
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          );
        })()
      ) : (
        // ── Flat table (all / pending / approved) ──────────────────────────────
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Номер
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Автомобиль
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Работы
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Механик(и)
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Нч план / факт
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Стоимость
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Статус
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => {
                const normSum = (o.works ?? []).reduce((s, w) => s + (w.norm_minutes ?? 0), 0) / 60;
                const factSum =
                  (o.works ?? []).reduce((s, w) => s + (w.actual_minutes ?? 0), 0) / 60;
                const cost = (o.works ?? []).reduce((s, w) => s + moneyVal(w.price_client), 0);
                return (
                  <tr
                    key={o.id}
                    className="hover:bg-slate-50/60 cursor-pointer"
                    onClick={() => setSelectedOrderId(o.id)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 font-semibold">
                      НЗ-{o.order_number}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{o.asset?.short_name ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {(o.works ?? [])
                        .map((w) => w.work_catalog?.name ?? w.custom_work_name ?? '—')
                        .join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700 text-xs">
                      {o.mechanic?.name ?? (
                        <span className="italic text-slate-400">Не назначен</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {normSum > 0
                        ? `${normSum.toFixed(1)} / ${factSum > 0 ? factSum.toFixed(1) : '—'}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900 text-xs">
                      {cost > 0 ? `${cost.toLocaleString('ru-RU')} ₽` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'badge text-xs px-2 py-0.5 rounded-full',
                          o.lifecycle_status === 'approved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : o.lifecycle_status === 'returned'
                              ? 'bg-red-100 text-red-700'
                              : STATUS_COLOR[o.status],
                        )}
                      >
                        {o.lifecycle_status === 'approved'
                          ? 'Закрыт'
                          : o.lifecycle_status === 'returned'
                            ? 'Возвращён'
                            : STATUS_LABEL[o.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-1 justify-end">
                        {woTab === 'approved' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              patch.mutate({ id: o.id, body: { lifecycle_status: 'draft' } });
                            }}
                            className="text-xs font-medium px-2 py-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
                          >
                            Открыть заново
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrderId(o.id);
                          }}
                          className="text-xs font-medium px-2 py-1 rounded bg-white border border-slate-200 text-slate-600"
                        >
                          Детали
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateOrderModal
          onClose={() => setShowCreate(false)}
          mechanics={mechanics}
          assets={assets}
        />
      )}
      {showAiImport && (
        <AiImportModal
          onClose={() => setShowAiImport(false)}
          mechanics={mechanics}
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
    queryFn: async () => {
      const json = await fetch('/api/fleet').then((r) => r.json());
      return Array.isArray(json?.assets) ? json.assets : [];
    },
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
    queryFn: async () => {
      const json = await fetch('/api/fleet').then((r) => r.json());
      return Array.isArray(json?.assets) ? json.assets : [];
    },
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

  const { data: mechanics = [] } = useQuery<Mechanic[]>({
    queryKey: ['mechanics-list'],
    queryFn: () => fetch('/api/users?role=mechanic').then((r) => r.json()),
    staleTime: 300000,
  });
  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ['assets-select'],
    queryFn: async () => {
      const json = await fetch('/api/fleet').then((r) => r.json());
      return Array.isArray(json?.assets) ? json.assets : [];
    },
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
        {section === 'settings' && <SettingsSection />}
      </main>
      {showCreate && (
        <CreateOrderModal
          onClose={() => setShowCreate(false)}
          mechanics={mechanics}
          assets={assets}
        />
      )}
    </div>
  );
}
