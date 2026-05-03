'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@saldacargo/ui';

export default function AdminDashboard() {
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => fetch('/api/driver/me').then((r) => r.json()),
  });

  return (
    <div className="min-h-screen bg-zinc-50 p-4">
      <header className="mb-8">
        <h1 className="text-2xl font-black text-zinc-900 uppercase tracking-tight">
          Пульт <span className="text-orange-600">Админа</span>
        </h1>
        <p className="text-zinc-400 font-bold text-xs uppercase tracking-widest mt-1">
          {me?.name || 'Загрузка...'}
        </p>
      </header>

      <div className="grid gap-4">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100">
          <p className="text-zinc-400 font-bold text-[10px] uppercase tracking-widest mb-4 text-center">
            Быстрые действия
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button size="hero" className="flex flex-col gap-2 h-auto py-6">
              <span className="text-2xl">➕</span>
              <span className="text-[10px] font-black uppercase tracking-widest">Доход</span>
            </Button>
            <Button variant="secondary" size="hero" className="flex flex-col gap-2 h-auto py-6 bg-zinc-100 border-zinc-200">
              <span className="text-2xl">➖</span>
              <span className="text-[10px] font-black uppercase tracking-widest">Расход</span>
            </Button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100">
          <p className="text-zinc-400 font-bold text-[10px] uppercase tracking-widest mb-4">
            Статус системы
          </p>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-3 border-b border-zinc-50">
              <span className="text-zinc-500 font-bold text-xs uppercase tracking-wide">Рейсы в работе</span>
              <span className="font-black text-zinc-900 italic">...</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-zinc-50">
              <span className="text-zinc-500 font-bold text-xs uppercase tracking-wide">Наряды в работе</span>
              <span className="font-black text-zinc-900 italic">...</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center">
        <button 
          onClick={async () => {
            try {
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.href = '/login'; 
            } catch (error) {
              console.error('Logout failed', error);
              document.cookie = 'salda_user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
              window.location.href = '/login';
            }
          }}
          className="text-zinc-400 font-bold text-[10px] uppercase tracking-widest hover:text-red-500 transition-colors"
        >
          Выйти из системы
        </button>
      </div>
    </div>
  );
}
