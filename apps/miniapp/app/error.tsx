'use client';

import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App runtime error caught by boundary:', error);

    // Автоматическая бесшовная перезагрузка при обновлении бандлов на сервере
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Failed to fetch dynamically imported module');

    if (isChunkError) {
      const lastReload = sessionStorage.getItem('last_chunk_reload');
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem('last_chunk_reload', String(now));
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center text-3xl mb-4 shadow-sm">
        ⚠️
      </div>
      <h2 className="text-lg font-black text-slate-900 mb-1">Обновление приложения</h2>
      <p className="text-xs text-slate-500 max-w-xs mb-6 font-medium">
        Вышла свежая версия системы. Нажмите кнопку, чтобы обновить экран.
      </p>
      <div className="flex flex-col gap-2.5 w-full max-w-xs">
        <button
          onClick={() => {
            window.location.reload();
          }}
          className="w-full bg-orange-600 text-white rounded-xl py-3.5 font-bold uppercase tracking-wider text-xs active:scale-95 transition-transform shadow-md"
        >
          Обновить экран
        </button>
        <button
          onClick={() => reset()}
          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-3.5 font-bold uppercase tracking-wider text-xs active:scale-95 transition-transform"
        >
          Повторить попытку
        </button>
        <button
          onClick={() => {
            window.location.href = '/?step=role';
          }}
          className="w-full bg-white border border-slate-200 text-slate-700 rounded-xl py-3.5 font-bold uppercase tracking-wider text-xs active:scale-95 transition-transform"
        >
          На главную
        </button>
      </div>
    </div>
  );
}
