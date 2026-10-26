'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@saldacargo/ui';

function LoginForm() {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') ?? '/';

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin }),
      });

      const data = await response.json();

      if (response.ok) {
        router.push(from);
        router.refresh();
      } else {
        setError(data.error || 'Ошибка входа');
      }
    } catch {
      setError('Ошибка сервера при авторизации');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 text-white p-4">
      <div className="w-full max-w-sm bg-slate-800/90 border border-slate-700 rounded-3xl p-8 shadow-2xl backdrop-blur-md">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg mx-auto p-0.5 bg-gradient-to-br from-amber-500 to-amber-700 mb-3">
            <img
              src="/logo.png"
              alt="TK501"
              className="w-full h-full object-cover rounded-[14px]"
            />
          </div>
          <h1 className="text-2xl font-black tracking-tight">TK501</h1>
          <p className="mt-1 text-xs text-slate-400">Панель управления логистикой</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label
              htmlFor="phone"
              className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5"
            >
              Номер телефона
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="+7 922 000 0000"
              className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div>
            <label
              htmlFor="pin"
              className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5"
            >
              ПИН-код
            </label>
            <input
              id="pin"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
              placeholder="••••"
              maxLength={6}
              className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-500 tracking-widest text-center focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-xs text-red-300 font-medium">
              {error}
            </div>
          )}

          <Button
            type="submit"
            size="mobile"
            disabled={loading}
            className="w-full mt-2 bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl"
          >
            {loading ? 'Входим...' : 'Войти'}
          </Button>
        </form>

        <p className="mt-6 text-center text-[10px] text-slate-500 uppercase tracking-widest">
          Доступ только для сотрудников
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
