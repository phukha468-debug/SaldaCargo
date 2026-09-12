'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <main className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4 antialiased">
      <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
      <p className="mt-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">
        Переход на страницу входа...
      </p>
    </main>
  );
}
