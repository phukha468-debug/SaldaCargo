'use client';

import { cn } from '@saldacargo/ui';

export interface QuickViewWork {
  id: string;
  status: string;
  salary_paid?: boolean;
  quantity?: number;
  norm_minutes?: number;
  actual_minutes?: number;
  price_client?: string;
  work_description?: string;
  custom_work_name?: string;
  mechanic_id?: string | null;
  second_mechanic_id?: string | null;
  mechanic?: {
    id: string;
    name: string;
    roles?: string[];
    mechanic_salary_pct?: number;
  } | null;
  second_mechanic?: {
    id: string;
    name: string;
    roles?: string[];
    mechanic_salary_pct?: number;
  } | null;
  work_catalog?: { id: string; name: string; norm_minutes?: number } | null;
}

export interface QuickViewPart {
  id: string;
  quantity: number;
  custom_part_name?: string;
  unit?: string;
  unit_price?: string;
  client_price?: string;
  part?: { id: string; name: string; unit?: string } | null;
}

export interface QuickViewExecutor {
  id?: string;
  name: string;
  roles?: string[];
  mechanic_salary_pct?: number;
}

export interface QuickViewTx {
  id: string;
  amount: string;
  description?: string;
  related_user?: { name: string; roles?: string[] } | null;
}

const SPECIALTY_MAP: Record<string, { label: string; cls: string; icon: string }> = {
  welder: {
    label: 'Сварщик',
    cls: 'bg-orange-50 text-orange-800 border-orange-200',
    icon: 'local_fire_department',
  },
  electrician: {
    label: 'Электрик',
    cls: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: 'bolt',
  },
  painter: {
    label: 'Маляр',
    cls: 'bg-purple-50 text-purple-800 border-purple-200',
    icon: 'format_paint',
  },
  mechanic_lead: {
    label: 'Старший механик',
    cls: 'bg-blue-50 text-blue-800 border-blue-200',
    icon: 'engineering',
  },
  mechanic: {
    label: 'Механик',
    cls: 'bg-sky-50 text-sky-800 border-sky-200',
    icon: 'build',
  },
  handyman: {
    label: 'Разнорабочий',
    cls: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: 'handyman',
  },
  driver: {
    label: 'Водитель',
    cls: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    icon: 'drive_eta',
  },
  loader: {
    label: 'Грузчик',
    cls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    icon: 'inventory',
  },
};

export function getMechanicSpecialty(roles?: string[] | null) {
  if (!roles || roles.length === 0) {
    return {
      label: 'Мастер',
      cls: 'bg-slate-100 text-slate-700 border-slate-200',
      icon: 'person',
    };
  }
  const priority = [
    'welder',
    'electrician',
    'painter',
    'mechanic_lead',
    'mechanic',
    'handyman',
    'driver',
    'loader',
  ];
  for (const p of priority) {
    if (roles.includes(p) && SPECIALTY_MAP[p]) {
      return SPECIALTY_MAP[p];
    }
  }
  return {
    label: roles[0] || 'Мастер',
    cls: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: 'person',
  };
}

export function ServiceOrderWorksAndParts({
  works,
  parts,
  executors,
  orderExecutors,
  totalWorksClient,
  totalPartsClient,
}: {
  works: QuickViewWork[];
  parts: QuickViewPart[];
  executors?: QuickViewExecutor[];
  orderExecutors: QuickViewExecutor[];
  totalWorksClient: number;
  totalPartsClient: number;
}) {
  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-emerald-600">
              construction
            </span>
            Выполненные работы ({works.length})
          </span>
          <span className="text-xs font-black text-slate-900">
            Сумма работ: {totalWorksClient.toLocaleString('ru-RU')} ₽
          </span>
        </div>

        {works.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 font-medium">
            Работы не указаны
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {works.map((w, idx) => {
              const workName =
                w.custom_work_name ||
                w.work_catalog?.name ||
                w.work_description ||
                `Работа #${idx + 1}`;
              const priceClient = parseFloat(w.price_client || '0') * (w.quantity || 1);
              const normMin = w.norm_minutes || w.work_catalog?.norm_minutes;
              const actMin = w.actual_minutes;

              const performers = [
                w.mechanic ||
                  (w.mechanic_id ? executors?.find((e) => e.id === w.mechanic_id) : null),
                w.second_mechanic ||
                  (w.second_mechanic_id
                    ? executors?.find((e) => e.id === w.second_mechanic_id)
                    : null),
              ].filter(Boolean) as QuickViewExecutor[];

              const effectivePerformers =
                performers.length > 0
                  ? performers
                  : orderExecutors.length === 1
                    ? orderExecutors
                    : [];

              return (
                <div
                  key={w.id}
                  className="p-3.5 hover:bg-slate-50/80 transition-colors flex items-start justify-between gap-3"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-slate-900">
                        {idx + 1}. {workName}
                      </span>
                      {(w.quantity || 1) > 1 && (
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          × {w.quantity}
                        </span>
                      )}
                      {w.salary_paid ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                          ✓ Выплачено
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                          ⏳ Начислено
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Исполнитель:
                      </span>
                      {effectivePerformers.length > 0 ? (
                        effectivePerformers.map((m, mIdx) => {
                          const spec = getMechanicSpecialty(m.roles);
                          return (
                            <span
                              key={m.id || mIdx}
                              className={cn(
                                'inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border shadow-2xs',
                                spec.cls,
                              )}
                              title={`Мастер: ${m.name} (${spec.label})`}
                            >
                              <span className="material-symbols-outlined text-[13px]">
                                {spec.icon}
                              </span>
                              <span className="font-extrabold text-slate-900">{m.name}</span>
                              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-white/80 border border-slate-300/60">
                                {spec.label}
                              </span>
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">
                          Мастер не назначен персонально
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium flex-wrap">
                      {normMin && (
                        <span>
                          Норма: <b>{normMin} мин</b>
                        </span>
                      )}
                      {actMin && (
                        <span>
                          Факт: <b>{actMin} мин</b>
                        </span>
                      )}
                      {w.work_description && w.work_description !== workName && (
                        <span className="text-slate-400">({w.work_description})</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-sm font-black text-slate-900">
                      {priceClient.toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {parts.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-blue-600">
                inventory_2
              </span>
              Установленные запчасти и материалы ({parts.length})
            </span>
            <span className="text-xs font-black text-slate-900">
              Сумма запчастей: {totalPartsClient.toLocaleString('ru-RU')} ₽
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {parts.map((p, idx) => {
              const partName = p.custom_part_name || p.part?.name || `Запчасть #${idx + 1}`;
              const price = parseFloat(p.client_price || p.unit_price || '0') * (p.quantity || 1);

              return (
                <div
                  key={p.id}
                  className="p-3.5 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3"
                >
                  <div>
                    <span className="text-xs font-bold text-slate-900">
                      {idx + 1}. {partName}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium ml-2">
                      ({p.quantity} {p.unit || p.part?.unit || 'шт'})
                    </span>
                  </div>
                  <span className="text-xs font-black text-slate-900">
                    {price.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
