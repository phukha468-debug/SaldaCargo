'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Money } from '@saldacargo/ui';
import { formatDate } from '@saldacargo/shared';

type Order = {
  id: string;
  amount: string;
  payment_method: string;
  description: string | null;
  created_at: string;
  trip_number: number;
  started_at: string;
  driver_name: string;
};

type Debtor = {
  counterparty_id: string;
  counterparty_name: string;
  counterparty_phone: string | null;
  counterparty_subname: string | null;
  is_individual: boolean;
  total: string;
  oldest_at: string;
  orders: Order[];
};

type ReceivablesData = {
  debtors: Debtor[];
  totalAmount: string;
  overdueCount: number;
};

const PAYMENT_LABELS: Record<string, string> = {
  bank_invoice: 'Безнал',
  debt_cash: 'Долг нал',
  qr: 'QR',
  cash: 'Нал',
  card_driver: 'Карта',
};

function daysAgo(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

export default function ReceivablesPage() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<ReceivablesData>({
    queryKey: ['receivables'],
    queryFn: () => fetch('/api/receivables').then((r) => r.json()),
    staleTime: 30000,
  });

  const debtors = data?.debtors ?? [];

  async function handleMarkPaid(orderId: string) {
    setMarkingId(orderId);
    try {
      const r = await fetch(`/api/receivables/${orderId}`, { method: 'PATCH' });
      if (!r.ok) throw new Error('Ошибка');
      await queryClient.invalidateQueries({ queryKey: ['receivables'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    } catch {
      alert('Не удалось отметить оплату');
    } finally {
      setMarkingId(null);
    }
  }

  return (
    <div className="space-y-6 p-4 max-w-7xl mx-auto animate-in fade-in duration-500">
      <h1 className="text-2xl font-bold text-slate-900">Дебиторская задолженность</h1>

      {/* Summary KPI */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-200 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Всего к получению
            </p>
            <p className="text-2xl font-black text-rose-600 mt-1">
              <Money amount={data?.totalAmount ?? '0'} />
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Контрагентов
            </p>
            <p className="text-2xl font-black text-slate-800 mt-1">{debtors.length}</p>
          </div>
          <div
            className={`border rounded-lg p-4 shadow-sm ${
              (data?.overdueCount ?? 0) > 0
                ? 'bg-rose-50 border-rose-200'
                : 'bg-white border-slate-200'
            }`}
          >
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Просрочено (&gt;30 дней)
            </p>
            <p
              className={`text-2xl font-black mt-1 ${
                (data?.overdueCount ?? 0) > 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}
            >
              {data?.overdueCount ?? 0}
            </p>
          </div>
        </div>
      )}

      {isError && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-700 font-bold">
          Ошибка загрузки данных
        </div>
      )}

      {/* Debtors table */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/80">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-widest">
            Список должников
          </h2>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-2 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-slate-100 rounded" />
            ))}
          </div>
        ) : debtors.length === 0 ? (
          <div className="py-16 text-center">
            <span className="material-symbols-outlined text-slate-200 text-[64px]">
              check_circle
            </span>
            <p className="text-slate-400 font-medium mt-2">Дебиторской задолженности нет</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {debtors.map((debtor) => {
              const days = daysAgo(debtor.oldest_at);
              const isOverdue = days > 30;
              const isExpanded = expandedId === debtor.counterparty_id;

              return (
                <div key={debtor.counterparty_id}>
                  {/* Debtor row */}
                  <div
                    className={`px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors ${
                      isExpanded ? 'bg-slate-50' : ''
                    }`}
                    onClick={() => setExpandedId(isExpanded ? null : debtor.counterparty_id)}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${
                          isOverdue ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {debtor.counterparty_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-900">
                            {debtor.counterparty_name}
                          </p>
                          {debtor.is_individual && debtor.counterparty_subname && (
                            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              {debtor.counterparty_subname}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {debtor.orders.length} {debtor.orders.length === 1 ? 'заказ' : 'заказа'} ·{' '}
                          {isOverdue ? (
                            <span className="text-rose-500 font-bold">просрочка {days} дн.</span>
                          ) : (
                            <span>{days} дн. назад</span>
                          )}
                          {debtor.counterparty_phone && ` · ${debtor.counterparty_phone}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span
                        className={`text-base font-black ${
                          isOverdue ? 'text-rose-600' : 'text-amber-600'
                        }`}
                      >
                        <Money amount={debtor.total} />
                      </span>
                      <span
                        className="material-symbols-outlined text-slate-400 text-lg transition-transform duration-200"
                        style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                      >
                        expand_more
                      </span>
                    </div>
                  </div>

                  {/* Expanded orders */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/50">
                      <table className="w-full text-left">
                        <thead className="bg-slate-100/50">
                          <tr>
                            <th className="px-8 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                              Рейс
                            </th>
                            <th className="px-4 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                              Водитель
                            </th>
                            <th className="px-4 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                              Дата
                            </th>
                            <th className="px-4 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                              Тип
                            </th>
                            <th className="px-4 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-right">
                              Сумма
                            </th>
                            <th className="px-4 py-2" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {debtor.orders.map((order) => (
                            <tr key={order.id} className="hover:bg-white transition-colors">
                              <td className="px-8 py-3 text-xs font-semibold text-slate-700">
                                №{order.trip_number}
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-600">
                                {order.driver_name}
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                                {formatDate(order.started_at)}
                              </td>
                              <td className="px-4 py-3">
                                <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[9px] font-bold uppercase">
                                  {PAYMENT_LABELS[order.payment_method] ?? order.payment_method}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right text-xs font-black text-slate-800">
                                <Money amount={order.amount} />
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() => handleMarkPaid(order.id)}
                                  disabled={markingId === order.id}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded uppercase tracking-wide transition-colors disabled:opacity-50"
                                >
                                  {markingId === order.id ? '...' : '✓ Оплачено'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
