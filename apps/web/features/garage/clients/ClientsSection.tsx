'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { StoClient, StoClientDetail } from '../types';
import { CreateClientModal } from './CreateClientModal';
import { StoClientDetailView } from './StoClientDetailView';
import { CreateVehicleModal } from './VehicleFormsModals';

export function ClientsSection() {
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
    <div className="space-y-3">
      {/* Шапка раздела клиентов и поиск */}
      <div className="flex items-center justify-between flex-wrap gap-2 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Поиск клиента по названию, телефону..."
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:bg-white focus:outline-hidden focus:border-sky-400"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateClient(true)}
            className="text-xs font-bold px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>➕</span>
            <span>Новый клиент</span>
          </button>
          <button
            onClick={() => setShowCreateVehicle(true)}
            className="text-xs font-bold px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>🚗</span>
            <span>Добавить авто</span>
          </button>
        </div>
      </div>

      {/* Список клиентов в виде строчных карточек */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : clientsError ? (
        <div className="p-8 text-center text-rose-500 text-xs font-bold bg-white rounded-2xl border border-rose-200">
          Ошибка: {(clientsError as Error).message}
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center">
          <p className="text-4xl mb-2">👥</p>
          <p className="font-bold text-slate-600">Клиентов СТО пока нет</p>
          <p className="text-xs text-slate-400 mt-1">
            Добавляйте сторонних клиентов для учёта коммерческих ремонтов и расширения базы
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {clients.map((c) => (
            <div
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className="bg-white border border-slate-200 hover:border-indigo-300 rounded-xl px-4 py-2.5 cursor-pointer hover:shadow-xs transition-all flex items-center justify-between gap-3 group"
            >
              {/* Левая часть: иконка, имя, телефон, количество авто и нарядов */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200/70 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  🏢
                </div>
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="font-bold text-sm text-slate-900 truncate">{c.name}</span>
                  {c.phone && (
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60">
                      📞 {c.phone}
                    </span>
                  )}
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/60">
                    🚗 {c.vehicles_count} авто
                  </span>
                  <span className="text-xs font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">
                    📋 {c.orders_count} нарядов
                  </span>
                </div>
              </div>

              {/* Правая часть: выручка и кнопка шестеренки */}
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Выручка
                  </span>
                  <span className="font-black text-sm text-emerald-700">
                    {parseFloat(c.total_revenue || '0') > 0
                      ? `${parseFloat(c.total_revenue).toLocaleString('ru-RU')} ₽`
                      : '0 ₽'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(c.id);
                  }}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
                  title="Открыть карточку и настройки"
                >
                  ⚙️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модальное окно информации о клиенте */}
      {selectedId && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedId(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-indigo-50/60">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <span>🏢</span>
                <span>Карточка клиента СТО</span>
              </h3>
              <button
                onClick={() => setSelectedId(null)}
                className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {detailLoading ? (
                <div className="p-12 text-center text-slate-400 text-sm font-semibold">
                  Загрузка полной информации о клиенте...
                </div>
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
          </div>
        </div>
      )}

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
