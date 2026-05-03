'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

export default function RootDispatcher() {
  const router = useRouter();
  const [maxError, setMaxError] = useState<string | null>(null);

  const { data: user, isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      // [DEBUG] Выводим полную ссылку для диагностики MAX SDK
      if (typeof window !== 'undefined') {
        console.log('[DEBUG] Full URL:', window.location.href);
      }

      // 1. Проверяем среду МАХ перед запросом профиля
      const searchParams = new URLSearchParams(window.location.search);
      const maxUserId = searchParams.get('uid');

      if (maxUserId) {
        console.log('[Dispatcher] MAX environment detected, attempting auto-login for:', maxUserId);
        const maxAuth = await fetch('/api/auth/max', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData: { max_user_id: maxUserId } }),
        });

        if (maxAuth.ok) {
          // Если МАХ авторизация успешна, продолжаем получать профиль
          console.log('[Dispatcher] MAX auto-login successful');
        } else {
          const errData = await maxAuth.json();
          throw new Error(errData.error || 'MAX Auth Failed');
        }
      }

      const res = await fetch('/api/driver/me', { cache: 'no-store' }); 
      if (res.status === 401) {
        throw new Error('Unauthorized');
      }
      if (!res.ok) throw new Error('Not authenticated');
      return res.json();
    },
    retry: false,
  });

  useEffect(() => {
    if (isLoading) return;

    if (isError || !user) {
      // Если была ошибка МАХ авторизации (например 403 с ID), прокидываем её на страницу логина
      const errorMsg = isError ? (data as any)?.message || 'Unauthorized' : '';
      if (errorMsg.includes('MAX ID')) {
         // Сохраняем ошибку в стейт чтобы показать пользователю перед редиректом
         setMaxError(errorMsg);
         setTimeout(() => router.push(`/login?error=${encodeURIComponent(errorMsg)}`), 3000);
      } else {
         router.push('/login');
      }
      return;
    }

    const rawRoles = user.roles;
    const roles = Array.isArray(rawRoles) ? rawRoles : [];

    console.log('[Dispatcher Debug] Processing roles:', roles, 'for user:', user.name);

    if (roles.includes('admin') || roles.includes('owner')) {
      router.push('/admin');
    } else if (roles.includes('mechanic') || roles.includes('mechanic_lead')) {
      router.push('/mechanic');
    } else if (roles.includes('driver')) {
      router.push('/driver');
    } else {
      router.push('/login');
    }
  }, [user, isLoading, isError, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center">
      <div className="flex flex-col items-center gap-4">
        {maxError ? (
          <div className="space-y-4">
             <div className="text-4xl">🚫</div>
             <p className="text-red-600 font-bold text-sm leading-relaxed max-w-xs">{maxError}</p>
             <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">Перенаправление на вход...</p>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">SaldaCargo</p>
          </>
        )}
      </div>
    </div>
  );
}
