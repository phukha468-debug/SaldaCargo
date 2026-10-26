'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { performLogout } from '@/lib/auth/logout';
import ChangePinModal from '@/components/ChangePinModal';

export default function MechanicProfilePage() {
  const [loggingOut, setLoggingOut] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);

  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await fetch('/api/driver/me');
      if (!res.ok) throw new Error('Not authenticated');
      return res.json();
    },
  });

  const handleLogout = async () => {
    setLoggingOut(true);
    await performLogout();
  };

  if (isLoading) return <div className="p-4 animate-pulse">Загрузка...</div>;

  const salaryPct = user?.mechanic_salary_pct ?? 50;

  return (
    <div className="p-4 space-y-5 max-w-lg mx-auto">
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-2xs text-center">
        <div className="w-20 h-20 rounded-3xl bg-[#E8F7EC] flex items-center justify-center mx-auto mb-4 border border-[#21A038]/20">
          <span className="text-4xl">🛠</span>
        </div>
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{user?.name}</h1>
        <p className="text-xs font-extrabold text-[#21A038] uppercase tracking-wider mt-1">
          Механик СТО · Доля ЗП {salaryPct}%
        </p>

        <div className="grid grid-cols-2 gap-2.5 mt-5 pt-4 border-t border-slate-100 text-left">
          <div className="bg-[#F2F4F7] rounded-2xl p-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase">Свой автопарк</p>
            <p className="text-sm font-extrabold text-slate-900 mt-0.5">1 600 ₽/час</p>
            <p className="text-[11px] font-bold text-[#21A038]">
              В ЗП: {Math.round(1600 * (salaryPct / 100))} ₽/ч
            </p>
          </div>
          <div className="bg-[#F2F4F7] rounded-2xl p-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase">Клиентские авто</p>
            <p className="text-sm font-extrabold text-slate-900 mt-0.5">2 000 ₽/час</p>
            <p className="text-[11px] font-bold text-[#21A038]">
              В ЗП: {Math.round(2000 * (salaryPct / 100))} ₽/ч
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider px-1">
          Безопасность и аккаунт
        </h2>

        <button
          onClick={() => setShowPinModal(true)}
          className="w-full bg-white border border-slate-200/80 text-slate-900 rounded-2xl p-4 font-extrabold text-xs uppercase tracking-wider flex items-center justify-between shadow-2xs active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">🔒</span>
            <span>Сменить личный PIN-код</span>
          </div>
          <span className="text-[#21A038] font-extrabold">Изменить →</span>
        </button>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full bg-white border border-red-200 text-red-600 rounded-2xl py-4 font-extrabold uppercase tracking-wider text-xs active:bg-red-50 active:scale-[0.99] transition-all shadow-2xs disabled:opacity-50"
        >
          {loggingOut ? 'Выход из системы...' : '🚪 Выйти из аккаунта'}
        </button>
      </div>

      {user?.id && (
        <ChangePinModal
          isOpen={showPinModal}
          userId={user.id}
          userName={user.name}
          onClose={() => setShowPinModal(false)}
        />
      )}

      <div className="text-center pt-4">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          TK501 · СТО Гараж
        </p>
      </div>
    </div>
  );
}
