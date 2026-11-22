'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { cn } from '@saldacargo/ui';
import type { PayrollUser, StaffTx } from '../types';
import { classifyStaffTx } from '../utils';
import { ServiceOrderViewModal } from '../modals/ServiceOrderViewModal';
import { TripViewModal } from '../modals/TripViewModal';
import { filterStaffAdvances, groupStaffAccruals } from './historyGrouping';
import { PayrollHistoryAccrualsTab } from './PayrollHistoryAccrualsTab';

export function PayrollHistoryModal({
  user,
  onClose,
  onChanged,
  onOpenPayslip,
}: {
  user: PayrollUser;
  onClose: () => void;
  onSettle?: () => void;
  onChanged: () => void;
  onOpenPayslip?: (u: PayrollUser) => void;
}) {
  const [activeTab, setActiveTab] = useState<'accruals' | 'payouts' | 'advances'>('accruals');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [viewingOrderId, setViewingOrderId] = useState<string | null>(null);
  const [viewingTripId, setViewingTripId] = useState<string | null>(null);
  const backdropRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewingOrderId || viewingTripId) return;
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, viewingOrderId, viewingTripId]);

  const history = useMemo(() => (user.history ?? []) as StaffTx[], [user.history]);

  const accruals = useMemo(
    () => history.filter((t) => classifyStaffTx(t).type === 'accrual'),
    [history],
  );
  const payouts = useMemo(
    () => history.filter((t) => classifyStaffTx(t).type === 'payout'),
    [history],
  );
  const advancesHistory = useMemo(() => filterStaffAdvances(history), [history]);

  const totalAdvancesGiven = useMemo(
    () =>
      advancesHistory
        .filter((t) => t.direction === 'expense')
        .reduce((sum, t) => sum + (parseFloat(t.amount || '0') || 0), 0),
    [advancesHistory],
  );

  const totalAdvancesOffset = useMemo(
    () =>
      advancesHistory
        .filter((t) => t.direction === 'income')
        .reduce((sum, t) => sum + (parseFloat(t.amount || '0') || 0), 0),
    [advancesHistory],
  );

  const groupedAccruals = useMemo(() => groupStaffAccruals(accruals), [accruals]);
  const advanceDebt = parseFloat(user.advance_balance || '0') || 0;

  const toggleGroup = (key: string) =>
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  async function handleSave(txId: string) {
    const val = parseFloat(editAmount);
    if (isNaN(val) || val < 0) {
      setError('Некорректная сумма');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const r = await fetch(`/api/staff/transactions/${txId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: val.toFixed(2) }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? 'Ошибка');
      setEditingId(null);
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(txId: string, label: string) {
    if (!confirm(`Удалить запись «${label}»? Это действие необратимо.`)) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/staff/transactions/${txId}`, { method: 'DELETE' });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? 'Ошибка');
      onChanged();
    } catch (e: unknown) {
      alert('Ошибка: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
        onMouseDown={(e) => {
          backdropRef.current = e.target === e.currentTarget;
        }}
        onMouseUp={(e) => {
          if (backdropRef.current && e.target === e.currentTarget) onClose();
          backdropRef.current = false;
        }}
      >
        <div
          className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-800 text-2xl">payments</span>
              <h2 className="font-black text-slate-900 text-lg">
                Поступления и выплаты: {user.name}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {onOpenPayslip && (
                <button
                  type="button"
                  onClick={() => onOpenPayslip(user)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                  title="Сформировать печатный расчётный листок"
                >
                  <span>📄</span>
                  <span>Расчётный лист</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 text-xl leading-none transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="flex border-b border-slate-200 bg-white px-6 shrink-0 gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('accruals')}
              className={cn(
                'py-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer',
                activeTab === 'accruals'
                  ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-xl'
                  : 'border-transparent text-slate-500 hover:text-slate-800',
              )}
            >
              <span className="material-symbols-outlined text-[18px]">receipt_long</span>
              <span>Начисления</span>
              <span
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full font-extrabold',
                  activeTab === 'accruals'
                    ? 'bg-emerald-200 text-emerald-900'
                    : 'bg-slate-100 text-slate-600',
                )}
              >
                {groupedAccruals.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('payouts')}
              className={cn(
                'py-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer',
                activeTab === 'payouts'
                  ? 'border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-xl'
                  : 'border-transparent text-slate-500 hover:text-slate-800',
              )}
            >
              <span className="material-symbols-outlined text-[18px]">payments</span>
              <span>Выплаты ЗП</span>
              <span
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full font-extrabold',
                  activeTab === 'payouts'
                    ? 'bg-blue-200 text-blue-900'
                    : 'bg-slate-100 text-slate-600',
                )}
              >
                {payouts.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('advances')}
              className={cn(
                'py-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer',
                activeTab === 'advances'
                  ? 'border-purple-600 text-purple-700 bg-purple-50/50 rounded-t-xl'
                  : 'border-transparent text-slate-500 hover:text-slate-800',
              )}
            >
              <span className="material-symbols-outlined text-[18px]">savings</span>
              <span>Авансы и займы</span>
              <span
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full font-extrabold',
                  advanceDebt > 0
                    ? 'bg-rose-100 text-rose-700 font-black'
                    : activeTab === 'advances'
                      ? 'bg-purple-200 text-purple-900'
                      : 'bg-slate-100 text-slate-600',
                )}
              >
                {advanceDebt > 0
                  ? `${advanceDebt.toLocaleString('ru-RU')} ₽`
                  : advancesHistory.length}
              </span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-slate-100/50">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-xs font-bold">
                {error}
              </div>
            )}

            {activeTab === 'accruals' && (
              <PayrollHistoryAccrualsTab
                user={user}
                groupedAccruals={groupedAccruals}
                expandedGroups={expandedGroups}
                editingId={editingId}
                editAmount={editAmount}
                saving={saving}
                onToggleGroup={toggleGroup}
                onViewOrder={setViewingOrderId}
                onViewTrip={setViewingTripId}
                onStartEdit={(id, amt) => {
                  setEditingId(id);
                  setEditAmount(String(amt));
                }}
                onCancelEdit={() => setEditingId(null)}
                onEditAmountChange={setEditAmount}
                onSaveEdit={handleSave}
                onDelete={handleDelete}
              />
            )}

            {activeTab === 'payouts' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    История выплат ЗП сотруднику
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    Всего {payouts.length} выплат
                  </span>
                </div>

                {payouts.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                    <span className="material-symbols-outlined text-4xl mb-2 text-slate-300">
                      payments
                    </span>
                    <p className="text-sm font-medium">Нет зарегистрированных выплат ЗП</p>
                  </div>
                ) : (
                  payouts.map((tx) => {
                    const d = tx.transaction_date || tx.created_at;
                    const dateStr = d
                      ? new Date(d).toLocaleString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—';
                    const walletName =
                      tx.from_wallet?.name ||
                      (tx.description?.includes('Касса')
                        ? '💵 Сейф (Наличные)'
                        : tx.description?.includes('Р/С') || tx.description?.includes('Банк')
                          ? '🏦 Р/С (Банк)'
                          : '💵 Кошелек');

                    return (
                      <div
                        key={tx.id}
                        className="bg-white rounded-2xl p-4.5 border border-slate-200 shadow-xs flex items-start justify-between gap-4 hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
                            <span className="material-symbols-outlined text-[20px]">payments</span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full border border-blue-200">
                                {walletName}
                              </span>
                              <span className="text-xs text-slate-400 font-medium">{dateStr}</span>
                            </div>
                            <p className="text-sm font-bold text-slate-900 leading-snug">
                              {tx.description || 'Выплата заработной платы'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-lg font-black text-blue-600">
                            -&nbsp;{parseFloat(tx.amount || '0').toLocaleString('ru-RU')} ₽
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === 'advances' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-purple-50 rounded-2xl p-4 border border-purple-200">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700 block">
                      Текущий долг по авансу
                    </span>
                    <span className="text-2xl font-black text-purple-900 mt-1 block">
                      {advanceDebt.toLocaleString('ru-RU')} ₽
                    </span>
                    <span className="text-[10px] text-purple-600 font-medium">
                      {advanceDebt > 0 ? 'Сотрудник должен компании' : 'Долгов по авансам нет'}
                    </span>
                  </div>

                  <div className="bg-rose-50 rounded-2xl p-4 border border-rose-200">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 block">
                      Всего выдано займов
                    </span>
                    <span className="text-2xl font-black text-rose-700 mt-1 block">
                      + {totalAdvancesGiven.toLocaleString('ru-RU')} ₽
                    </span>
                    <span className="text-[10px] text-rose-600 font-medium">
                      Все выданные авансы за всё время
                    </span>
                  </div>

                  <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 block">
                      Всего удержано / погашено
                    </span>
                    <span className="text-2xl font-black text-emerald-700 mt-1 block">
                      - {totalAdvancesOffset.toLocaleString('ru-RU')} ₽
                    </span>
                    <span className="text-[10px] text-emerald-600 font-medium">
                      Зачтено из зарплаты или возвращено
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between px-1 pt-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Хронология движения авансов и займов
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    Всего {advancesHistory.length} операций
                  </span>
                </div>

                {advancesHistory.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                    <span className="material-symbols-outlined text-4xl mb-2 text-slate-300">
                      savings
                    </span>
                    <p className="text-sm font-medium">История авансов и займов пуста</p>
                  </div>
                ) : (
                  advancesHistory.map((tx) => {
                    const isGiven = tx.direction === 'expense';
                    const amt = parseFloat(tx.amount || '0') || 0;
                    const d = tx.transaction_date || tx.created_at;
                    const dateStr = d
                      ? new Date(d).toLocaleString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—';

                    return (
                      <div
                        key={tx.id}
                        className={cn(
                          'rounded-2xl p-4.5 shadow-xs border flex items-start justify-between gap-4 transition-all group',
                          isGiven
                            ? 'bg-purple-50/50 border-purple-200 hover:border-purple-300'
                            : 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-300',
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              'w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 mt-0.5',
                              isGiven
                                ? 'bg-purple-100 border-purple-300 text-purple-700'
                                : 'bg-emerald-100 border-emerald-300 text-emerald-700',
                            )}
                          >
                            <span className="material-symbols-outlined text-[20px]">
                              {isGiven ? 'add_circle' : 'check_circle'}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={cn(
                                  'text-xs font-black px-2.5 py-0.5 rounded-full border',
                                  isGiven
                                    ? 'bg-purple-100 text-purple-800 border-purple-200'
                                    : 'bg-emerald-100 text-emerald-800 border-emerald-200',
                                )}
                              >
                                {isGiven ? '➕ Выдан аванс / займ' : '➖ Зачёт аванса в ЗП'}
                              </span>
                              <span className="text-xs text-slate-400 font-medium">{dateStr}</span>
                            </div>
                            <p className="text-sm font-bold text-slate-900 leading-snug">
                              {tx.description || (isGiven ? 'Выдача аванса' : 'Зачёт аванса')}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                          <span
                            className={cn(
                              'text-lg font-black tracking-tight',
                              isGiven ? 'text-purple-700' : 'text-emerald-700',
                            )}
                          >
                            {isGiven ? '+' : '−'} {amt.toLocaleString('ru-RU')} ₽
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDelete(tx.id, tx.description || 'Аванс')}
                            disabled={saving}
                            className="text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-white"
                            title="Удалить запись"
                          >
                            <span className="material-symbols-outlined text-[15px]">delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {viewingOrderId && (
        <ServiceOrderViewModal orderId={viewingOrderId} onClose={() => setViewingOrderId(null)} />
      )}
      {viewingTripId && (
        <TripViewModal
          tripId={viewingTripId}
          currentUser={user}
          onClose={() => setViewingTripId(null)}
        />
      )}
    </>
  );
}
