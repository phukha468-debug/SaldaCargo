'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

export default function RootDispatcher() {
  const router = useRouter();

  const { data: user, isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await fetch('/api/driver/me', { cache: 'no-store' }); // Общий эндпоинт для получения профиля
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
      router.push('/login');
      return;
    }

    const rawRoles = user.roles;
    const roles = Array.isArray(rawRoles) ? rawRoles : [];

    console.log('[Dispatcher Debug] Processing roles:', roles, 'for user:', user.name);

    if (roles.includes('admin') || roles.includes('owner')) {
      console.log('[Dispatcher] Redirecting to /admin');
      router.push('/admin');
    } else if (roles.includes('mechanic') || roles.includes('mechanic_lead')) {
      console.log('[Dispatcher] Redirecting to /mechanic');
      router.push('/mechanic');
    } else if (roles.includes('driver')) {
      console.log('[Dispatcher] Redirecting to /driver');
      router.push('/driver');
    } else {
      console.warn('[Dispatcher Debug] No matching role found for:', roles);
      router.push('/login');
    }
  }, [user, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">SaldaCargo</p>
      </div>
    </div>
  );
}
