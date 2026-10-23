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

      {/* Сигнальный баннер: Рейсы на проверке (если есть) */}
      {(summary?.pendingReview ?? 0) > 0 && (
        <Link
          href="/admin/trips?filter=review"
          className="block bg-orange-50 border-2 border-orange-200 rounded-2xl p-3.5 active:scale-[0.98] transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📋</span>
              <div>
                <p className="font-black text-orange-950 text-sm uppercase tracking-tight">
                  {summary.pendingReview} рейс{summary.pendingReview > 1 ? 'а' : ''} ждут ревью
                </p>
                <p className="text-orange-600 text-[11px] font-bold">Нажмите для проверки →</p>
              </div>
            </div>
            <span className="bg-orange-600 text-white text-xs font-black px-2.5 py-1 rounded-xl">
              {summary.pendingReview}
            </span>
          </div>
        </Link>
      )}
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
