'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RootDispatcher() {
  const [unregisteredId, setUnregisteredId] = useState<string | null>(null);
  const [availableRoutes, setAvailableRoutes] = useState<{path: string, label: string}[] | null>(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const initAuth = async () => {
      try {
        // 1. Ищем данные MAX в URL
        const hash = window.location.hash;
        const params = new URLSearchParams(hash.replace('#tgWebAppData=', '').replace('#WebAppData=', ''));
        const userParam = params.get('user');

        if (userParam) {
          // СЦЕНАРИЙ А: Вход через мессенджер МАХ
          const decodedUser = decodeURIComponent(userParam);
          const userData = JSON.parse(decodedUser);
          const maxUserId = userData.id.toString();

          const res = await fetch('/api/auth/max', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: { max_user_id: maxUserId } })
          });

          if (res.status === 403) {
            // НЕТ В БАЗЕ -> ПОКАЗЫВАЕМ ID И ОСТАНАВЛИВАЕМСЯ (БЕЗ РЕДИРЕКТА НА /login)
            setUnregisteredId(maxUserId);
            return; 
          }

          if (res.ok) {
            // ЕСТЬ В БАЗЕ -> РАЗБИРАЕМ РОЛИ
            const data = await res.json();
            const roles = data.user?.roles || [];
            const routes: { path: string; label: string }[] = [];

            if (roles.includes('admin') || roles.includes('owner')) {
              routes.push({ path: '/admin', label: '👑 Панель управления' });
            }
            if (roles.includes('driver')) {
              routes.push({ path: '/driver', label: '🚛 Мои рейсы' });
            }
            if (roles.includes('mechanic')) {
              routes.push({ path: '/mechanic', label: '🔧 Ремзона' });
            }

            if (routes.length === 1) {
              router.push(routes[0]!.path);
            } else if (routes.length > 1) {
              setAvailableRoutes(routes);
            } else {
              router.push('/login');
            }
            return;
          }
        }

        // СЦЕНАРИЙ Б: Нет MAX данных (десктоп) -> Идем на ручной ввод ПИН-кода
        router.push('/login');

      } catch (error) {
        console.error('Auth Init Error:', error);
        router.push('/login');
      }
    };

    initAuth();
  }, [router]);

  const handleCopy = () => {
    if (unregisteredId) {
      navigator.clipboard.writeText(unregisteredId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (availableRoutes) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 p-6 font-sans antialiased">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-black text-zinc-900 uppercase tracking-tight italic">
              Salda<span className="text-orange-600">Cargo</span>
            </h1>
            <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest mt-2">Выберите роль</p>
          </div>
          
          <div className="grid gap-4">
            {availableRoutes.map(route => (
              <button
                key={route.path}
                onClick={() => router.push(route.path)}
                className="w-full p-6 bg-white border border-zinc-200 rounded-3xl shadow-sm shadow-zinc-200/50 text-left text-zinc-800 font-black uppercase tracking-wide active:scale-[0.98] transition-all hover:border-orange-200 group"
              >
                <div className="flex items-center justify-between">
                  <span>{route.label}</span>
                  <span className="text-zinc-300 group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </button>
            ))}
          </div>

          <div className="pt-8 text-center">
            <button 
              onClick={() => {
                document.cookie = 'salda_user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
                router.push('/login');
              }}
              className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              Выйти из аккаунта
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6 text-center font-sans antialiased">
      <div className="flex flex-col items-center gap-4 w-full max-w-sm">
        {unregisteredId ? (
          <div className="bg-white rounded-3xl shadow-xl shadow-zinc-200/50 border border-zinc-100 p-8 w-full animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center text-3xl mb-6 mx-auto">
              👋
            </div>
            
            <h1 className="text-xl font-black text-zinc-900 uppercase tracking-tight mb-2">
              Вы почти с нами!
            </h1>
            
            <p className="text-sm text-zinc-500 mb-8 leading-relaxed">
              Ваш аккаунт ещё не активирован. Передайте этот идентификатор администратору:
            </p>

            <div 
              onClick={handleCopy}
              className="bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-2xl p-4 mb-4 cursor-pointer hover:border-orange-300 transition-colors group relative"
            >
              <span className="font-mono text-lg font-black text-zinc-800 tracking-wider">
                {unregisteredId}
              </span>
              <div className="text-[10px] font-black uppercase text-orange-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {copied ? '✅ Скопировано' : 'Нажмите, чтобы скопировать'}
              </div>
            </div>

            <div className="space-y-3 pt-4">
              <button 
                onClick={() => router.push('/login')}
                className="w-full py-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                Ввести ПИН-код вручную
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-black text-slate-400 uppercase tracking-widest italic">
              Salda<span className="text-orange-600">Cargo</span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
