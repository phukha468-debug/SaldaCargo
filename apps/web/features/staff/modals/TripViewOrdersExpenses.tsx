'use client';

import { cn } from '@saldacargo/ui';
import type { PayrollUser } from '../types';

export interface QuickViewTripOrder {
  id: string;
  amount: string;
  driver_pay: string;
  loader_pay: string;
  loader2_pay: string;
  loader_id?: string | null;
  loader2_id?: string | null;
  description?: string | null;
  payment_method?: string;
  settlement_status?: string;
  lifecycle_status?: string;
  counterparty_id?: string | null;
  counterparty?: { id: string; name: string } | null;
  loader?: { id: string; name: string } | null;
  loader2?: { id: string; name: string } | null;
}

export interface QuickViewTripExpense {
  id: string;
  amount: string;
  payment_method?: string;
  description?: string | null;
  category?: { id: string; name: string } | null;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: '💵 Наличные водителю',
  card_driver: '💳 Перевод водителю',
  qr: '📱 QR / СБП',
  bank: '🏛️ Б/Н расчетный счет',
  debt_cash: '⏳ Долг (нал)',
  debt_bank: '⏳ Долг (б/н)',
  debt: '⏳ Долг',
};

export function TripViewOrdersExpenses({
  tripNumber,
  driverName,
  loader1Name,
  loader2Name,
  activeOrders,
  expenses,
  currentUser,
  isCurrentDriver,
  totalRevenue,
  totalPayroll,
  totalExpenses,
  netMargin,
}: {
  tripNumber: number | string;
  driverName?: string | null;
  loader1Name: string | null;
  loader2Name: string | null;
  activeOrders: QuickViewTripOrder[];
  expenses: QuickViewTripExpense[];
  currentUser?: PayrollUser;
  isCurrentDriver: boolean;
  totalRevenue: number;
  totalPayroll: number;
  totalExpenses: number;
  netMargin: number;
}) {
  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-indigo-600">
              receipt_long
            </span>
            Заказы и точки в рейсе ({activeOrders.length})
          </span>
          <span className="text-xs font-black text-slate-900">
            Выручка: {totalRevenue.toLocaleString('ru-RU')} ₽
          </span>
        </div>

        {activeOrders.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 font-medium">
            Заказы не внесены
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {activeOrders.map((o, idx) => {
              const clientName = o.counterparty?.name || 'Клиент без названия';
              const orderAmt = parseFloat(o.amount || '0');
              const dPay = parseFloat(o.driver_pay || '0');
              const lPay1 = parseFloat(o.loader_pay || '0');
              const lPay2 = parseFloat(o.loader2_pay || '0');
              const payMethodLabel =
                PAYMENT_LABELS[o.payment_method || ''] || o.payment_method || '—';

              const isUserDriver = isCurrentDriver;
              const isUserLoader1 = Boolean(
                currentUser &&
                (o.loader_id === currentUser.id ||
                  (o.loader?.name &&
                    o.loader.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase())),
              );
              const isUserLoader2 = Boolean(
                currentUser &&
                (o.loader2_id === currentUser.id ||
                  (o.loader2?.name &&
                    o.loader2.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase())),
              );

              return (
                <div
                  key={o.id || idx}
                  className="p-4 hover:bg-slate-50/80 transition-colors space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-slate-900">
                          {idx + 1}. {clientName}
                        </span>
                        {o.settlement_status === 'completed' ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                            ✓ Оплачен
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                            ⏳ Ожидает оплаты
                          </span>
                        )}
                        <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {payMethodLabel}
                        </span>
                      </div>

                      {o.description && (
                        <p className="text-xs text-slate-600 font-medium">{o.description}</p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs text-slate-400 font-semibold uppercase">
                        Сумма заказа
                      </div>
                      <span className="text-sm sm:text-base font-black text-slate-900">
                        {orderAmt.toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-2.5 flex items-center justify-between gap-3 flex-wrap text-xs">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] text-emerald-600">
                        payments
                      </span>
                      Начисления за заказ:
                    </span>

                    <div className="flex items-center gap-3 flex-wrap font-medium">
                      {dPay > 0 && (
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-md border text-[11px]',
                            isUserDriver
                              ? 'bg-emerald-100/90 border-emerald-300 text-emerald-950 font-black ring-1 ring-emerald-400'
                              : 'bg-white border-slate-200 text-slate-700',
                          )}
                          title={`Водитель: ${driverName || 'Водитель'}`}
                        >
                          Водителю: <b>+{dPay.toLocaleString('ru-RU')} ₽</b>
                          {isUserDriver && ' (Вы)'}
                        </span>
                      )}

                      {lPay1 > 0 && (
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-md border text-[11px]',
                            isUserLoader1
                              ? 'bg-emerald-100/90 border-emerald-300 text-emerald-950 font-black ring-1 ring-emerald-400'
                              : 'bg-white border-slate-200 text-slate-700',
                          )}
                          title={`Грузчик: ${o.loader?.name || loader1Name || 'Грузчик'}`}
                        >
                          Грузчику ({o.loader?.name || loader1Name || '1'}):{' '}
                          <b>+{lPay1.toLocaleString('ru-RU')} ₽</b>
                          {isUserLoader1 && ' (Вы)'}
                        </span>
                      )}

                      {lPay2 > 0 && (
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-md border text-[11px]',
                            isUserLoader2
                              ? 'bg-emerald-100/90 border-emerald-300 text-emerald-950 font-black ring-1 ring-emerald-400'
                              : 'bg-white border-slate-200 text-slate-700',
                          )}
                          title={`Второй грузчик: ${o.loader2?.name || loader2Name || 'Грузчик 2'}`}
                        >
                          Грузчику ({o.loader2?.name || loader2Name || '2'}):{' '}
                          <b>+{lPay2.toLocaleString('ru-RU')} ₽</b>
                          {isUserLoader2 && ' (Вы)'}
                        </span>
                      )}

                      {dPay === 0 && lPay1 === 0 && lPay2 === 0 && (
                        <span className="text-slate-400 text-[11px]">ЗП не задана</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {expenses.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-amber-600">
                local_gas_station
              </span>
              Расходы по рейсу ({expenses.length})
            </span>
            <span className="text-xs font-black text-rose-700">
              Всего расходов: {totalExpenses.toLocaleString('ru-RU')} ₽
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {expenses.map((e, idx) => (
              <div
                key={e.id || idx}
                className="p-3.5 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>{e.category?.name || 'Расход'}</span>
                    {e.description && (
                      <span className="text-slate-500 font-normal">— {e.description}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Оплата:{' '}
                    {e.payment_method ? PAYMENT_LABELS[e.payment_method] || e.payment_method : '—'}
                  </span>
                </div>
                <div className="text-right font-black text-rose-600">
                  -&nbsp;{parseFloat(e.amount || '0').toLocaleString('ru-RU')} ₽
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-slate-900 text-white rounded-2xl p-4.5 space-y-3 shadow-md">
        <div className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[15px] text-indigo-400">analytics</span>
          Финансовые итоги рейса #{tripNumber}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Выручка</div>
            <div className="text-sm sm:text-base font-black text-white">
              {totalRevenue.toLocaleString('ru-RU')} ₽
            </div>
          </div>

          <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Всего ЗП</div>
            <div className="text-sm sm:text-base font-black text-emerald-400">
              {totalPayroll.toLocaleString('ru-RU')} ₽
            </div>
          </div>

          <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Расходы</div>
            <div className="text-sm sm:text-base font-black text-rose-400">
              {totalExpenses.toLocaleString('ru-RU')} ₽
            </div>
          </div>

          <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Маржа рейса</div>
            <div
              className={cn(
                'text-sm sm:text-base font-black',
                netMargin >= 0 ? 'text-indigo-300' : 'text-rose-400',
              )}
            >
              {netMargin.toLocaleString('ru-RU')} ₽
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
