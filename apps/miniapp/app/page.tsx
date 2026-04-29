'use client';

import { useEffect, useState } from 'react';
import { NetworkIndicator } from '@saldacargo/ui';

type AppState = 'loading' | 'unauthorized' | 'ready';

export default function MiniAppRoot() {
  const [state, setState] = useState<AppState>('loading');
  const [userName, setUserName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // На MVP: симулируем получение max_user_id из МАХ SDK
    // TODO: заменить на реальный MAX Mini App SDK вызов
    const mockMaxUserId = new URLSearchParams(window.location.search).get('uid');

    if (!mockMaxUserId) {
      // В реальном МАХ окружении SDK всегда передаёт данные
      // Здесь показываем экран ошибки только если совсем нет данных
      setTimeout(() => {
        setState('unauthorized');
        setError('Откройте приложение через МАХ');
      }, 0);
      return;
    }

    fetch('/api/auth/max', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: { max_user_id: mockMaxUserId } }),
    })
      .then((r) => r.json())
      .then((data: { user?: { name: string }; error?: string }) => {
        if (data.user) {
          setUserName(data.user.name);
          setState('ready');
        } else {
          setError(data.error ?? 'Ошибка');
          setState('unauthorized');
        }
      })
      .catch(() => {
        setError('Нет соединения с сервером');
        setState('unauthorized');
      });
  }, []);

  if (state === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-orange-50">
        <div className="text-center">
          <div className="text-3xl animate-spin mb-4">⚙️</div>
          <p className="text-slate-600">Загрузка...</p>
        </div>
      </main>
    );
  }

  if (state === 'unauthorized') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-orange-50 p-6">
        <div className="text-center">
          <div className="text-4xl mb-4">🚫</div>
          <h1 className="text-xl font-bold text-slate-900">Доступ запрещён</h1>
          <p className="mt-2 text-slate-600">{error}</p>
          <p className="mt-4 text-sm text-slate-400">Обратитесь к администратору</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-orange-50">
      {/* Шапка */}
      <header className="flex items-center justify-between bg-white px-4 py-3 shadow-sm">
        <div>
          <p className="text-xs text-slate-400">SaldaCargo</p>
          <p className="font-semibold text-slate-900">{userName}</p>
        </div>
        <NetworkIndicator />
      </header>

      {/* Заглушка — роутинг по роли будет в TASK_11 */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="text-center">
          <div className="text-4xl mb-4">✅</div>
          <p className="font-semibold text-slate-900">Авторизация прошла</p>
          <p className="mt-1 text-sm text-slate-500">Главный экран — в TASK_11</p>
        </div>
      </div>
    </main>
  );
}
