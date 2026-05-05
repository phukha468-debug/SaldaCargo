'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@saldacargo/ui';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const initialUserId = searchParams.get('userId');
    if (initialUserId) {
      setUserId(initialUserId);
    }
  }, [searchParams]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || pin.length < 4) return;
    
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/verify-mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, pin }),
      });

      if (response.ok) {
        // Успешный вход -> жесткий редирект в корень
        router.push('/');
        router.refresh();
      } else {
        const data = await response.json();
        setError(data.error || 'Ошибка входа');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError('Ошибка сервера');
      setLoading(false);
    }
  }

  const reset = () => {
    document.cookie = 'salda_user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    setUserId('');
    setPin('');
    setError('');
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4 antialiased">
      <button 
        onClick={reset}
        className="fixed top-4 right-4 bg-zinc-200 text-zinc-500 text-[10px] font-bold uppercase px-3 py-1 rounded-full hover:bg-zinc-300 transition-colors"
      >
        Сбросить
      </button>

      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl shadow-zinc-200/50 border border-zinc-100 overflow-hidden">
        <div className="p-8">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-black text-zinc-900 tracking-tight uppercase italic">
              Salda<span className="text-orange-600">Cargo</span>
            </h1>
            <p className="text-zinc-400 font-bold text-[10px] uppercase tracking-widest mt-1">
              Вход по ПИН-коду
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-4">
                ID Пользователя
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Например: user-123"
                className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl p-4 font-bold text-zinc-800 focus:border-orange-200 focus:outline-none transition-all placeholder:text-zinc-300"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-4">
                ПИН-код
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="****"
                className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl p-4 font-bold text-zinc-800 text-center text-2xl tracking-[1em] focus:border-orange-200 focus:outline-none transition-all placeholder:text-zinc-300"
                required
              />
            </div>

            {error && (
              <p className="text-center text-red-500 text-[10px] font-bold uppercase tracking-widest animate-shake">
                {error}
              </p>
            )}

            <Button
              type="submit"
              size="hero"
              disabled={loading || !userId || pin.length < 4}
              className="font-black uppercase tracking-widest"
            >
              {loading ? 'Проверка...' : 'Войти'}
            </Button>
          </form>
        </div>
      </div>
      
      <p className="mt-8 text-zinc-400 font-bold text-[10px] uppercase tracking-widest">
        v1.1.1 • SaldaCargo
      </p>

      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
      `}</style>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
