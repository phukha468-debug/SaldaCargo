'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Money } from '@saldacargo/ui';
import { cn } from '@saldacargo/ui';

// ─── Types ───────────────────────────────────────────────────────────────────

type AssetType = { id: string; code: string; name: string; capacity_m: number; has_gps: boolean };
type Driver = { id: string; name: string };

type Analytics = {
  revenue: string;
  expenses: string;
  maintenance: string;
  fixed_cost: string;
  total_costs: string;
  profit: string;
  true_profit: string;
  km: number;
  trip_count: number;
  order_count: number;
  avg_order_value: string | null;
  avg_km_per_trip: number | null;
  cost_per_km: string | null;
  true_cost_per_km: string | null;
  margin_pct: number | null;
};

type Asset = {
  id: string;
  short_name: string;
  reg_number: string;
  year: number | null;
  status: 'active' | 'repair' | 'reserve' | 'sold' | 'written_off';
  odometer_current: number;
  current_book_value: string | null;
  remaining_depreciation_months: number | null;
  monthly_fixed_cost: string;
  needs_update: boolean;
  notes: string | null;
  asset_type: AssetType | null;
  driver: Driver | null;
  analytics: Analytics;
};

type FleetResponse = {
  assets: Asset[];
  summary: { total: number; active: number; repair: number; reserve: number; needsUpdate: number };
  assetTypes: AssetType[];
};

// ─── Constants ───────────────────────────────────────────────────────────────

const TRUCKS_CODES = ['valdai_6m', 'valdai_5m', 'valdai_dump', 'canter'];
const GAZELLE_CODES = ['gazelle_4m', 'gazelle_3m', 'gazelle_project'];

const STATUS_LABEL: Record<string, string> = {
  active: 'Активна',
  repair: 'Ремонт',
  reserve: 'Резерв',
};
const STATUS_COLOR: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  repair: 'bg-amber-100 text-amber-700',
  reserve: 'bg-slate-100 text-slate-500',
};

