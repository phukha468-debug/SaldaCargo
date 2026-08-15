'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 bg-sky-500 rounded-2xl flex items-center justify-center font-black text-white text-2xl mx-auto shadow-lg animate-pulse">
          S
        </div>
        <h1 className="text-xl font-bold">Вход в SaldaCargo</h1>
        <p className="text-xs text-slate-400">Перенаправление на главную панель...</p>
      </div>
    </main>
  );
}
