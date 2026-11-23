'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SettingsData } from '../types';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<SettingsData>({
    queryKey: ['garage-settings'],
    queryFn: () => fetch('/api/garage/settings').then((r) => r.json()),
  });

  const [rateDraft, setRateDraft] = useState<string | null>(null);
  const [rateOwnDraft, setRateOwnDraft] = useState<string | null>(null);
  const [mechPctDraft, setMechPctDraft] = useState<Record<string, string>>({});
  const [savedSuccess, setSavedSuccess] = useState(false);

  const rate = rateDraft ?? data?.sto?.hourly_rate ?? '2000';
  const rateOwn = rateOwnDraft ?? data?.sto?.hourly_rate_own ?? '1600';

  const getMechPct = (id: string, fallback: string) => mechPctDraft[id] ?? fallback ?? '40';

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch('/api/garage/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['garage-settings'] });
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 bg-sky-50/70 border-b border-sky-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-900">⚙️ Настройки СТО и ставок</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Ставки нормо-часа и базовый процент оплаты механикам
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Загрузка настроек...</div>
        ) : (
          <div className="p-5 space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Ставка нормо-часа для своего автопарка (₽/час)
              </label>
              <input
                type="number"
                value={rateOwn}
                onChange={(e) => setRateOwnDraft(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-800"
              />
              <span className="text-[10px] text-slate-400">
                Используется для калькуляции себестоимости обслуживания
              </span>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Ставка нормо-часа для сторонних клиентов (₽/час)
              </label>
              <input
                type="number"
                value={rate}
                onChange={(e) => setRateDraft(e.target.value)}
                className="w-full px-3 py-2 bg-emerald-50 border border-emerald-300 rounded-xl font-black text-emerald-900"
              />
              <span className="text-[10px] text-slate-400">
                Выставляется в заказ-нарядах коммерческим клиентам
              </span>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <label className="block font-bold text-slate-700 mb-1">
                Базовый процент зарплаты механиков (%)
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {(data?.mechanics ?? []).map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200/70"
                  >
                    <span className="font-semibold text-slate-800 truncate">{m.name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={getMechPct(m.id, m.mechanic_salary_pct)}
                        onChange={(e) =>
                          setMechPctDraft((prev) => ({ ...prev, [m.id]: e.target.value }))
                        }
                        className="w-14 px-2 py-1 bg-white border border-slate-200 rounded-lg text-center font-bold text-xs"
                      />
                      <span className="text-slate-400 font-bold">%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {savedSuccess && (
              <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-center font-bold">
                ✓ Настройки успешно сохранены
              </div>
            )}
          </div>
        )}

        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 font-bold"
          >
            Отмена
          </button>
          <button
            onClick={async () => {
              await saveMutation.mutateAsync({
                hourly_rate: rate,
                hourly_rate_own: rateOwn,
              });
              for (const m of data?.mechanics ?? []) {
                const pct = getMechPct(m.id, m.mechanic_salary_pct);
                await fetch('/api/garage/settings', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ mechanic_id: m.id, mechanic_salary_pct: pct }),
                });
              }
              qc.invalidateQueries({ queryKey: ['garage-settings'] });
              setSavedSuccess(true);
              setTimeout(() => {
                setSavedSuccess(false);
                onClose();
              }, 800);
            }}
            disabled={saveMutation.isPending}
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
