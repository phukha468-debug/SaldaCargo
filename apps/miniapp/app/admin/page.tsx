/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Money } from '@saldacargo/ui';

type Wallets = {
  bank: { id: string; name: string; balance: string };
  cash: { id: string; name: string; balance: string };
  card: { id: string; name: string; balance: string };
  drivers_accountable: string;
};

const WALLET_OPTIONS = [
  { id: '10000000-0000-0000-0000-000000000001', label: 'Расчётный счёт' },
  { id: '10000000-0000-0000-0000-000000000002', label: 'Сейф (Наличные)' },
  { id: '10000000-0000-0000-0000-000000000003', label: 'Карта' },
];

export default function AdminDashboard() {
  const qc = useQueryClient();

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

  const { data: wallets, isLoading: walletsLoading } = useQuery<Wallets>({
    queryKey: ['wallets'],
    queryFn: () => fetch('/api/wallets').then((r) => r.json()),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const handleLogout = () => {
    document.cookie = 'salda_user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    localStorage.clear();
    window.location.href = '/';
  };

  return (
    <div className="p-4 space-y-6">
      <header className="pt-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 uppercase tracking-tight">
            Пульт <span className="text-orange-600">Админа</span>
          </h1>
          <p className="text-zinc-400 font-bold text-xs uppercase tracking-widest mt-1">
            {me?.name ?? '...'}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="text-[10px] font-black uppercase tracking-widest text-zinc-300 hover:text-red-400 transition-colors"
        >
          Выйти
        </button>
      </header>

      {/* Кошельки */}
      <WalletsSection
        wallets={wallets}
        isLoading={walletsLoading}
        onTransferred={() => qc.invalidateQueries({ queryKey: ['wallets'] })}
      />

      {/* Статус */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="На ревью"
          value={summaryLoading ? '...' : String(summary?.pendingReview ?? 0)}
          accent={summary?.pendingReview > 0}
          href="/admin/trips?filter=review"
        />
        <StatCard
          label="В рейсе"
          value={summaryLoading ? '...' : String(summary?.activeTrips ?? 0)}
          href="/admin/trips?filter=active"
        />
        <StatCard
          label="Сегодня"
          value={summaryLoading ? '...' : undefined}
          money={summary?.todayRevenue}
        />
      </div>

      {/* Быстрые действия */}
      <section className="space-y-3">
        <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
          Быстрые действия
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/admin/finance?action=income"
            className="bg-green-600 text-white rounded-2xl p-5 flex flex-col items-center gap-2 active:scale-[0.97] transition-all shadow-sm"
          >
            <span className="text-2xl">➕</span>
            <span className="text-xs font-black uppercase tracking-widest">Доход</span>
          </Link>
          <Link
            href="/admin/finance?action=expense"
            className="bg-zinc-800 text-white rounded-2xl p-5 flex flex-col items-center gap-2 active:scale-[0.97] transition-all shadow-sm"
          >
            <span className="text-2xl">➖</span>
            <span className="text-xs font-black uppercase tracking-widest">Расход</span>
          </Link>
        </div>
      </section>

      {/* Рейсы на ревью */}
      {(summary?.pendingReview ?? 0) > 0 && (
        <section>
          <Link
            href="/admin/trips?filter=review"
            className="block bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 active:scale-[0.98] transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-black text-orange-700 uppercase tracking-tight">
                  {summary.pendingReview} рейс{summary.pendingReview > 1 ? 'а' : ''} ждут ревью
                </p>
                <p className="text-orange-500 text-xs font-bold uppercase tracking-widest mt-1">
                  Нажми чтобы проверить →
                </p>
              </div>
              <span className="text-3xl">📋</span>
            </div>
          </Link>
        </section>
      )}
    </div>
  );
}

// ─── Wallets Section ─────────────────────────────────────────────────────────

function WalletsSection({
  wallets,
  isLoading,
  onTransferred,
}: {
  wallets: Wallets | undefined;
  isLoading: boolean;
  onTransferred: () => void;
}) {
  const [showTransfer, setShowTransfer] = useState(false);

  const WALLET_CONFIGS = [
    {
      key: 'bank' as const,
      icon: '🏦',
      color: 'bg-sky-50 border-sky-200',
      textColor: 'text-sky-700',
    },
    {
      key: 'cash' as const,
      icon: '💵',
      color: 'bg-emerald-50 border-emerald-200',
      textColor: 'text-emerald-700',
    },
    {
      key: 'card' as const,
      icon: '💳',
      color: 'bg-violet-50 border-violet-200',
      textColor: 'text-violet-700',
    },
  ];

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
          Деньги компании
        </h2>
        <button
          onClick={() => setShowTransfer((v) => !v)}
          className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl transition-colors ${
            showTransfer ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-600 active:bg-zinc-200'
          }`}
        >
          ↔ Перевести
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {WALLET_CONFIGS.map(({ key, icon, color, textColor }) => (
          <div key={key} className={`rounded-2xl border-2 p-3 ${color}`}>
            <p className="text-lg mb-1">{icon}</p>
            <p
              className={`text-[9px] font-black uppercase tracking-widest ${textColor} opacity-70`}
            >
              {wallets?.[key]?.name.split(' ')[0] ?? '...'}
            </p>
            {isLoading ? (
              <div className="h-5 w-16 bg-zinc-200 rounded animate-pulse mt-1" />
            ) : (
              <Money
                amount={wallets?.[key]?.balance ?? '0'}
                className={`text-sm font-black ${textColor} mt-0.5`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Подотчёт водителей */}
      {!isLoading && parseFloat(wallets?.drivers_accountable ?? '0') > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🚛</span>
            <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">
              У водителей (подотчёт)
            </span>
          </div>
          <Money
            amount={wallets!.drivers_accountable}
            className="text-sm font-black text-amber-700"
          />
        </div>
      )}

      {/* Форма перевода */}
      {showTransfer && (
        <TransferForm
          onDone={() => {
            setShowTransfer(false);
            onTransferred();
          }}
          onCancel={() => setShowTransfer(false)}
        />
      )}
    </section>
  );
}

function TransferForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [from, setFrom] = useState(WALLET_OPTIONS[0].id);
  const [to, setTo] = useState(WALLET_OPTIONS[1].id);
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
    'w-full bg-white border-2 border-zinc-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-zinc-400';
  const inputCls =
    'w-full bg-white border-2 border-zinc-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-zinc-400';

  return (
    <div className="bg-zinc-50 border-2 border-zinc-200 rounded-2xl p-4 space-y-3">
      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
        Перевод между кошельками
      </p>

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
          Описание (необязательно)
        </label>
        <input
          type="text"
          className={inputCls}
          placeholder="Например: снятие наличных"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {error && <p className="text-xs font-bold text-red-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSubmit}
          disabled={mutation.isPending}
          className="flex-1 bg-zinc-900 text-white text-xs font-black uppercase tracking-widest py-3 rounded-xl active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {mutation.isPending ? 'Перевод...' : 'Перевести'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 text-xs font-black text-zinc-500 uppercase tracking-widest border-2 border-zinc-200 rounded-xl active:bg-zinc-100 transition-colors"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  money,
  accent,
  href,
}: {
  label: string;
  value?: string;
  money?: string;
  accent?: boolean;
  href?: string;
}) {
  const inner = (
    <div
      className={`bg-white rounded-2xl p-4 border-2 text-center shadow-sm ${
        accent ? 'border-orange-400 bg-orange-50' : 'border-zinc-100'
      }`}
    >
      <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">{label}</p>
      {money !== undefined ? (
        <Money
          amount={money}
          className={`text-lg font-black ${accent ? 'text-orange-600' : 'text-zinc-900'}`}
        />
      ) : (
        <p className={`text-2xl font-black ${accent ? 'text-orange-600' : 'text-zinc-900'}`}>
          {value}
        </p>
      )}
    </div>
  );
  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}
