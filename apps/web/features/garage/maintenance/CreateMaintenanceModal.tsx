'use client';

import { cn } from '@saldacargo/ui';
import type { Asset } from '../types';

export interface MaintenanceCreateForm {
  asset_id: string;
  work_name: string;
  interval_km: string;
  interval_months: string;
  last_done_km: string;
  last_done_at: string;
}

export function CreateMaintenanceModal({
  assets,
  createForm,
  setCreateForm,
  isPending,
  onClose,
  onSubmit,
}: {
  assets: Asset[];
  createForm: MaintenanceCreateForm;
  setCreateForm: (form: MaintenanceCreateForm) => void;
  isPending: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Новый регламент ТО</h2>
            <p className="text-xs text-slate-500 mt-0.5">Контроль срока по дате и/или пробегу</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Автомобиль *</label>
            <select
              value={createForm.asset_id}
              onChange={(e) => setCreateForm({ ...createForm, asset_id: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
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
            <label className="text-xs font-semibold text-slate-600 block mb-1">Вид работы *</label>
            <input
              value={createForm.work_name}
              onChange={(e) => setCreateForm({ ...createForm, work_name: e.target.value })}
              placeholder="Замена масла двигателя и всех фильтров"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>📅</span> Контроль по дате и сроку
              </span>
              <span className="text-[11px] text-blue-600 font-medium">
                Основное, если одометр не работает
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  Дата последней замены *
                </label>
                <input
                  type="date"
                  value={createForm.last_done_at}
                  onChange={(e) => setCreateForm({ ...createForm, last_done_at: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Сегодня или прошлая дата
                </span>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  Интервал (мес.)
                </label>
                <input
                  type="number"
                  value={createForm.interval_months}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, interval_months: e.target.value })
                  }
                  placeholder="6"
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Обычно 3, 6 или 12 мес.
                </span>
              </div>
            </div>

            {(() => {
              if (!createForm.last_done_at || !createForm.interval_months) return null;
              const d = new Date(createForm.last_done_at);
              d.setMonth(d.getMonth() + Number(createForm.interval_months));
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const targetDay = new Date(d);
              targetDay.setHours(0, 0, 0, 0);
              const diff = Math.ceil(
                (targetDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
              );
              const dateStr = d.toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              });
              return (
                <div
                  className={cn(
                    'text-xs p-2.5 rounded-lg border flex items-center justify-between',
                    diff <= 0
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : diff <= 30
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200',
                  )}
                >
                  <div>
                    Следующая замена: <strong>{dateStr}</strong>
                  </div>
                  <div className="font-semibold text-[11px]">
                    {diff < 0
                      ? `Просрочено на ${Math.abs(diff)} дн.`
                      : diff === 0
                        ? 'Срок наступил сегодня!'
                        : `Через ${diff} дн.`}
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="border border-slate-200/80 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <span>🚗</span> Контроль по пробегу
              </span>
              <span className="text-[11px] text-slate-400">Необязательно</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  Интервал (км)
                </label>
                <input
                  type="number"
                  value={createForm.interval_km}
                  onChange={(e) => setCreateForm({ ...createForm, interval_km: e.target.value })}
                  placeholder="10000"
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  Пробег при замене (км)
                </label>
                <input
                  type="number"
                  value={createForm.last_done_km}
                  onChange={(e) => setCreateForm({ ...createForm, last_done_km: e.target.value })}
                  placeholder="80000"
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              Если одометр не работает, оставьте поля пробега пустыми — система будет
              ориентироваться на дату.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm font-semibold hover:bg-slate-50 transition"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={isPending || !createForm.asset_id || !createForm.work_name.trim()}
              className="flex-[2] bg-slate-900 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition"
            >
              {isPending ? 'Сохранение...' : 'Создать регламент'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
