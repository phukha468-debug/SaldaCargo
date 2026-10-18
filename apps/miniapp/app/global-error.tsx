'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Critical Root Error caught by global-error.tsx:', error);

    // Автоматическое восстановление при рассинхроне чанков после нового деплоя
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Failed to fetch dynamically imported module');

    if (isChunkError) {
      const lastReload = sessionStorage.getItem('last_chunk_reload');
      const now = Date.now();
      // Предотвращаем бесконечный цикл перезагрузок (не чаще раза в 10 секунд)
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem('last_chunk_reload', String(now));
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <html lang="ru">
      <body className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6 text-center font-sans antialiased">
        <div className="w-16 h-16 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center text-3xl mb-4 shadow-sm">
          🚛
        </div>
        <h2 className="text-lg font-black text-zinc-900 mb-1">Обновление приложения</h2>
        <p className="text-xs text-zinc-500 max-w-xs mb-6 font-medium">
          Вышла новая версия Salda Cargo. Нажмите кнопку ниже для обновления экрана.
        </p>
        <div className="flex flex-col gap-2.5 w-full max-w-xs">
          <button
            onClick={() => {
              window.location.reload();
            }}
            className="w-full bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white rounded-xl py-3.5 font-bold uppercase tracking-wider text-xs active:scale-95 transition-all shadow-md"
          >
            Обновить и продолжить
          </button>
          <button
            onClick={() => {
              try {
                localStorage.clear();
                sessionStorage.clear();
              } catch {
                // ignore
              }
              window.location.href = '/?step=role';
            }}
            className="w-full bg-white border border-zinc-200 text-zinc-700 rounded-xl py-3.5 font-bold uppercase tracking-wider text-xs active:scale-95 transition-all"
          >
            Сбросить кэш и войти заново
          </button>
        </div>
      </body>
    </html>
  );
}
