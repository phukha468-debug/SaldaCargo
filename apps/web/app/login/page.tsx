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
      setError('Ошибка сервера');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">SaldaCargo</h1>
          <p className="mt-1 text-slate-500">Панель управления</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1">
              Номер телефона
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="+7 922 000 0000"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div>
            <label htmlFor="pin" className="block text-sm font-medium text-slate-700 mb-1">
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
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

          <Button type="submit" size="mobile" disabled={loading}>
            {loading ? 'Входим...' : 'Войти'}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">Только для персонала SaldaCargo</p>
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
