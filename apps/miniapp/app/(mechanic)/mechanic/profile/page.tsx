'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

export default function MechanicProfilePage() {
  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await fetch('/api/driver/me');
      if (!res.ok) throw new Error('Not authenticated');
      return res.json();
    },
  });

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login'; 
    } catch (error) {
      console.error('Logout failed', error);
      document.cookie = 'salda_user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      window.location.href = '/login';
    }
  };

  if (isLoading) return <div className="p-4 animate-pulse">Загрузка...</div>;

  return (
    <div className="p-4 space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm text-center">
        <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-md">
          <span className="text-4xl">👤</span>
        </div>
        <h1 className="text-xl font-black text-slate-900">{user?.name}</h1>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Механик</p>
      </div>

      <div className="space-y-2">
        <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Система</h2>
        <button
          onClick={logout}
          className="w-full bg-white border border-red-100 text-red-600 rounded-xl py-4 font-black uppercase tracking-widest text-xs active:bg-red-50 transition-colors shadow-sm"
        >
          Выйти из аккаунта
        </button>
      </div>

      <div className="text-center">
        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">SaldaCargo v1.0.0</p>
      </div>
    </div>
  );
}
