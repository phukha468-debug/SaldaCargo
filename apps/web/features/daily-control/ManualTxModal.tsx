'use client';

import { useState } from 'react';
import type { CategoryItem, PaymentCalendarItem, TripOrderTx } from './types';
import type { CreateManualPayload } from './useDailyControlData';
import { getFilteredCategories, rub } from './utils';

export function ManualTxModal({
  initialType,
  categories,
  calendarItems,
  tripOrders,
  isPending,
  errorMessage,
  onSubmit,
  onClose,
}: {
  initialType: 'expense' | 'income';
  categories: CategoryItem[];
  calendarItems: PaymentCalendarItem[];
  tripOrders: TripOrderTx[];
  isPending: boolean;
  errorMessage?: string | null;
  onSubmit: (payload: CreateManualPayload) => void;
  onClose: () => void;
}) {
  const [manualType, setManualType] = useState<'expense' | 'income'>(initialType);
  const [manualAmount, setManualAmount] = useState('');
  const [manualWallet, setManualWallet] = useState<'safe' | 'bank' | 'fuel'>(
    initialType === 'expense' ? 'safe' : 'bank',
  );
  const [manualCategoryId, setManualCategoryId] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualObligationId, setManualObligationId] = useState('');
  const [manualTripOrderId, setManualTripOrderId] = useState('');

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-2xl max-w-lg w-full overflow-hidden">
        <div
          className={`px-5 py-4 text-white flex items-center justify-between transition-colors ${
            manualType === 'expense'
              ? 'bg-gradient-to-r from-rose-500 to-rose-600'
              : 'bg-gradient-to-r from-emerald-500 to-emerald-600'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{manualType === 'expense' ? '💸' : '💰'}</span>
            <div>
              <h3 className="text-sm font-black tracking-tight">
                {manualType === 'expense' ? 'Внести списание вручную' : 'Внести пополнение вручную'}
              </h3>
              <p className="text-[11px] text-white/80">
                {manualType === 'expense'
                  ? 'Расход по кассе сейфа, банку или топливной карте'
                  : 'Поступление выручки нал/безнал или возврат'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-sm font-black cursor-pointer transition"
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              manualType,
              manualAmount,
              manualWallet,
              manualCategoryId,
              manualDescription,
              manualObligationId,
              manualTripOrderId,
            });
          }}
          className="p-5 space-y-4 text-xs"
        >
          <div>
            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
              Тип операции
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl border-2 border-slate-200">
              <button
                type="button"
                onClick={() => setManualType('expense')}
                className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  manualType === 'expense'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                − Списание (Расход)
              </button>
              <button
                type="button"
                onClick={() => {
                  setManualType('income');
                  if (manualWallet === 'fuel') setManualWallet('safe');
                }}
                className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  manualType === 'income'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                + Пополнение (Доход)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
              Сумма операции (₽) *
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                required
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-4 pr-12 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-2xl text-base font-black font-mono text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono font-black text-slate-400">
                ₽
              </span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
              Кошелёк / Счёт *
            </label>
            <select
              value={manualWallet}
              onChange={(e) => setManualWallet(e.target.value as 'safe' | 'bank' | 'fuel')}
              className="w-full px-3 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white cursor-pointer"
            >
              <option value="safe">🔒 Сейф кассы (Наличные)</option>
              <option value="bank">🏦 Р/С Т-Банк (Безналичные)</option>
              {manualType === 'expense' && (
                <option value="fuel">⛽ Топливная карта Газпромнефть</option>
              )}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
              Статья / Категория
            </label>
            <select
              value={manualCategoryId}
              onChange={(e) => setManualCategoryId(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white cursor-pointer"
            >
              <option value="">(Выберите категорию)</option>
              {getFilteredCategories(categories, manualType, manualCategoryId).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
              Описание / Контрагент / Примечание *
            </label>
            <input
              type="text"
              required
              value={manualDescription}
              onChange={(e) => setManualDescription(e.target.value)}
              placeholder="Например: Заправка Газель А777АА или Сдача наличных водителем"
              className="w-full px-3.5 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white"
            />
          </div>

          {manualType === 'expense' ? (
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <span>📅</span> Связать с Планом платежей (отметить оплаченным)
              </label>
              <select
                value={manualObligationId}
                onChange={(e) => setManualObligationId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white cursor-pointer"
              >
                <option value="">Без привязки к плану</option>
                {calendarItems.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.title} — {rub(o.amount)} (до {o.due_day}-го числа)
                    {o.status === 'paid' ? ' [✓ Оплачен]' : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <span>🚚</span> Привязать к заказу рейса за сегодня
              </label>
              <select
                value={manualTripOrderId}
                onChange={(e) => setManualTripOrderId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white cursor-pointer"
              >
                <option value="">Без привязки к рейсу</option>
                {tripOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.trip?.trip_number ? `Рейс №${o.trip.trip_number}` : 'Рейс'} (
                    {o.trip?.driver?.name || 'Водитель'}) — {rub(o.amount)}
                    {o.counterparty?.name ? ` · ${o.counterparty.name}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-700 text-xs font-bold">
              {errorMessage}
            </div>
          )}

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black cursor-pointer transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isPending || !manualAmount || !manualDescription.trim()}
              className={`px-5 py-2.5 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer transition disabled:opacity-50 ${
                manualType === 'expense'
                  ? 'bg-rose-600 hover:bg-rose-500'
                  : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              {isPending
                ? 'Сохранение...'
                : manualType === 'expense'
                  ? 'Сохранить списание'
                  : 'Сохранить пополнение'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
