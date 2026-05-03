/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

// TODO: получать из авторизации
const MOCK_DRIVER_ID = '00000000-0000-0000-0000-000000000000';

export default function ProfilePage() {
  const { data: user, isLoading } = useQuery<any>({
    queryKey: ['driver-profile', MOCK_DRIVER_ID],
    queryFn: async () => {
      const res = await fetch(`/api/driver/profile?driver_id=${MOCK_DRIVER_ID}`);
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 animate-pulse">
        <div className="h-32 bg-zinc-200 rounded-full w-32 mx-auto" />
        <div className="h-8 w-48 bg-zinc-200 rounded mx-auto" />
        <div className="space-y-3 pt-10">
          <div className="h-14 bg-zinc-200 rounded-lg" />
          <div className="h-14 bg-zinc-200 rounded-lg" />
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      // Обязательно делаем жесткую перезагрузку, чтобы сбросить стейты и куки
      window.location.href = '/login'; 
    } catch (error) {
      console.error('Logout failed', error);
      // Fallback на случай ошибки API
      document.cookie = 'salda_user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      window.location.href = '/login';
    }
  };

  return (
    <div className="p-4 space-y-8">
      <header className="text-center pt-8">
        <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 border-4 border-zinc-100 shadow-lg">
          👤
        </div>
        <h1 className="text-2xl font-black text-zinc-900">{user?.name}</h1>
        <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest mt-1">
          {user?.roles?.includes('driver') ? 'Водитель' : (user?.roles?.[0] ?? 'Пользователь')}
        </p>
      </header>

      <section className="space-y-3 pt-4">
        <ProfileInfoRow label="Телефон" value={user?.phone ?? 'Не указан'} />
        <ProfileInfoRow label="Машина" value={user?.asset?.short_name ?? 'Не закреплена'} />
      </section>

      <section className="space-y-3 pt-8">
        <button
          onClick={() => window.open('https://t.me/your_admin_bot', '_blank')}
          className="w-full h-14 bg-white border-2 border-zinc-200 rounded-lg font-bold text-zinc-600 active:bg-zinc-50 transition-colors flex items-center justify-center gap-2"
        >
          <span>💬</span> Связаться с админом
        </button>
        
        <button
          onClick={handleLogout}
          className="w-full h-14 bg-red-50 text-red-600 rounded-lg font-black uppercase tracking-widest active:bg-red-100 transition-colors mt-4"
        >
          Выйти
        </button>
      </section>

      <footer className="text-center text-[10px] text-zinc-300 font-bold uppercase tracking-[0.3em] pt-10">
        SaldaCargo v1.0.0
      </footer>
    </div>
  );
}

function ProfileInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg p-4 border border-zinc-200 flex justify-between items-center shadow-sm">
      <span className="text-xs font-bold text-zinc-400 uppercase tracking-tight">{label}</span>
      <span className="text-sm font-black text-zinc-900">{value}</span>
    </div>
  );
}