const emptyForm = {
  short_name: '',
  reg_number: '',
  asset_type_id: '',
  year: '',
  status: 'active',
  odometer_current: '',
  assigned_driver_id: '',
  current_book_value: '',
  remaining_depreciation_months: '',
  monthly_fixed_cost: '',
  notes: '',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatRow({
  label,
  value,
  color = 'text-slate-900',
}: {
  label: string;
  value: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className={`text-[11px] font-bold ${color}`}>{value}</span>
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────

function AssetModal({
  editAsset,
  assetTypes,
  drivers,
  onClose,
  onSaved,
}: {
  editAsset: Asset | null;
  assetTypes: AssetType[];
  drivers: Driver[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(
    editAsset
      ? {
          short_name: editAsset.short_name,
          reg_number: editAsset.reg_number,
          asset_type_id: editAsset.asset_type?.id ?? '',
          year: editAsset.year?.toString() ?? '',
          status: editAsset.status,
          odometer_current: editAsset.odometer_current.toString(),
          assigned_driver_id: editAsset.driver?.id ?? '',
          current_book_value: editAsset.current_book_value ?? '',
          remaining_depreciation_months: editAsset.remaining_depreciation_months?.toString() ?? '',
          monthly_fixed_cost: editAsset.monthly_fixed_cost ?? '',
          notes: editAsset.notes ?? '',
        }
      : emptyForm,
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const f =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    if (!form.short_name.trim() || !form.reg_number.trim() || !form.asset_type_id) {
      setError('Название, госномер и тип — обязательны');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      short_name: form.short_name,
      reg_number: form.reg_number,
      asset_type_id: form.asset_type_id,
      year: form.year ? parseInt(form.year) : null,
      status: form.status,
      odometer_current: form.odometer_current ? parseInt(form.odometer_current) : 0,
      assigned_driver_id: form.assigned_driver_id || null,
      current_book_value: form.current_book_value
        ? parseFloat(form.current_book_value).toFixed(2)
        : '0.00',
      remaining_depreciation_months: form.remaining_depreciation_months
        ? parseInt(form.remaining_depreciation_months)
        : null,
      monthly_fixed_cost: form.monthly_fixed_cost
        ? parseFloat(form.monthly_fixed_cost).toFixed(2)
        : '0.00',
      notes: form.notes || null,
      needs_update: false,
    };

    const url = editAsset ? `/api/fleet/${editAsset.id}` : '/api/fleet';
    const method = editAsset ? 'PATCH' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? 'Ошибка');
      return;
    }
    onSaved();
  };

  const inputCls =
    'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">
            {editAsset ? 'Редактировать машину' : 'Добавить машину'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Название *</label>
              <input
                className={inputCls}
                placeholder="Валдай-1"
                value={form.short_name}
                onChange={f('short_name')}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Госномер *</label>
              <input
                className={inputCls}
                placeholder="А123ВС 196"
                value={form.reg_number}
                onChange={f('reg_number')}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Тип *</label>
            <select className={inputCls} value={form.asset_type_id} onChange={f('asset_type_id')}>
              <option value="">— выберите тип —</option>
              {assetTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Год выпуска</label>
              <input
                className={inputCls}
                placeholder="2019"
                type="number"
                value={form.year}
                onChange={f('year')}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Статус</label>
              <select className={inputCls} value={form.status} onChange={f('status')}>
                <option value="active">Активна</option>
                <option value="repair">В ремонте</option>
                <option value="reserve">Резерв</option>
                <option value="sold">Продана</option>
                <option value="written_off">Списана</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Одометр (км)</label>
              <input
                className={inputCls}
                placeholder="0"
                type="number"
                value={form.odometer_current}
                onChange={f('odometer_current')}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Водитель</label>
              <select
                className={inputCls}
                value={form.assigned_driver_id}
                onChange={f('assigned_driver_id')}
              >
                <option value="">— не назначен —</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">
                Балансовая стоимость (₽)
              </label>
              <input
                className={inputCls}
                placeholder="500000"
                type="number"
                value={form.current_book_value}
                onChange={f('current_book_value')}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">
                Мес. амортизации осталось
              </label>
              <input
                className={inputCls}
                placeholder="24"
                type="number"
                value={form.remaining_depreciation_months}
                onChange={f('remaining_depreciation_months')}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">
              Постоянные расходы в месяц (₽)
            </label>
            <input
              className={inputCls}
              placeholder="Страховка + налог + лизинг/кредит"
              type="number"
              value={form.monthly_fixed_cost}
              onChange={f('monthly_fixed_cost')}
            />
            <p className="text-[10px] text-slate-400 mt-0.5">
              ОСАГО + транспортный налог / 12 + платёж по лизингу
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Примечание</label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              placeholder="Любая доп. информация"
              value={form.notes}
              onChange={f('notes')}
            />
          </div>

          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="bg-slate-900 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button
            onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-700 px-5 py-2.5 rounded-xl border border-slate-200 transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Compact collapsible tile ─────────────────────────────────────────────────

function AssetTile({
  asset,
  onEdit,
  onChangeStatus,
  onDelete,
}: {
  asset: Asset;
  onEdit: () => void;
  onChangeStatus: (status: string) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const a = asset.analytics;
  const trueProfit = parseFloat(a.true_profit);
  const isTrueProfit = trueProfit >= 0;
  const emoji = asset.asset_type?.code?.startsWith('gazelle') ? '🚐' : '🚛';

  const accentBorder =
    asset.status === 'repair'
      ? 'border-l-amber-400'
      : asset.status === 'reserve'
        ? 'border-l-slate-300'
        : isTrueProfit
          ? 'border-l-emerald-400'
          : 'border-l-rose-400';

  const handleDelete = () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      deleteTimer.current = setTimeout(() => setDeleteConfirm(false), 4000);
    } else {
      if (deleteTimer.current) clearTimeout(deleteTimer.current);
      setDeleteConfirm(false);
      onDelete();
    }
  };

  const pct = Math.min(((asset.odometer_current ?? 0) / 300000) * 100, 100);
  const odomColor = pct > 80 ? 'bg-rose-500' : pct > 55 ? 'bg-amber-400' : 'bg-emerald-400';

  return (
    <div
      className={cn(
        'bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden transition-shadow hover:shadow-md border-l-4',
        accentBorder,
        asset.needs_update && 'border-rose-200',
      )}
    >
      {/* Compact header — always visible */}
      <div
        className="px-4 py-2.5 cursor-pointer hover:bg-slate-50/60 transition-colors select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3">
          {/* Identity */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-lg shrink-0">{emoji}</span>
            <div className="min-w-0">
              <p className="font-black text-slate-900 text-sm leading-tight truncate">
                {asset.short_name}
              </p>
              <p className="text-[10px] text-slate-400 truncate">{asset.reg_number}</p>
            </div>
            <span
              className={cn(
                'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0',
                STATUS_COLOR[asset.status] ?? 'bg-slate-100 text-slate-500',
              )}
            >
              {STATUS_LABEL[asset.status] ?? asset.status}
            </span>
            {asset.needs_update && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-500 border border-rose-200 shrink-0">
                !
              </span>
            )}
          </div>

          {/* Key stats */}
          <div className="shrink-0 flex items-center gap-4 text-right">
            <div>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                Рейсов
              </p>
              <p className="text-xs font-bold text-slate-700">
                {a.trip_count > 0 ? a.trip_count : '—'}
              </p>
            </div>
            <div>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                Прибыль
              </p>
              <p
                className={cn(
                  'text-sm font-black',
                  isTrueProfit ? 'text-emerald-600' : 'text-rose-600',
                )}
              >
                {trueProfit < 0 ? '−' : ''}
                <Money amount={Math.abs(trueProfit).toFixed(2)} />
              </p>
            </div>
            {a.margin_pct !== null && (
              <div>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                  Маржа
                </p>
                <p
                  className={cn(
                    'text-xs font-black',
                    a.margin_pct >= 20
                      ? 'text-emerald-600'
                      : a.margin_pct >= 0
                        ? 'text-amber-500'
                        : 'text-rose-600',
                  )}
                >
                  {a.margin_pct}%
                </p>
              </div>
            )}
            {a.true_cost_per_km && parseFloat(a.true_cost_per_km) > 0 && (
              <div>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                  ₽/км
                </p>
                <p className="text-xs font-bold text-slate-600">
                  {parseFloat(a.true_cost_per_km).toFixed(0)}
                </p>
              </div>
            )}
          </div>

          {/* Chevron */}
          <span
            className={cn(
              'material-symbols-outlined text-slate-300 text-[20px] shrink-0 transition-transform duration-300',
              expanded ? 'rotate-180' : '',
            )}
          >
            expand_more
          </span>
        </div>

        {/* Odometer mini-bar always visible */}
        <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full', odomColor)} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Driver + meta */}
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 flex flex-wrap gap-x-4 gap-y-1">
            {asset.driver && (
              <span className="text-xs text-slate-700 font-semibold">👤 {asset.driver.name}</span>
            )}
            {asset.asset_type && (
              <span className="text-xs text-slate-500">{asset.asset_type.name}</span>
            )}
            {asset.year && <span className="text-xs text-slate-400">{asset.year} г.</span>}
            {asset.asset_type?.has_gps && (
              <span className="text-xs text-sky-600 font-semibold">GPS</span>
            )}
            {asset.notes && (
              <span className="text-xs text-slate-400 italic w-full">{asset.notes}</span>
            )}
          </div>

          {/* Analytics */}
          <div className="px-4 py-3 border-t border-slate-100">
            {/* Unprofitable warning */}
            {!isTrueProfit && parseFloat(a.revenue) > 0 && (
              <div className="mb-3 flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                <span className="material-symbols-outlined text-rose-500 text-[16px]">warning</span>
                <span className="text-xs font-bold text-rose-700">
                  Убыточная машина — рассмотреть продажу
                </span>
              </div>
            )}

            {/* Revenue & costs breakdown */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              <StatRow
                label="Выручка"
                value={<Money amount={a.revenue} />}
                color="text-emerald-600"
              />
              <StatRow
                label="Кол-во рейсов"
                value={a.trip_count > 0 ? `${a.trip_count} рейс.` : '—'}
              />
              <StatRow
                label="Операц. расходы (ЗП + ГСМ)"
                value={<Money amount={a.expenses} />}
                color="text-rose-500"
              />
              <StatRow
                label="Кол-во заказов"
                value={a.order_count > 0 ? `${a.order_count} заказ.` : '—'}
              />
              <StatRow
                label="Обслуживание (запчасти)"
                value={parseFloat(a.maintenance) > 0 ? <Money amount={a.maintenance} /> : '—'}
                color="text-amber-600"
              />
              <StatRow
                label="Средний чек"
                value={a.avg_order_value ? `${parseFloat(a.avg_order_value).toFixed(0)} ₽` : '—'}
              />
              <StatRow
                label="Пост. расходы (страховка, налог)"
                value={parseFloat(a.fixed_cost) > 0 ? <Money amount={a.fixed_cost} /> : '—'}
                color="text-slate-600"
              />
              <StatRow
                label="Пробег за период"
                value={a.km > 0 ? `${a.km.toLocaleString('ru-RU')} км` : '—'}
              />
            </div>

            {/* Profit section */}
            <div className="mt-2 pt-2 border-t border-dashed border-slate-200 grid grid-cols-2 gap-x-6 gap-y-1.5">
              <StatRow
                label="Опер. прибыль (без пост/ТО)"
                value={
                  <>
                    {parseFloat(a.profit) >= 0 ? '+' : ''}
                    <Money amount={a.profit} />
                  </>
                }
                color={parseFloat(a.profit) >= 0 ? 'text-emerald-600' : 'text-rose-600'}
              />
              <StatRow
                label="Себестоим. 1 км (опер.)"
                value={
                  a.cost_per_km && parseFloat(a.cost_per_km) > 0
                    ? `${parseFloat(a.cost_per_km).toFixed(0)} ₽/км`
                    : '—'
                }
              />
              <StatRow
                label="Реальная прибыль (все расходы)"
                value={
                  <>
                    {trueProfit >= 0 ? '+' : ''}
                    <Money amount={a.true_profit} />
                  </>
                }
                color={isTrueProfit ? 'text-emerald-700 font-black' : 'text-rose-700 font-black'}
              />
              <StatRow
                label="Полная себестоим. 1 км"
                value={
                  a.true_cost_per_km && parseFloat(a.true_cost_per_km) > 0
                    ? `${parseFloat(a.true_cost_per_km).toFixed(0)} ₽/км`
                    : '—'
                }
                color={
                  a.true_cost_per_km && parseFloat(a.true_cost_per_km) > 0
                    ? 'text-slate-700'
                    : 'text-slate-400'
                }
              />
              {a.margin_pct !== null && (
                <StatRow
                  label="Маржинальность"
                  value={`${a.margin_pct}%`}
                  color={
                    a.margin_pct >= 20
                      ? 'text-emerald-600'
                      : a.margin_pct >= 0
                        ? 'text-amber-500'
                        : 'text-rose-600'
                  }
                />
              )}
              {a.avg_km_per_trip !== null && (
                <StatRow label="Средний пробег/рейс" value={`${a.avg_km_per_trip} км`} />
              )}
            </div>

            {/* Book value */}
            {(asset.current_book_value || asset.remaining_depreciation_months != null) && (
              <div className="mt-2 pt-2 border-t border-dashed border-slate-200 grid grid-cols-2 gap-x-6 gap-y-1.5">
                {asset.current_book_value && parseFloat(asset.current_book_value) > 0 && (
                  <StatRow
                    label="Балансовая стоимость"
                    value={<Money amount={asset.current_book_value} />}
                  />
                )}
                {asset.remaining_depreciation_months != null && (
                  <StatRow
                    label="Амортизация"
                    value={`ещё ${asset.remaining_depreciation_months} мес.`}
                    color="text-slate-500"
                  />
                )}
                {parseFloat(asset.monthly_fixed_cost) > 0 && (
                  <StatRow
                    label="Постоянные/мес."
                    value={<Money amount={asset.monthly_fixed_cost} />}
                    color="text-slate-600"
                  />
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-4 py-2.5 border-t border-slate-100 bg-white flex items-center justify-between">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              className={cn(
                'flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all',
                deleteConfirm
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50',
              )}
            >
              <span className="material-symbols-outlined text-[14px]">
                {deleteConfirm ? 'warning' : 'delete_outline'}
              </span>
              {deleteConfirm ? 'Ещё раз — удалить!' : 'Удалить'}
            </button>

            <div className="flex items-center gap-2">
              {asset.status === 'active' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onChangeStatus('repair');
                  }}
                  className="text-xs font-medium text-amber-600 hover:text-amber-700 border border-amber-200 hover:border-amber-300 rounded-lg py-1.5 px-3 transition-colors"
                >
                  В ремонт
                </button>
              )}
              {asset.status === 'repair' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onChangeStatus('active');
                  }}
                  className="text-xs font-medium text-emerald-600 hover:text-emerald-700 border border-emerald-200 rounded-lg py-1.5 px-3 transition-colors"
                >
                  Активна
                </button>
              )}
              {asset.status !== 'reserve' && asset.status !== 'sold' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onChangeStatus('reserve');
                  }}
                  className="text-xs font-medium text-slate-400 hover:text-slate-600 border border-slate-100 hover:border-slate-200 rounded-lg py-1.5 px-3 transition-colors"
                >
                  В резерв
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="text-xs font-bold text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-400 rounded-lg py-1.5 px-4 transition-colors"
              >
                Изменить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

type VehicleFilter = 'all' | 'trucks' | 'gazelles';

export default function FleetPage() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const period = searchParams.get('period') ?? 'current_month';
  const [vehicleFilter, setVehicleFilter] = useState<VehicleFilter>('all');
  const [modalAsset, setModalAsset] = useState<Asset | 'new' | null>(null);

  const { data, isLoading, isError } = useQuery<FleetResponse>({
    queryKey: ['fleet', period],
    queryFn: () => fetch(`/api/fleet?period=${period}`).then((r) => r.json()),
    staleTime: 60000,
  });

  const { data: drivers = [] } = useQuery<Driver[]>({
    queryKey: ['drivers'],
    queryFn: () => fetch('/api/users?role=driver').then((r) => r.json()),
    staleTime: 300000,
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      fetch(`/api/fleet/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fleet'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/fleet/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Ошибка удаления');
      return json;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fleet'] }),
    onError: (err: Error) => alert(err.message),
  });

  const summary = data?.summary;
  const assetTypes = data?.assetTypes ?? [];

  const assets = (data?.assets ?? []).filter((a) => {
    if (vehicleFilter === 'trucks') return TRUCKS_CODES.includes(a.asset_type?.code ?? '');
    if (vehicleFilter === 'gazelles') return GAZELLE_CODES.includes(a.asset_type?.code ?? '');
    return true;
  });

  return (
    <div className="space-y-6 max-w-[1920px] animate-in fade-in duration-500">
      {/* Заголовок */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Автопарк</h1>
        <button
          onClick={() => setModalAsset('new')}
          className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-slate-700 transition-colors"
        >
          + Добавить машину
        </button>
      </div>

      {isError && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-700 font-bold">
          Ошибка загрузки данных
        </div>
      )}

      {/* Сводка */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Всего', value: summary?.total, color: 'text-slate-900' },
          { label: 'Активных', value: summary?.active, color: 'text-emerald-600' },
          { label: 'В ремонте', value: summary?.repair, color: 'text-amber-600' },
          { label: 'В резерве', value: summary?.reserve, color: 'text-slate-500' },
          { label: 'Нет данных', value: summary?.needsUpdate, color: 'text-rose-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              {label}
            </p>
            {isLoading ? (
              <div className="h-7 w-10 bg-slate-100 rounded animate-pulse" />
            ) : (
              <p className={`text-2xl font-black ${color}`}>{value ?? 0}</p>
            )}
          </div>
        ))}
      </div>

      {/* Фильтры */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Тип машины */}
        <div className="flex bg-slate-100 p-0.5 rounded-xl">
          {(
            [
              ['all', 'Все'],
              ['trucks', '🚛 Грузовики'],
              ['gazelles', '🚐 Газели'],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setVehicleFilter(k)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                vehicleFilter === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Плитки */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-14 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center">
          <p className="text-5xl mb-3">🚛</p>
          <p className="font-medium text-slate-500">Машины не найдены</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 items-start">
          {assets.map((asset) => (
            <AssetTile
              key={asset.id}
              asset={asset}
              onEdit={() => setModalAsset(asset)}
              onChangeStatus={(status) => patchMutation.mutate({ id: asset.id, body: { status } })}
              onDelete={() => deleteMutation.mutate(asset.id)}
            />
          ))}
        </div>
      )}

      {/* Модал */}
      {modalAsset !== null && (
        <AssetModal
          editAsset={modalAsset === 'new' ? null : modalAsset}
          assetTypes={assetTypes}
          drivers={drivers}
          onClose={() => setModalAsset(null)}
          onSaved={() => {
            setModalAsset(null);
            qc.invalidateQueries({ queryKey: ['fleet'] });
          }}
        />
      )}
    </div>
  );
}
