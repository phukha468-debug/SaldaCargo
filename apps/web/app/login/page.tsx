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
        <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg mx-auto p-0.5 bg-gradient-to-br from-amber-500 to-amber-700">
          <img src="/logo.png" alt="TK501" className="w-full h-full object-cover rounded-[14px]" />
        </div>
        <h1 className="text-xl font-bold">Вход в TK501</h1>
        <p className="text-xs text-slate-400">Перенаправление на главную панель...</p>
      </div>
    </main>
  );
}
