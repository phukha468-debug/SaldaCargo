'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Web ErrorBoundary]', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-xl border border-red-200 bg-white p-6 shadow-sm text-center space-y-4">
        <div className="text-3xl">⚠️</div>
        <h2 className="text-lg font-semibold text-slate-900">Произошла ошибка интерфейса</h2>
        <p className="text-sm text-slate-600">
          Попробуйте обновить блок. Если проблема повторяется — обратитесь к администратору.
        </p>
        {error.digest && (
          <p className="text-xs font-mono text-slate-400">Код ошибки: {error.digest}</p>
        )}
        <div className="flex justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Повторить
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Обновить страницу
          </button>
        </div>
      </div>
    </div>
  );
}
