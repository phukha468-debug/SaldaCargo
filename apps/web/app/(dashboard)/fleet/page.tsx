'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Money } from '@saldacargo/ui';

// ─── Types ───────────────────────────────────────────────────────────────────

type AssetType = { id: string; code: string; name: string; capacity_m: number; has_gps: boolean };
type Driver = { id: string; name: string };

type Analytics = {
  revenue: string;
  expenses: string;
  profit: string;
  km: number;
  cost_per_km: string | null;
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

const PERIOD_LABEL: Record<string, string> = { day: 'День', week: 'Неделя', month: 'Месяц' };

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
  notes: '',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function OdometerBar({ km }: { km: number }) {
  const pct = Math.min((km / 300000) * 100, 100);
  const color = pct > 80 ? 'bg-rose-500' : pct > 55 ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <div>
      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
        <span>Одометр</span>
        <span className="font-medium text-slate-600">{km.toLocaleString('ru-RU')} км</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

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
      current_book_value: form.current_book_value || null,
      remaining_depreciation_months: form.remaining_depreciation_months
        ? parseInt(form.remaining_depreciation_months)
        : null,
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

// ─── Tile ────────────────────────────────────────────────────────────────────

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
  const a = asset.analytics;
  const profit = parseFloat(a.profit);
  const isProfit = profit >= 0;

  return (
    <div
      className={`bg-white border rounded-2xl shadow-sm flex flex-col overflow-hidden transition-all hover:shadow-md ${
        asset.needs_update ? 'border-rose-200' : 'border-slate-200'
      }`}
    >
      {/* Шапка плитки */}
      <div
        className={`px-4 pt-4 pb-3 ${asset.status === 'repair' ? 'bg-amber-50/60' : asset.status === 'reserve' ? 'bg-slate-50' : ''}`}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">
              {asset.asset_type?.code?.startsWith('gazelle') ? '🚐' : '🚛'}
            </span>
            <div>
              <p className="font-black text-slate-900 text-lg leading-tight">{asset.short_name}</p>
              <p className="text-xs text-slate-400">{asset.reg_number}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_COLOR[asset.status]}`}
            >
              {STATUS_LABEL[asset.status]}
            </span>
            {asset.needs_update && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-500 border border-rose-200">
                Нет данных
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
          {asset.asset_type && <span>{asset.asset_type.name}</span>}
          {asset.year && <span>{asset.year} г.</span>}
          {asset.asset_type?.has_gps && <span className="text-sky-600 font-medium">GPS</span>}
          {asset.driver && (
            <span className="text-slate-700 font-semibold">👤 {asset.driver.name}</span>
          )}
        </div>
      </div>

      {/* Одометр */}
      <div className="px-4 py-3 border-t border-slate-50">
        <OdometerBar km={asset.odometer_current ?? 0} />
      </div>

      {/* Аналитика */}
      <div className="px-4 py-3 border-t border-slate-50 flex-1">
        <StatRow label="Выручка" value={<Money amount={a.revenue} />} color="text-emerald-600" />
        <StatRow label="Расходы" value={<Money amount={a.expenses} />} color="text-rose-500" />
        <StatRow
          label="Прибыль"
          value={
            <>
              {isProfit ? '+' : ''}
              <Money amount={a.profit} />
            </>
          }
          color={isProfit ? 'text-emerald-700' : 'text-rose-600'}
        />
        <StatRow
          label="Пробег за период"
          value={a.km > 0 ? `${a.km.toLocaleString('ru-RU')} км` : '—'}
        />
        <StatRow
          label="Себестоимость 1 км"
          value={a.cost_per_km ? `${parseFloat(a.cost_per_km).toFixed(0)} ₽/км` : '—'}
          color={a.cost_per_km ? 'text-slate-700' : 'text-slate-400'}
        />
        {asset.current_book_value && (
          <StatRow
            label="Балансовая стоимость"
            value={<Money amount={asset.current_book_value} />}
          />
        )}
        {asset.remaining_depreciation_months && (
          <StatRow
            label="Амортизация"
            value={`ещё ${asset.remaining_depreciation_months} мес.`}
            color="text-slate-500"
          />
        )}
        {asset.notes && (
          <p className="text-[10px] text-slate-400 italic mt-2 border-t border-slate-50 pt-2">
            {asset.notes}
          </p>
        )}
      </div>

      {/* Действия */}
      <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-2">
        <button
          onClick={onEdit}
          className="flex-1 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-lg py-1.5 transition-colors"
        >
          Изменить
        </button>
        {asset.status === 'active' && (
          <button
            onClick={() => onChangeStatus('repair')}
            className="flex-1 text-xs font-medium text-amber-600 hover:text-amber-700 border border-amber-200 hover:border-amber-300 rounded-lg py-1.5 transition-colors"
          >
            В ремонт
          </button>
        )}
        {asset.status === 'repair' && (
          <button
            onClick={() => onChangeStatus('active')}
            className="flex-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 border border-emerald-200 hover:border-emerald-300 rounded-lg py-1.5 transition-colors"
          >
            Активна
          </button>
        )}
        {asset.status !== 'reserve' && asset.status !== 'sold' && (
          <button
            onClick={() => onChangeStatus('reserve')}
            className="text-xs font-medium text-slate-400 hover:text-slate-600 border border-slate-100 hover:border-slate-200 rounded-lg py-1.5 px-2.5 transition-colors"
            title="В резерв"
          >
            ⏸
          </button>
        )}
        <button
          onClick={onDelete}
          className="text-xs font-medium text-rose-400 hover:text-rose-600 border border-rose-100 hover:border-rose-300 rounded-lg py-1.5 px-2.5 transition-colors"
          title="Удалить"
        >
          🗑
        </button>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

type VehicleFilter = 'all' | 'trucks' | 'gazelles';
type Period = 'day' | 'week' | 'month';

export default function FleetPage() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period>('month');
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

        {/* Период аналитики */}
        <div className="flex bg-slate-100 p-0.5 rounded-xl ml-auto">
          <span className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
            Период:
          </span>
          {(['day', 'week', 'month'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                period === p ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Плитки */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-80 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center">
          <p className="text-5xl mb-3">🚛</p>
          <p className="font-medium text-slate-500">Машины не найдены</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {assets.map((asset) => (
            <AssetTile
              key={asset.id}
              asset={asset}
              onEdit={() => setModalAsset(asset)}
              onChangeStatus={(status) => patchMutation.mutate({ id: asset.id, body: { status } })}
              onDelete={() => {
                if (confirm(`Удалить "${asset.short_name}" (${asset.reg_number})?`))
                  deleteMutation.mutate(asset.id);
              }}
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
