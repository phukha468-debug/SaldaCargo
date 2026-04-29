export default function AuthErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold text-slate-900">Ошибка входа</h1>
        <p className="mt-2 text-slate-600">Ссылка недействительна или устарела.</p>
        <a href="/login" className="mt-6 inline-block text-sm text-orange-600 hover:underline">
          Попробовать снова
        </a>
      </div>
    </main>
  );
}
