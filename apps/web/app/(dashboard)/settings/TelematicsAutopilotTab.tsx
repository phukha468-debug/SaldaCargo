'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { OrganizationTelematicsSettings, TelematicsKnownGeofence } from '@saldacargo/shared';
import { cn } from '@saldacargo/ui';

interface TelematicsVehicleItem {
  id: string;
  reg_number: string;
  short_name: string;
  wialon_id: string | null;
  odometer_current: number;
  odometer_offset_km: number;
  telematics: {
    state: string;
    last_msg_ts: number;
    last_speed: number | null;
    updated_at: string;
  } | null;
}

interface TelematicsEventItem {
  id: string;
  asset_id: string;
  order_id: string | null;
  trip_id: string | null;
  source: string;
  decision: string;
  reason_code: string;
  reason_text: string;
  state_before: string | null;
  state_after: string | null;
  telemetry_snapshot: Record<string, unknown>;
  created_at: string;
}

interface DiagnosticsResponse {
  vehicles: TelematicsVehicleItem[];
  events: TelematicsEventItem[];
}

interface Props {
  initialSettings: OrganizationTelematicsSettings;
  canEdit: boolean;
  onSaved: () => void;
  onToast: (type: 'ok' | 'err', text: string) => void;
}

const DECISION_META: Record<string, { label: string; cls: string }> = {
  trip_opened: { label: 'Открыт рейс', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  stop_recorded: { label: 'Точка', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  stop_ignored: { label: 'Игнор точки', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  transit_entered: { label: 'Транзит', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  transit_resumed: {
    label: 'Выезд из транз.',
    cls: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  trip_closed_to_review: {
    label: 'На ревью',
    cls: 'bg-violet-50 text-violet-700 border-violet-200',
  },
  ignored_gps_noise: { label: 'Шум GPS', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  ignored_gps_stale: {
    label: 'Устаревший GPS',
    cls: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  ignored_duplicate_lock: {
    label: 'Лок гонки',
    cls: 'bg-slate-100 text-slate-500 border-slate-200',
  },
  error: { label: 'Ошибка', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const STATE_LABEL: Record<string, string> = {
  AT_BASE: 'На базе',
  EN_ROUTE: 'В пути',
  AT_STOP: 'Стоянка',
  IN_BASE_TRANSIT: 'Транзит',
};

export function TelematicsAutopilotTab({ initialSettings, canEdit, onSaved, onToast }: Props) {
  const [form, setForm] = useState<OrganizationTelematicsSettings>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [geoModalOpen, setGeoModalOpen] = useState(false);
  const [inspectEvent, setInspectEvent] = useState<TelematicsEventItem | null>(null);

  // Поля добавления новой геозоны в модалке
  const [newGeo, setNewGeo] = useState({
    name: '',
    city: '',
    raw_address: '',
    lat: '',
    lon: '',
    radius_m: '10000',
    role: 'any' as 'loading' | 'unloading' | 'any',
  });

  const {
    data: diag,
    isLoading: diagLoading,
    refetch: refetchDiag,
  } = useQuery<DiagnosticsResponse>({
    queryKey: ['telematics-diagnostics', selectedAssetId],
    queryFn: async () => {
      const qs = new URLSearchParams({ limit: '40' });
      if (selectedAssetId) qs.set('asset_id', selectedAssetId);
      const res = await fetch(`/api/telematics/diagnostics?${qs.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  const vehicleMap = new Map((diag?.vehicles ?? []).map((v) => [v.id, v]));

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    try {
      const res = await fetch('/api/organization/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { telematics: form } }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        onToast('err', json.error ?? 'Ошибка сохранения настроек Автопилота');
        return;
      }
      onToast('ok', 'Настройки Автопилота GPS сохранены');
      onSaved();
    } catch {
      onToast('err', 'Сетевая ошибка при сохранении');
    } finally {
      setSaving(false);
    }
  }

  function addGeofence() {
    const lat = Number(newGeo.lat);
    const lon = Number(newGeo.lon);
    const radius = Number(newGeo.radius_m) || 10000;
    if (
      !newGeo.name.trim() ||
      !newGeo.city.trim() ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon)
    ) {
      onToast('err', 'Заполните название, город и корректные координаты');
      return;
    }
    const item: TelematicsKnownGeofence = {
      id: `geo_${Date.now()}`,
      name: newGeo.name.trim(),
      city: newGeo.city.trim(),
      raw_address: newGeo.raw_address.trim() || newGeo.city.trim(),
      lat,
      lon,
      radius_m: radius,
      role: newGeo.role,
    };
    setForm((prev) => ({
      ...prev,
      known_geofences: [...prev.known_geofences, item],
    }));
    setNewGeo({
      name: '',
      city: '',
      raw_address: '',
      lat: '',
      lon: '',
      radius_m: '10000',
      role: 'any',
    });
  }

  function removeGeofence(id: string) {
    setForm((prev) => ({
      ...prev,
      known_geofences: prev.known_geofences.filter((g) => g.id !== id),
    }));
  }

  return (
    <div className="space-y-4">
      {/* ── Блок 1: Настройки базы, порогов и транзита ─────────────────── */}
      <form
        onSubmit={handleSave}
        className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Автопилот GPS (Wialon v2)
            </h2>
            <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={form.autopilot_enabled}
                onChange={(e) => setForm({ ...form, autopilot_enabled: e.target.checked })}
                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              Автопилот включён
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setGeoModalOpen(true)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:border-sky-400 text-xs font-bold text-slate-700 hover:text-sky-700 cursor-pointer"
            >
              Геозоны ({form.known_geofences.length})
            </button>
            {canEdit && (
              <button
                type="submit"
                disabled={saving}
                className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-xs font-bold text-white disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            )}
          </div>
        </div>

        {/* Геозона базы — 1 компактная строка */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <label className="block">
            <span className="text-[11px] font-bold text-slate-500">База (название)</span>
            <input
              type="text"
              disabled={!canEdit}
              value={form.base_geofence.name}
              onChange={(e) =>
                setForm({ ...form, base_geofence: { ...form.base_geofence, name: e.target.value } })
              }
              className="mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold text-slate-500">Широта (lat)</span>
            <input
              type="number"
              step="0.0001"
              disabled={!canEdit}
              value={form.base_geofence.lat}
              onChange={(e) =>
                setForm({
                  ...form,
                  base_geofence: { ...form.base_geofence, lat: Number(e.target.value) },
                })
              }
              className="mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-mono"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold text-slate-500">Долгота (lon)</span>
            <input
              type="number"
              step="0.0001"
              disabled={!canEdit}
              value={form.base_geofence.lon}
              onChange={(e) =>
                setForm({
                  ...form,
                  base_geofence: { ...form.base_geofence, lon: Number(e.target.value) },
                })
              }
              className="mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-mono"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold text-slate-500">Радиус базы (м)</span>
            <input
              type="number"
              disabled={!canEdit}
              value={form.base_geofence.radius_m}
              onChange={(e) =>
                setForm({
                  ...form,
                  base_geofence: { ...form.base_geofence, radius_m: Number(e.target.value) },
                })
              }
              className="mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-mono"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold text-slate-500">Гистерезис выезда (м)</span>
            <input
              type="number"
              disabled={!canEdit}
              value={form.base_geofence.departure_hysteresis_m}
              onChange={(e) =>
                setForm({
                  ...form,
                  base_geofence: {
                    ...form.base_geofence,
                    departure_hysteresis_m: Number(e.target.value),
                  },
                })
              }
              className="mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-mono"
            />
          </label>
        </div>

        {/* Пороги остановок, возврата и транзита — 1 компактная строка */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-1 border-t border-slate-100">
          <label className="block">
            <span className="text-[11px] font-bold text-slate-500">Стоянка геозона (мин)</span>
            <input
              type="number"
              disabled={!canEdit}
              value={form.thresholds.stop_min_duration_known_min}
              onChange={(e) =>
                setForm({
                  ...form,
                  thresholds: {
                    ...form.thresholds,
                    stop_min_duration_known_min: Number(e.target.value),
                  },
                })
              }
              className="mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-mono"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold text-slate-500">Стоянка внешн. (мин)</span>
            <input
              type="number"
              disabled={!canEdit}
              value={form.thresholds.stop_min_duration_unknown_min}
              onChange={(e) =>
                setForm({
                  ...form,
                  thresholds: {
                    ...form.thresholds,
                    stop_min_duration_unknown_min: Number(e.target.value),
                  },
                })
              }
              className="mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-mono"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold text-slate-500">Кластер стоянки (м)</span>
            <input
              type="number"
              disabled={!canEdit}
              value={form.thresholds.stop_cluster_radius_m}
              onChange={(e) =>
                setForm({
                  ...form,
                  thresholds: { ...form.thresholds, stop_cluster_radius_m: Number(e.target.value) },
                })
              }
              className="mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-mono"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold text-slate-500">Подтв. возврата (мин)</span>
            <input
              type="number"
              disabled={!canEdit}
              value={form.thresholds.arrival_confirm_min}
              onChange={(e) =>
                setForm({
                  ...form,
                  thresholds: { ...form.thresholds, arrival_confirm_min: Number(e.target.value) },
                })
              }
              className="mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-mono"
            />
          </label>
          <label className="flex flex-col justify-end">
            <span className="text-[11px] font-bold text-slate-500 mb-1">Транзит на базе</span>
            <span className="inline-flex items-center gap-1.5 h-[30px] text-xs font-bold text-slate-700">
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={form.transit_rules.enabled}
                onChange={(e) =>
                  setForm({
                    ...form,
                    transit_rules: { ...form.transit_rules, enabled: e.target.checked },
                  })
                }
                className="rounded border-slate-300 text-sky-600"
              />
              {form.transit_rules.enabled ? 'Разрешён' : 'Выкл'}
            </span>
          </label>
          <label className="block">
            <span className="text-[11px] font-bold text-slate-500">Лимит транзита (ч)</span>
            <input
              type="number"
              disabled={!canEdit}
              value={form.transit_rules.max_transit_hours}
              onChange={(e) =>
                setForm({
                  ...form,
                  transit_rules: {
                    ...form.transit_rules,
                    max_transit_hours: Number(e.target.value),
                  },
                })
              }
              className="mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-mono"
            />
          </label>
        </div>
      </form>

      {/* ── Блок 2: Журнал решений трекера (Diagnostic Trail, 1-строчный) ─ */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
            Журнал решений трекера
          </h3>
          <div className="flex items-center gap-2">
            <select
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white"
            >
              <option value="">Все машины ({diag?.vehicles.length ?? 0})</option>
              {(diag?.vehicles ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.short_name} ({v.reg_number}) —{' '}
                  {STATE_LABEL[v.telematics?.state ?? ''] ?? 'Нет данных'}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => refetchDiag()}
              className="px-2.5 py-1 rounded-lg border border-slate-200 hover:border-sky-400 text-xs font-bold text-slate-600 hover:text-sky-700 cursor-pointer"
            >
              Обновить
            </button>
          </div>
        </div>

        {diagLoading ? (
          <div className="py-4 text-center text-xs text-slate-400">Загрузка журнала...</div>
        ) : (diag?.events.length ?? 0) === 0 ? (
          <div className="py-4 text-center text-xs text-slate-400">Событий автопилота пока нет</div>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
            {(diag?.events ?? []).map((ev) => {
              const meta = DECISION_META[ev.decision] ?? {
                label: ev.decision,
                cls: 'bg-slate-100 text-slate-600 border-slate-200',
              };
              const veh = vehicleMap.get(ev.asset_id);
              const timeStr = new Date(ev.created_at).toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <div
                  key={ev.id}
                  onClick={() => setInspectEvent(ev)}
                  className="flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="font-mono text-[11px] text-slate-400 shrink-0">{timeStr}</span>
                    <span className="font-bold text-slate-800 shrink-0">
                      {veh?.short_name ?? ev.asset_id.slice(0, 6)}
                    </span>
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded-md border text-[10px] font-bold shrink-0',
                        meta.cls,
                      )}
                    >
                      {meta.label}
                    </span>
                    <span className="truncate text-slate-600">{ev.reason_text}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono text-slate-400 uppercase">
                      {ev.source}
                    </span>
                    <span className="text-[11px] font-bold text-sky-600">Детали</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Модалка редактирования геозон ──────────────────────────────── */}
      {geoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">
                Известные геозоны ({form.known_geofences.length})
              </h3>
              <button
                type="button"
                onClick={() => setGeoModalOpen(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Закрыть
              </button>
            </div>

            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
              {form.known_geofences.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-400">Геозоны не добавлены</div>
              ) : (
                form.known_geofences.map((gf) => (
                  <div
                    key={gf.id}
                    className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 truncate">
                      <span className="font-bold text-slate-800">{gf.name}</span>
                      <span className="text-slate-500">{gf.city}</span>
                      <span className="font-mono text-[11px] text-slate-400">
                        {gf.lat.toFixed(4)}, {gf.lon.toFixed(4)} (R={Math.round(gf.radius_m / 1000)}
                        км)
                      </span>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => removeGeofence(gf.id)}
                        className="text-[11px] font-bold text-rose-600 hover:underline shrink-0 cursor-pointer"
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {canEdit && (
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-2 border-t border-slate-100">
                <input
                  placeholder="Название"
                  value={newGeo.name}
                  onChange={(e) => setNewGeo({ ...newGeo, name: e.target.value })}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs sm:col-span-2"
                />
                <input
                  placeholder="Город"
                  value={newGeo.city}
                  onChange={(e) => setNewGeo({ ...newGeo, city: e.target.value })}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                />
                <input
                  placeholder="Lat"
                  value={newGeo.lat}
                  onChange={(e) => setNewGeo({ ...newGeo, lat: e.target.value })}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-mono"
                />
                <input
                  placeholder="Lon"
                  value={newGeo.lon}
                  onChange={(e) => setNewGeo({ ...newGeo, lon: e.target.value })}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={addGeofence}
                  className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold py-1 cursor-pointer"
                >
                  Добавить
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Модалка деталей события журнала ────────────────────────────── */}
      {inspectEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg p-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-slate-900">
                {inspectEvent.reason_code} ({inspectEvent.decision})
              </span>
              <button
                type="button"
                onClick={() => setInspectEvent(null)}
                className="font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Закрыть
              </button>
            </div>
            <p className="text-slate-700">{inspectEvent.reason_text}</p>
            <div className="grid grid-cols-2 gap-2 bg-slate-50 rounded-xl p-2.5 font-mono text-[11px]">
              <div>
                Переход: {inspectEvent.state_before ?? '-'} → {inspectEvent.state_after ?? '-'}
              </div>
              <div>Источник: {inspectEvent.source}</div>
              <div>Order: {inspectEvent.order_id ?? '—'}</div>
              <div>Trip: {inspectEvent.trip_id ?? '—'}</div>
            </div>
            <pre className="bg-slate-900 text-slate-100 rounded-xl p-2.5 text-[11px] overflow-x-auto max-h-48">
              {JSON.stringify(inspectEvent.telemetry_snapshot, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
