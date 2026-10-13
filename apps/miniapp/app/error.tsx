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
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center text-3xl mb-4 shadow-sm">
        ⚠️
      </div>
      <h2 className="text-lg font-black text-slate-900 mb-1">Что-то пошло не так</h2>
      <p className="text-xs text-slate-500 max-w-xs mb-6 font-medium">
        Произошла заминка при загрузке страницы. Попробуйте обновить экран.
      </p>
      <div className="flex flex-col gap-2.5 w-full max-w-xs">
        <button
          onClick={() => reset()}
          className="w-full bg-orange-600 text-white rounded-xl py-3.5 font-bold uppercase tracking-wider text-xs active:scale-95 transition-transform shadow-md"
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
