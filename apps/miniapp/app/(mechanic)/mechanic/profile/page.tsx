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

  return (
    <div className="p-4 space-y-6 max-w-lg mx-auto">
      <div className="bg-white rounded-3xl p-6 border-2 border-zinc-200 shadow-sm text-center">
        <div className="w-20 h-20 rounded-2xl bg-zinc-100 flex items-center justify-center mx-auto mb-4 border border-zinc-200 shadow-inner">
          <span className="text-4xl">🛠</span>
        </div>
        <h1 className="text-xl font-black text-zinc-900 tracking-tight">{user?.name}</h1>
        <p className="text-[11px] font-black text-orange-600 uppercase tracking-widest mt-1">
          Механик СТО
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">
          Безопасность и аккаунт
        </h2>

        {/* Кнопка смены PIN-кода */}
        <button
          onClick={() => setShowPinModal(true)}
          className="w-full bg-white border-2 border-zinc-200 hover:border-orange-200 text-zinc-800 rounded-2xl p-4 font-black text-xs uppercase tracking-wider flex items-center justify-between shadow-sm active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">🔒</span>
            <span>Сменить личный PIN-код</span>
          </div>
          <span className="text-orange-600 font-bold">Изменить →</span>
        </button>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full bg-white border-2 border-red-200 text-red-600 rounded-2xl py-4 font-black uppercase tracking-wider text-xs active:bg-red-50 active:scale-[0.99] transition-all shadow-sm disabled:opacity-50"
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
        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
          TK501 · MiniApp v1.0
        </p>
      </div>
    </div>
  );
}
