'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Web GlobalErrorBoundary]', error);
  }, [error]);

  return (
    <html lang="ru">
      <body className="min-h-screen flex items-center justify-center bg-slate-50 p-6 font-sans">
        <div className="max-w-md w-full rounded-xl border border-red-200 bg-white p-6 shadow-sm text-center space-y-4">
          <div className="text-3xl">🚨</div>
          <h2 className="text-lg font-semibold text-slate-900">Критическая ошибка приложения</h2>
          <p className="text-sm text-slate-600">
            Произошёл непредвиденный сбой. Нажмите кнопку ниже, чтобы перезагрузить интерфейс.
          </p>
          {error.digest && <p className="text-xs font-mono text-slate-400">Код: {error.digest}</p>}
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Перезагрузить
          </button>
        </div>
      </body>
    </html>
  );
}
