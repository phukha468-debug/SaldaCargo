'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@saldacargo/ui';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  if (sent) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="w-full max-w-sm text-center">
          <div className="text-4xl mb-4">📧</div>
          <h1 className="text-xl font-bold text-slate-900">Проверьте почту</h1>
          <p className="mt-2 text-slate-600">
            Мы отправили ссылку для входа на <span className="font-medium">{email}</span>
          </p>
          <button
            onClick={() => setSent(false)}
            className="mt-6 text-sm text-slate-400 hover:text-slate-600"
          >
            Отправить снова
          </button>
        </div>
      </main>
    );
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
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@example.com"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" size="mobile" disabled={loading || !email}>
            {loading ? 'Отправляем...' : 'Получить ссылку для входа'}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          Доступ только для администраторов.
          <br />
          Водители и механики используют МАХ.
        </p>
      </div>
    </main>
  );
}
