'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

export default function RootDispatcher() {
  const router = useRouter();
  const [maxError, setMaxError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [availableRoutes, setAvailableRoutes] = useState<{path: string, label: string}[] | null>(null);

  const { data: user, isLoading, isError, error } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      // 1. Проверяем среду МАХ перед запросом профиля
      let maxUserId: string | null = null;

      try {
        if (typeof window !== 'undefined') {
          // Сначала проверяем классический uid в поиске (для тестов)
          const searchParams = new URLSearchParams(window.location.search);
          maxUserId = searchParams.get('uid');

          // Если нет в поиске, парсим hash (основной формат МАХ)
          // #WebAppData=chat%3D...%26user%3D%257B%2522id%2522%253A56628256...
          if (!maxUserId && window.location.hash) {
            const hashString = window.location.hash.replace('#', '');
            const hashParams = new URLSearchParams(hashString);
            const webAppDataStr = hashParams.get('WebAppData');
            
            if (webAppDataStr) {
              const webAppData = new URLSearchParams(decodeURIComponent(webAppDataStr));
              const userStr = webAppData.get('user');
              if (userStr) {
                const userData = JSON.parse(decodeURIComponent(userStr));
                maxUserId = userData.id?.toString() || null;
              }
            }
          }
        }
      } catch (e) {
        console.error('[MAX Auth] URL Parse Error:', e);
      }

      if (maxUserId) {
        console.log('[Dispatcher] MAX environment detected, attempting auto-login for:', maxUserId);
        const maxAuth = await fetch('/api/auth/max', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData: { max_user_id: maxUserId } }),
        });

        if (maxAuth.ok) {
          console.log('[Dispatcher] MAX auto-login successful');
        } else {
          const errData = await maxAuth.json();
          throw new Error(errData.error || 'MAX Auth Failed');
        }
      }

      const res = await fetch('/api/driver/me', { cache: 'no-store' }); 
      if (res.status === 401) {
        throw new Error('Unauthorized');
      }
      if (!res.ok) throw new Error('Not authenticated');
      return res.json();
    },
    retry: false,
  });

  useEffect(() => {
    if (isLoading) return;

    if (isError || !user) {
      // Если была ошибка МАХ авторизации (например 403 с ID), прокидываем её на страницу логина
      const errorMsg = isError ? (error as Error)?.message || 'Unauthorized' : '';
      
      // Если это ошибка "не зарегистрирован", НЕ ПЕРЕНАПРАВЛЯЕМ автоматически
      if (errorMsg.includes('MAX ID')) {
         setMaxError(errorMsg);
      } else {
         router.push('/login');
      }
      return;
    }

    const rawRoles = user.roles;
    const roles = Array.isArray(rawRoles) ? rawRoles : [];

    console.log('[Dispatcher Debug] Processing roles:', roles, 'for user:', user.name);

    const routes = [];
    if (roles.includes('admin') || roles.includes('owner')) {
      routes.push({ path: '/admin', label: '👑 Панель управления (Админ)' });
    }
    if (roles.includes('driver')) {
      routes.push({ path: '/driver', label: '🚛 Мои рейсы (Водитель)' });
    }
    if (roles.includes('mechanic') || roles.includes('mechanic_lead')) {
      routes.push({ path: '/mechanic', label: '🔧 Ремзона (Механик)' });
    }

    if (routes.length === 1) {
      // Если роль только одна — моментальный редирект
      router.push(routes[0].path);
    } else if (routes.length > 1) {
      // Если ролей несколько — показываем UI выбора
      setAvailableRoutes(routes);
    } else {
      // Если ролей нет или они неизвестны
      router.push('/login');
    }
  }, [user, isLoading, isError, error, router]);

  const handleCopy = () => {
    const match = maxError?.match(/MAX ID: (.*)\. /);
    const id = match ? match[1] : '';
    if (id) {
      navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const extractedId = maxError?.match(/MAX ID: (.*)\. /)?.[1];

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
        {maxError && extractedId ? (
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
                {extractedId}
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
        ) : maxError ? (
          <div className="space-y-4">
             <div className="text-4xl">🚫</div>
             <p className="text-red-600 font-bold text-sm leading-relaxed max-w-xs">{maxError}</p>
             <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">Перенаправление на вход...</p>
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
