'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Money, cn } from '@saldacargo/ui';
import { formatPhone } from '@saldacargo/shared';

export interface ActiveHold {
  id: string;
  driver_id: string;
  driver_name: string;
  driver_phone: string;
  amount: number;
  note: string;
  created_at: string;
  transaction_date?: string;
}

export interface DriverAccountableStat {
  id: string;
  name: string;
  phone: string | null;
  asset: string | null;
  cash_in: number;
  cash_spent: number;
  cash_collected: number;
  calc_balance: number;
  hold_amount: number;
  total_on_hands: number;
  holds: ActiveHold[];
}

export interface RecentCollection {
  id: string;
  amount: number;
  note: string | null;
  created_at: string;
  driver_id: string;
  driver_name: string;
  collector_name: string;
}

export interface AccountableApiResponse {
  summary: {
    total_hold_amount: number;
    total_calc_cash: number;
    total_active_holds_count: number;
    drivers_with_holds_count: number;
    drivers_with_funds_count: number;
  };
  holds: ActiveHold[];
  drivers: DriverAccountableStat[];
  recent_collections: RecentCollection[];
}

export function AccountableSection() {
  const qc = useQueryClient();
  const [subView, setSubView] = useState<'holds' | 'calc' | 'history'>('holds');
  const [collectHoldTarget, setCollectHoldTarget] = useState<ActiveHold | null>(null);
  const [collectCashTarget, setCollectCashTarget] = useState<DriverAccountableStat | null>(null);
  const [showCreateHoldModal, setShowCreateHoldModal] = useState(false);

  const { data, isLoading, refetch } = useQuery<AccountableApiResponse>({
    queryKey: ['staff-accountable'],
    queryFn: () => fetch('/api/staff/accountable').then((r) => r.json()),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const summary = data?.summary ?? {
    total_hold_amount: 0,
    total_calc_cash: 0,
    total_active_holds_count: 0,
    drivers_with_holds_count: 0,
    drivers_with_funds_count: 0,
  };

  const holds = data?.holds ?? [];
  const allDrivers = data?.drivers ?? [];
  const driversWithFunds = allDrivers.filter((d) => d.hold_amount > 0 || d.calc_balance > 0);
  const recentCollections = data?.recent_collections ?? [];

  return (
    <div className="space-y-4">
      {/* ── Верхние карточки статистики подотчёта ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-amber-500/10 border-2 border-amber-300 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-900">
              Зафиксировано на руках (Holds)
            </span>
            <span className="text-xl">💵</span>
          </div>
          <p className="text-2xl font-black text-amber-950 mt-1">
            <Money amount={summary.total_hold_amount.toFixed(2)} />
          </p>
          <p className="text-xs text-amber-800 font-medium mt-0.5">
            {summary.total_active_holds_count === 0
              ? 'Нет активных переносов'
              : `${summary.total_active_holds_count} ${summary.total_active_holds_count === 1 ? 'перенос' : 'переноса'} у ${summary.drivers_with_holds_count} водителей`}
          </p>
        </div>

        <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-sky-900">
              Расчётный остаток по рейсам
            </span>
            <span className="text-xl">🚛</span>
          </div>
          <p className="text-2xl font-black text-sky-950 mt-1">
            <Money amount={summary.total_calc_cash.toFixed(2)} />
          </p>
          <p className="text-xs text-sky-700 font-medium mt-0.5">
            Наличные с заказов минус расходы по сменам
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Действия с подотчётом
            </span>
            <button
              onClick={() => refetch()}
              className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
              title="Обновить данные"
            >
              🔄
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => setShowCreateHoldModal(true)}
              className="w-full bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-black text-xs py-2 px-3 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>+</span>
              <span>Зафиксировать перенос</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Переключатель подвкладок ── */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setSubView('holds')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer',
              subView === 'holds'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-amber-300 hover:text-amber-800',
            )}
          >
            <span>Остатки на руках (Переносы)</span>
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.2 rounded-full font-black',
                subView === 'holds' ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-900',
              )}
            >
              {holds.length}
            </span>
          </button>

          <button
            onClick={() => setSubView('calc')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer',
              subView === 'calc'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-sky-300 hover:text-sky-800',
            )}
          >
            <span>Баланс налички по водителям</span>
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.2 rounded-full font-black',
                subView === 'calc' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600',
              )}
            >
              {driversWithFunds.length}
            </span>
          </button>

          <button
            onClick={() => setSubView('history')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer',
              subView === 'history'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800',
            )}
          >
            <span>История инкассаций</span>
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.2 rounded-full font-black',
                subView === 'history' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600',
              )}
            >
              {recentCollections.length}
            </span>
          </button>
        </div>
      </div>

      {/* ── Содержимое подвкладок ── */}
      {isLoading ? (
        <div className="h-48 bg-slate-100 rounded-2xl animate-pulse" />
      ) : subView === 'holds' ? (
        /* Вкладка 1: Зафиксированные переносы */
        <div className="space-y-3">
          {holds.length === 0 ? (
            <div className="bg-white border border-amber-200 rounded-2xl p-8 text-center shadow-xs">
              <span className="text-4xl block mb-2">🎉</span>
              <p className="font-extrabold text-slate-800 text-base">Все наличные сданы в кассу!</p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Нет незакрытых переносов смены. Если водитель оставил наличные у себя на следующий
                день, зафиксируйте перенос кнопкой выше.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {holds.map((hold) => (
                <div
                  key={hold.id}
                  className="bg-white border-2 border-amber-300 rounded-2xl p-4 shadow-xs flex flex-col justify-between gap-3 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-base">
                          {hold.driver_name}
                        </span>
                        {hold.driver_phone && (
                          <span className="text-xs text-slate-400 font-mono">
                            {formatPhone(hold.driver_phone)}
                          </span>
                        )}
                      </div>
                      {hold.note && (
                        <p className="text-xs text-slate-600 mt-1 font-medium bg-amber-50/70 border border-amber-200/60 rounded-lg px-2.5 py-1">
                          📝 {hold.note}
                        </p>
                      )}
                      <p className="text-[11px] text-amber-800/80 font-bold mt-1.5">
                        Зафиксировано:{' '}
                        {new Date(hold.created_at).toLocaleString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-2xl font-black text-amber-950">
                        <Money amount={hold.amount.toFixed(2)} />
                      </p>
                      <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        На руках
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-amber-100 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-400">Сдать остаток в Сейф / Кассу</span>
                    <button
                      onClick={() => setCollectHoldTarget(hold)}
                      className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-xs px-4 py-2 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>📥</span>
                      <span>Принять в кассу</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : subView === 'calc' ? (
        /* Вкладка 2: Расчётный подотчёт по всем водителям */
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Водитель</th>
                  <th className="py-3 px-3 text-right">Нал с заказов</th>
                  <th className="py-3 px-3 text-right">Расходы нал</th>
                  <th className="py-3 px-3 text-right">Сдано в кассу</th>
                  <th className="py-3 px-3 text-right">Зафиксирован Hold</th>
                  <th className="py-3 px-4 text-right">Расчётный остаток</th>
                  <th className="py-3 px-4 text-center">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {driversWithFunds.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                      Нет активных остатков на руках у водителей
                    </td>
                  </tr>
                ) : (
                  driversWithFunds.map((d) => (
                    <tr
                      key={d.id}
                      className={cn(
                        'hover:bg-slate-50/80 transition-colors',
                        d.hold_amount > 0 ? 'bg-amber-50/20' : '',
                      )}
                    >
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div>
                          <span>{d.name}</span>
                          {d.asset && (
                            <span className="text-[10px] font-mono font-medium text-slate-400 ml-2">
                              {d.asset}
                            </span>
                          )}
                        </div>
                        {d.phone && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            {formatPhone(d.phone)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-slate-700">
                        <Money amount={d.cash_in.toFixed(2)} />
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-rose-600">
                        {d.cash_spent > 0 ? (
                          <>
                            -<Money amount={d.cash_spent.toFixed(2)} />
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-emerald-600">
                        {d.cash_collected > 0 ? (
                          <Money amount={d.cash_collected.toFixed(2)} />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-amber-700">
                        {d.hold_amount > 0 ? (
                          <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-lg border border-amber-300">
                            <Money amount={d.hold_amount.toFixed(2)} />
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-base text-slate-900">
                        <Money amount={d.calc_balance.toFixed(2)} />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setCollectCashTarget(d)}
                          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs"
                        >
                          Инкассировать
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Вкладка 3: История последних инкассаций */
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Дата и время</th>
                  <th className="py-3 px-4">Водитель</th>
                  <th className="py-3 px-4 text-right">Сумма инкассации</th>
                  <th className="py-3 px-4">Принял</th>
                  <th className="py-3 px-4">Примечание</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentCollections.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                      История инкассаций пуста
                    </td>
                  </tr>
                ) : (
                  recentCollections.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px]">
                        {new Date(c.created_at).toLocaleString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">{c.driver_name}</td>
                      <td className="py-2.5 px-4 text-right font-black text-emerald-600 text-sm">
                        +<Money amount={c.amount.toFixed(2)} />
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 font-medium">{c.collector_name}</td>
                      <td className="py-2.5 px-4 text-slate-500 italic">
                        {c.note || 'Закрытие подотчёта'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Модалка приёма зафиксированного переноса (Hold) ── */}
      {collectHoldTarget && (
        <CollectHoldModal
          hold={collectHoldTarget}
          onClose={() => setCollectHoldTarget(null)}
          onSuccess={() => {
            setCollectHoldTarget(null);
            qc.invalidateQueries({ queryKey: ['staff-accountable'] });
            qc.invalidateQueries({ queryKey: ['staff-payroll'] });
            qc.invalidateQueries({ queryKey: ['wallets'] });
          }}
        />
      )}

      {/* ── Модалка инкассации наличных водителя ── */}
      {collectCashTarget && (
        <CollectCashModal
          driver={collectCashTarget}
          onClose={() => setCollectCashTarget(null)}
          onSuccess={() => {
            setCollectCashTarget(null);
            qc.invalidateQueries({ queryKey: ['staff-accountable'] });
            qc.invalidateQueries({ queryKey: ['staff-payroll'] });
            qc.invalidateQueries({ queryKey: ['wallets'] });
          }}
        />
      )}

      {/* ── Модалка фиксации переноса подотчёта ── */}
      {showCreateHoldModal && (
        <CreateHoldModal
          drivers={allDrivers}
          onClose={() => setShowCreateHoldModal(false)}
          onSuccess={() => {
            setShowCreateHoldModal(false);
            qc.invalidateQueries({ queryKey: ['staff-accountable'] });
            qc.invalidateQueries({ queryKey: ['staff-payroll'] });
            qc.invalidateQueries({ queryKey: ['wallets'] });
          }}
        />
      )}
    </div>
  );
}

// ─── Модалка приёма зафиксированного переноса ───────────────────────────────

function CollectHoldModal({
  hold,
  onClose,
  onSuccess,
}: {
  hold: ActiveHold;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState(hold.amount.toString());
  const [walletId, setWalletId] = useState('10000000-0000-0000-0000-000000000002'); // Сейф
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      fetch('/api/staff/accountable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'collect_hold',
          hold_id: hold.id,
          collected_amount: parseFloat(amount.replace(',', '.')),
          wallet_id: walletId,
          note: note.trim() || undefined,
        }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Ошибка приёма');
        return d;
      }),
    onSuccess,
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      setError('Введите корректную сумму');
      return;
    }
    setError('');
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50/60">
          <div>
            <h2 className="font-extrabold text-slate-900 text-base">📥 Принять подотчёт в кассу</h2>
            <p className="text-xs text-slate-500">{hold.driver_name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-xl text-xs font-bold">
              {error}
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
            <div className="flex justify-between">
              <span>Зафиксированный остаток:</span>
              <span className="font-black text-amber-950">
                <Money amount={hold.amount.toFixed(2)} />
              </span>
            </div>
            {hold.note && <p className="mt-1 text-[11px] text-amber-800">«{hold.note}»</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Сумма приёма в кассу (₽)
            </label>
            <input
              type="number"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-base focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Куда зачислить</label>
            <select
              value={walletId}
              onChange={(e) => setWalletId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold bg-white outline-none"
            >
              <option value="10000000-0000-0000-0000-000000000002">Сейф (Наличные офиса)</option>
              <option value="10000000-0000-0000-0000-000000000001">Расчётный счёт</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Примечание (необязательно)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none"
              placeholder="Сдано полностью / Частично"
            />
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {mutation.isPending ? 'Приём...' : 'Подтвердить приём'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Модалка инкассации наличных водителя (произвольная сумма) ──────────────

function CollectCashModal({
  driver,
  onClose,
  onSuccess,
}: {
  driver: DriverAccountableStat;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState(
    driver.calc_balance > 0 ? driver.calc_balance.toString() : '',
  );
  const [walletId, setWalletId] = useState('10000000-0000-0000-0000-000000000002'); // Сейф
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      fetch('/api/staff/accountable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'collect_cash',
          driver_id: driver.id,
          amount: parseFloat(amount.replace(',', '.')),
          wallet_id: walletId,
          note: note.trim() || undefined,
        }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Ошибка инкассации');
        return d;
      }),
    onSuccess,
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      setError('Введите корректную сумму');
      return;
    }
    setError('');
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div>
            <h2 className="font-extrabold text-base">Инкассация наличных</h2>
            <p className="text-xs text-slate-300">{driver.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-xl text-xs font-bold">
              {error}
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>Расчётный остаток на руках:</span>
              <span className="font-bold text-slate-900">
                <Money amount={driver.calc_balance.toFixed(2)} />
              </span>
            </div>
            {driver.hold_amount > 0 && (
              <div className="flex justify-between text-amber-800">
                <span>Зафиксированный перенос:</span>
                <span className="font-bold text-amber-900">
                  <Money amount={driver.hold_amount.toFixed(2)} />
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Сумма к сдаче в кассу (₽)
            </label>
            <input
              type="number"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-base focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Касса зачисления</label>
            <select
              value={walletId}
              onChange={(e) => setWalletId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold bg-white outline-none"
            >
              <option value="10000000-0000-0000-0000-000000000002">Сейф (Наличные)</option>
              <option value="10000000-0000-0000-0000-000000000001">Расчётный счёт</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Примечание</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none"
              placeholder="Инкассация за рейсы"
            />
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {mutation.isPending ? 'Запись...' : 'Сдать в кассу'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Модалка фиксации переноса подотчёта (Hold) ─────────────────────────────

function CreateHoldModal({
  drivers,
  onClose,
  onSuccess,
}: {
  drivers: DriverAccountableStat[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [driverId, setDriverId] = useState(drivers[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      fetch('/api/staff/accountable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_hold',
          driver_id: driverId,
          amount: parseFloat(amount.replace(',', '.')),
          note: note.trim() || undefined,
        }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Ошибка фиксации');
        return d;
      }),
    onSuccess,
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverId) {
      setError('Выберите водителя');
      return;
    }
    const val = parseFloat(amount.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      setError('Введите сумму больше нуля');
      return;
    }
    setError('');
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-amber-500 text-white">
          <div>
            <h2 className="font-extrabold text-base">Зафиксировать остаток подотчёта</h2>
            <p className="text-xs text-amber-100">Перенос наличных на следующий день</p>
          </div>
          <button
            onClick={onClose}
            className="text-amber-200 hover:text-white text-xl font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-xl text-xs font-bold">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Водитель</label>
            <select
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold bg-white outline-none"
              required
            >
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.asset ? `(${d.asset})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Сумма переноса (₽)
            </label>
            <input
              type="number"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-base focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Причина / Комментарий
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none"
              placeholder="Поздний возврат, перенос на завтра"
            />
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {mutation.isPending ? 'Сохранение...' : 'Зафиксировать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
