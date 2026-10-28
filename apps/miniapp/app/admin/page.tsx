/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Money } from '@saldacargo/ui';
import { performLogout } from '@/lib/auth/logout';

type Wallets = {
  bank: { id: string; name: string; balance: string };
  cash: { id: string; name: string; balance: string };
  fuel_card?: { id: string; name: string; balance: string };
  garage?: { id: string; name: string; balance: string };
};

const WALLET_OPTIONS = [
  { id: '10000000-0000-0000-0000-000000000001', label: 'Расчётный счёт' },
  { id: '10000000-0000-0000-0000-000000000002', label: 'Сейф (Наличные)' },
];

export default function AdminDashboard() {
  const qc = useQueryClient();
  const [showTransfer, setShowTransfer] = useState(false);

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => fetch('/api/driver/me').then((r) => r.json()),
    staleTime: 300000,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery<any>({
    queryKey: ['admin-summary'],
    queryFn: () => fetch('/api/admin/summary').then((r) => r.json()),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const {
    data: wallets,
    isLoading: walletsLoading,
    isFetching: walletsFetching,
    refetch: refetchWallets,
  } = useQuery<Wallets>({
    queryKey: ['wallets'],
    queryFn: () => fetch('/api/wallets').then((r) => r.json()),
    staleTime: 30000,
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });

  const handleRefreshWallets = () => {
    fetch('/api/wallets?fresh=true')
      .then(() => refetchWallets())
      .catch(() => refetchWallets());
  };

  const totalBalance = (
    parseFloat(wallets?.bank?.balance || '0') +
    parseFloat(wallets?.cash?.balance || '0') +
    parseFloat(wallets?.fuel_card?.balance || '0')
  ).toFixed(2);

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      {/* Шапка пульта */}
      <header className="pt-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl overflow-hidden shadow-xs border border-zinc-200 flex items-center justify-center bg-white shrink-0">
            <img src="/logo.png" alt="TK501" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-zinc-900 uppercase tracking-tight">
                Пульт <span className="text-orange-600">Директора</span>
              </h1>
            </div>
            <p className="text-zinc-400 font-bold text-xs uppercase tracking-wider">
              {me?.name ?? 'Управление'}
            </p>
          </div>
        </div>

        <button
          onClick={() => performLogout()}
          className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-red-500 py-1.5 px-2.5 rounded-lg border border-zinc-200 hover:border-red-200 transition-colors"
        >
          Выйти
        </button>
      </header>

      {/* Форма перевода */}
      {showTransfer && (
        <TransferForm
          onDone={() => {
            setShowTransfer(false);
            qc.invalidateQueries({ queryKey: ['wallets'] });
          }}
          onCancel={() => setShowTransfer(false)}
        />
      )}

      {/* Главный виджет: Общий баланс компании */}
      <div className="bg-white border-2 border-zinc-200/80 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
            Капитал компании
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleRefreshWallets}
              disabled={walletsFetching}
              className="p-1 text-zinc-400 hover:text-zinc-700 transition-colors"
              title="Обновить"
            >
              <span className={`inline-block text-xs ${walletsFetching ? 'animate-spin' : ''}`}>
                🔄
              </span>
            </button>
            <button
              onClick={() => setShowTransfer((v) => !v)}
              className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg transition-colors ${
                showTransfer ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'
              }`}
            >
              ↔ Перевод
            </button>
          </div>
        </div>

        <div>
          {walletsLoading ? (
            <div className="h-9 w-48 bg-zinc-100 rounded-xl animate-pulse" />
          ) : (
            <Money
              amount={totalBalance}
              className="text-3xl font-black text-zinc-900 tracking-tight"
            />
          )}
        </div>

        {/* Счета в виде чистых плашек */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-100">
          <div className="bg-sky-50/70 border border-sky-100 rounded-xl p-2.5">
            <div className="flex items-center gap-1 text-[9px] font-black uppercase text-sky-700">
              <span>🏦</span> Р/Счёт
            </div>
            {walletsLoading ? (
              <div className="h-4 w-14 bg-sky-200/50 rounded animate-pulse mt-1" />
            ) : (
              <Money
                amount={wallets?.bank?.balance ?? '0'}
                className="text-xs font-black text-sky-900 mt-0.5 block truncate"
              />
            )}
          </div>

          <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-2.5">
            <div className="flex items-center gap-1 text-[9px] font-black uppercase text-emerald-700">
              <span>💵</span> Сейф
            </div>
            {walletsLoading ? (
              <div className="h-4 w-14 bg-emerald-200/50 rounded animate-pulse mt-1" />
            ) : (
              <Money
                amount={wallets?.cash?.balance ?? '0'}
                className="text-xs font-black text-emerald-900 mt-0.5 block truncate"
              />
            )}
          </div>

          <div className="bg-amber-50/70 border border-amber-100 rounded-xl p-2.5">
            <div className="flex items-center gap-1 text-[9px] font-black uppercase text-amber-700">
              <span>⛽</span> Топливо
            </div>
            {walletsLoading ? (
              <div className="h-4 w-14 bg-amber-200/50 rounded animate-pulse mt-1" />
            ) : (
              <Money
                amount={wallets?.fuel_card?.balance ?? '0'}
                className="text-xs font-black text-amber-900 mt-0.5 block truncate"
              />
            )}
          </div>
        </div>
      </div>

      {/* Быстрые действия: 2 большие удобные кнопки */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/admin/finance?action=income_menu"
          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl p-4 flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all shadow-sm font-black text-sm uppercase tracking-wider"
        >
          <span className="text-xl">➕</span>
          <span>Доход</span>
        </Link>
        <Link
          href="/admin/finance?action=expense_menu"
          className="bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl p-4 flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all shadow-sm font-black text-sm uppercase tracking-wider"
        >
          <span className="text-xl">➖</span>
          <span>Расход</span>
        </Link>
      </div>

      {/* Строка операционной сводки */}
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/admin/trips?filter=active"
          className="bg-white border border-zinc-200 rounded-2xl p-3 flex items-center justify-between active:bg-zinc-50 transition-colors"
        >
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
              В рейсе сейчас
            </p>
            <p className="text-xl font-black text-zinc-900 mt-0.5">
              {summaryLoading ? '...' : (summary?.activeTrips ?? 0)}
            </p>
          </div>
          <span className="text-2xl">🚛</span>
        </Link>

        <div className="bg-white border border-zinc-200 rounded-2xl p-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
              Выручка сегодня
            </p>
            {summaryLoading ? (
              <div className="h-6 w-20 bg-zinc-100 rounded animate-pulse mt-1" />
            ) : (
              <Money
                amount={summary?.todayRevenue ?? '0'}
                className="text-lg font-black text-zinc-900 mt-0.5 block truncate"
              />
            )}
          </div>
          <span className="text-2xl">📈</span>
        </div>
      </div>

      {/* Сигнальный баннер: Ревью (Авто + Гараж) */}
      {((summary?.pendingReview ?? 0) > 0 || (summary?.pendingGarageReview ?? 0) > 0) && (
        <Link
          href={
            (summary?.pendingReview ?? 0) === 0 && (summary?.pendingGarageReview ?? 0) > 0
              ? '/admin/trips?filter=review&section=garage'
              : '/admin/trips?filter=review&section=auto'
          }
          className="block bg-orange-50 border-2 border-orange-200 rounded-2xl p-3.5 active:scale-[0.98] transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📋</span>
              <div>
                <p className="font-black text-orange-950 text-sm uppercase tracking-tight">
                  Ждут ревью: Авто ({summary?.pendingReview ?? 0}) · Гараж (
                  {summary?.pendingGarageReview ?? 0})
                </p>
                <p className="text-orange-600 text-[11px] font-bold">
                  Нажмите для проверки водителей и механиков →
                </p>
              </div>
            </div>
            <span className="bg-orange-600 text-white text-xs font-black px-2.5 py-1 rounded-xl">
              {(summary?.pendingReview ?? 0) + (summary?.pendingGarageReview ?? 0)}
            </span>
          </div>
        </Link>
      )}

      {/* Секция: Остатки подотчёта на руках у водителей (переносы) */}
      <DriverCashHoldsSection />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ФОРМА ПЕРЕВОДА МЕЖДУ СЧЕТАМИ
// ─────────────────────────────────────────────────────────────────────────────
function TransferForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [from, setFrom] = useState(WALLET_OPTIONS[0]?.id ?? '');
  const [to, setTo] = useState(WALLET_OPTIONS[1]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (body: object) =>
      fetch('/api/admin/wallet-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? 'Ошибка');
        return json;
      }),
    onSuccess: onDone,
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = () => {
    setError('');
    if (!amount || parseFloat(amount) <= 0) {
      setError('Введите сумму');
      return;
    }
    if (from === to) {
      setError('Выберите разные кошельки');
      return;
    }
    mutation.mutate({ from_wallet_id: from, to_wallet_id: to, amount, description: note });
  };

  const selectCls =
    'w-full bg-white border-2 border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-zinc-400';
  const inputCls =
    'w-full bg-white border-2 border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-zinc-400';

  return (
    <div className="bg-zinc-50 border-2 border-zinc-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
          Перевод между кошельками
        </p>
        <button onClick={onCancel} className="text-xs text-zinc-400 hover:text-zinc-600 font-bold">
          ✕
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block mb-1">
            Откуда
          </label>
          <select className={selectCls} value={from} onChange={(e) => setFrom(e.target.value)}>
            {WALLET_OPTIONS.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block mb-1">
            Куда
          </label>
          <select className={selectCls} value={to} onChange={(e) => setTo(e.target.value)}>
            {WALLET_OPTIONS.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block mb-1">
            Сумма (₽)
          </label>
          <input
            type="number"
            inputMode="decimal"
            className={inputCls}
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div>
          <label className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block mb-1">
            Описание
          </label>
          <input
            type="text"
            className={inputCls}
            placeholder="Примечание"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-xs font-bold text-red-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSubmit}
          disabled={mutation.isPending}
          className="flex-1 bg-zinc-900 text-white text-xs font-black uppercase tracking-widest py-2.5 rounded-xl active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {mutation.isPending ? 'Перевод...' : 'Подтвердить перевод'}
        </button>
        <button
          onClick={onCancel}
          className="px-3 text-xs font-black text-zinc-500 uppercase tracking-widest border border-zinc-200 rounded-xl active:bg-zinc-100 transition-colors"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// СЕКЦИЯ: ОСТАТКИ ПОДОТЧЁТА НА РУКАХ У ВОДИТЕЛЕЙ (ПЕРЕНОСЫ)
// ─────────────────────────────────────────────────────────────────────────────
function DriverCashHoldsSection() {
  const qc = useQueryClient();
  const [showFixModal, setShowFixModal] = useState(false);
  const [collectTarget, setCollectTarget] = useState<any | null>(null);

  const { data: holds = [], isLoading } = useQuery<any[]>({
    queryKey: ['admin-driver-cash-holds'],
    queryFn: () => fetch('/api/admin/driver-cash-holds').then((r) => r.json()),
    staleTime: 10000,
    refetchInterval: 30000,
  });

  const totalHoldAmount = (holds ?? []).reduce(
    (sum: number, h: any) => sum + parseFloat(h.amount || '0'),
    0,
  );

  return (
    <div className="bg-amber-50/60 border-2 border-amber-200 rounded-3xl p-4 shadow-xs space-y-3">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">💵</span>
          <div>
            <h2 className="text-xs font-black uppercase tracking-wider text-amber-950">
              Остатки подотчёта на руках
            </h2>
            <p className="text-[10px] text-amber-700 font-bold">
              Несданная наличная выручка / переносы
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {holds.length > 0 && (
            <span className="bg-amber-600 text-white text-xs font-black px-2.5 py-1 rounded-xl shadow-xs">
              {totalHoldAmount.toLocaleString('ru-RU')} ₽
            </span>
          )}
          <button
            onClick={() => setShowFixModal(true)}
            className="text-[10px] font-black uppercase tracking-wider bg-white border border-amber-300 text-amber-900 px-2.5 py-1.5 rounded-xl active:bg-amber-100 transition-colors"
          >
            + Зафиксировать
          </button>
        </div>
      </div>

      {/* Список активных переносов */}
      {isLoading ? (
        <div className="h-16 bg-amber-100/50 rounded-2xl animate-pulse" />
      ) : holds.length === 0 ? (
        <div className="bg-white/80 border border-amber-100 rounded-2xl p-3 text-center">
          <p className="text-xs font-bold text-amber-800">
            Все наличные сданы в кассу. Зависших остатков на руках нет.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {holds.map((hold: any) => (
            <div
              key={hold.id}
              className="bg-white border border-amber-200 rounded-2xl p-3 shadow-2xs flex items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm text-zinc-900 truncate">
                    {hold.driver_name}
                  </span>
                  {hold.driver_phone && (
                    <span className="text-[10px] text-zinc-400 font-medium">
                      {hold.driver_phone}
                    </span>
                  )}
                </div>
                {hold.note && (
                  <p className="text-xs text-zinc-600 mt-0.5 line-clamp-1">{hold.note}</p>
                )}
                <p className="text-[10px] text-amber-700 font-medium mt-0.5">
                  {new Date(hold.created_at).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>

              <div className="text-right shrink-0 space-y-1.5">
                <p className="text-base font-black text-amber-900">
                  {parseFloat(hold.amount).toLocaleString('ru-RU')} ₽
                </p>
                <button
                  onClick={() => setCollectTarget(hold)}
                  className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-xl transition-all shadow-xs"
                >
                  Принять
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модалка фиксации переноса */}
      {showFixModal && (
        <FixHoldModal
          onClose={() => setShowFixModal(false)}
          onSuccess={() => {
            setShowFixModal(false);
            qc.invalidateQueries({ queryKey: ['admin-driver-cash-holds'] });
            qc.invalidateQueries({ queryKey: ['wallets'] });
          }}
        />
      )}

      {/* Модалка приёма денег в кассу */}
      {collectTarget && (
        <CollectHoldModal
          hold={collectTarget}
          onClose={() => setCollectTarget(null)}
          onSuccess={() => {
            setCollectTarget(null);
            qc.invalidateQueries({ queryKey: ['admin-driver-cash-holds'] });
            qc.invalidateQueries({ queryKey: ['wallets'] });
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// МОДАЛКА: ЗАФИКСИРОВАТЬ ОСТАТОК ПОДОТЧЁТА НА РУКАХ
// ─────────────────────────────────────────────────────────────────────────────
function FixHoldModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [driverId, setDriverId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const { data: drivers = [], isLoading: driversLoading } = useQuery<any[]>({
    queryKey: ['users-drivers'],
    queryFn: () => fetch('/api/users/public?role=driver').then((r) => r.json()),
    staleTime: 60000,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/driver-cash-holds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id: driverId,
          amount: parseFloat(amount.replace(',', '.')),
          note: note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Ошибка фиксации остатка');
      return data;
    },
    onSuccess,
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = () => {
    if (!driverId) return setError('Выберите водителя');
    const num = parseFloat(amount.replace(',', '.'));
    if (isNaN(num) || num <= 0) return setError('Укажите корректную сумму');
    setError('');
    mutation.mutate();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl border border-zinc-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
          <h3 className="font-black text-sm uppercase tracking-wider text-zinc-900">
            📋 Зафиксировать остаток подотчёта
          </h3>
          <button onClick={onClose} className="text-zinc-400 font-bold text-lg">
            ✕
          </button>
        </div>

        <p className="text-xs text-zinc-500">
          Используется, когда водитель не сдал наличные в кассу и они остаются у него на руках до
          следующего рейса.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1">
              Водитель
            </label>
            {driversLoading ? (
              <div className="h-10 bg-zinc-100 rounded-xl animate-pulse" />
            ) : (
              <select
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">Выберите водителя...</option>
                {drivers.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1">
              Сумма на руках (₽)
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-base font-black text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1">
              Комментарий / Причина
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Поздний возврат / перенос на завтра"
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {error && <p className="text-xs font-bold text-red-600">{error}</p>}
        </div>

        <div className="flex gap-2 pt-2 border-t border-zinc-100">
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase tracking-widest py-3 rounded-xl active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {mutation.isPending ? 'Сохранение...' : 'Зафиксировать перенос'}
          </button>
          <button
            onClick={onClose}
            className="px-4 text-xs font-black text-zinc-500 uppercase tracking-widest border border-zinc-200 rounded-xl active:bg-zinc-100 transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// МОДАЛКА: ПРИНЯТЬ ПОДОТЧЁТ В КАССУ (ИНКАССИРОВАТЬ)
// ─────────────────────────────────────────────────────────────────────────────
function CollectHoldModal({
  hold,
  onClose,
  onSuccess,
}: {
  hold: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [collectAmount, setCollectAmount] = useState(hold.amount ?? '');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/driver-cash-holds', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hold_id: hold.id,
          collected_amount: parseFloat(collectAmount.replace(',', '.')),
          note: note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Ошибка приёма денег');
      return data;
    },
    onSuccess,
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = () => {
    const num = parseFloat(collectAmount.replace(',', '.'));
    if (isNaN(num) || num <= 0) return setError('Укажите корректную сумму');
    setError('');
    mutation.mutate();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl border border-zinc-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
          <h3 className="font-black text-sm uppercase tracking-wider text-emerald-800">
            💵 Принять подотчёт в кассу
          </h3>
          <button onClick={onClose} className="text-zinc-400 font-bold text-lg">
            ✕
          </button>
        </div>

        <div className="bg-zinc-50 rounded-2xl p-3 border border-zinc-200/80 space-y-1">
          <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Водитель</p>
          <p className="text-sm font-black text-zinc-900">{hold.driver_name}</p>
          {hold.note && <p className="text-xs text-zinc-600 mt-1">{hold.note}</p>}
          <p className="text-xs text-amber-800 font-bold mt-1">
            Всего на руках: {parseFloat(hold.amount).toLocaleString('ru-RU')} ₽
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1">
              Сумма к сдаче в сейф (₽)
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={collectAmount}
              onChange={(e) => setCollectAmount(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-base font-black text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1">
              Примечание (необязательно)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Сдано в кассу"
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {error && <p className="text-xs font-bold text-red-600">{error}</p>}
        </div>

        <div className="flex gap-2 pt-2 border-t border-zinc-100">
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest py-3 rounded-xl active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {mutation.isPending ? 'Приём денег...' : 'Принять в сейф'}
          </button>
          <button
            onClick={onClose}
            className="px-4 text-xs font-black text-zinc-500 uppercase tracking-widest border border-zinc-200 rounded-xl active:bg-zinc-100 transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
