'use client';

import { cn } from '@saldacargo/ui';
import { STATUS_COLOR, STATUS_LABEL } from '../constants';
import type { VehicleOrder, VehicleRec, VehicleRule } from '../types';
import { ruleAlert } from '../utils';
import { AddRecForm, AddRuleForm } from './VehicleFormsModals';

export function VehicleCardTabs({
  tab,
  orders,
  rules,
  recommendations,
  odometerLast,
  showAddRule,
  setShowAddRule,
  showAddRec,
  setShowAddRec,
  addRulePending,
  addRecPending,
  onAddRule,
  onPatchRule,
  onAddRec,
  onPatchRec,
}: {
  tab: 'history' | 'rules' | 'recs';
  orders: VehicleOrder[];
  rules: VehicleRule[];
  recommendations: VehicleRec[];
  odometerLast: number | null;
  showAddRule: boolean;
  setShowAddRule: (v: boolean) => void;
  showAddRec: string;
  setShowAddRec: (v: string) => void;
  addRulePending: boolean;
  addRecPending: boolean;
  onAddRule: (body: Record<string, unknown>) => void;
  onPatchRule: (ruleId: string, body: Record<string, unknown>) => void;
  onAddRec: (body: Record<string, unknown>) => void;
  onPatchRec: (recId: string, body: Record<string, unknown>) => void;
}) {
  if (tab === 'history') {
    return (
      <div className="space-y-3">
        {orders.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">Нарядов по этой машине нет</div>
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
    );
  }

  if (tab === 'rules') {
    return (
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
            onSubmit={onAddRule}
            onCancel={() => setShowAddRule(false)}
            isPending={addRulePending}
          />
        )}
        {rules.length === 0 && !showAddRule ? (
          <div className="text-center py-8 text-slate-400 text-sm">Регламенты не настроены</div>
        ) : (
          rules.map((rule) => {
            const st = ruleAlert(rule, odometerLast);
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
                  {rule.interval_km && rule.last_done_km && odometerLast && (
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
                      Следующий: {(rule.last_done_km + rule.interval_km).toLocaleString('ru-RU')} км
                      (осталось{' '}
                      {(rule.last_done_km + rule.interval_km - odometerLast).toLocaleString(
                        'ru-RU',
                      )}{' '}
                      км)
                    </div>
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
                      const km = prompt('Одометр при последней замене (км):');
                      const date = prompt('Дата последней замены (ГГГГ-ММ-ДД):');
                      if (km) {
                        onPatchRule(rule.id, { last_done_km: km, last_done_at: date || null });
                      }
                    }}
                    className="text-xs px-3 py-1 border border-slate-300 rounded-lg hover:bg-slate-50 font-semibold"
                  >
                    Обновить данные
                  </button>
                  <button
                    onClick={() => onPatchRule(rule.id, { is_active: false })}
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
    );
  }

  return (
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
            onAddRec({ text, due_km: dueKm || null, due_date: dueDate || null })
          }
          onCancel={() => setShowAddRec('')}
          isPending={addRecPending}
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
                  onClick={() => onPatchRec(rec.id, { is_done: !rec.is_done })}
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
  );
}
