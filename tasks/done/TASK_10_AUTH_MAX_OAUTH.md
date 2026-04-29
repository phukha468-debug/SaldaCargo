# TASK 10: Авторизация через МАХ OAuth

**Адресат:** Claude Code.
**Длительность:** 2 часа.
**Зависимости:** TASK_07 выполнен (БД и Supabase клиенты готовы).

---

## Цель

Реализовать авторизацию для обоих приложений:

- `apps/miniapp` — авторизация через MAX Mini App SDK (max_user_id из токена)
- `apps/web` — авторизация через magic-link (email, Supabase Auth) для admin/owner/accountant

**Интеграции НЕ реализуем:** Wialon, Опти24 — вне MVP.

---

## Алгоритм

### Шаг 1. Настроить Supabase Auth

В Supabase Dashboard → Authentication → Providers:

- **Email** — включить, отключить «Confirm email» (на MVP, чтобы не усложнять)
- **Phone** — отключить

В Authentication → URL Configuration:

- Site URL: `http://localhost:3000`
- Redirect URLs добавить:
  - `http://localhost:3000/**`
  - `http://localhost:3001/**`

### Шаг 2. Middleware для apps/web

Создай `apps/web/middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Публичные пути — не требуют авторизации
  const publicPaths = ['/login', '/auth/callback', '/auth/error'];
  const isPublic = publicPaths.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (user && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

### Шаг 3. Auth callback route для apps/web

Создай `apps/web/app/auth/callback/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`);
}
```

### Шаг 4. Страница логина для apps/web

Создай `apps/web/app/login/page.tsx`:

```tsx
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
```

### Шаг 5. Страница ошибки авторизации

Создай `apps/web/app/auth/error/page.tsx`:

```tsx
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
```

### Шаг 6. Хук текущего пользователя для apps/web

Создай `apps/web/lib/hooks/use-user.ts`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@saldacargo/shared-types';

interface UseUserResult {
  user: User | null;
  loading: boolean;
  error: string | null;
}

/**
 * Хук возвращает текущего пользователя из таблицы users.
 * Не из auth.users — оттуда только email.
 * Реальные данные (роли, имя, машина) — из нашей таблицы users.
 */
export function useUser(): UseUserResult {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function loadUser() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('max_user_id', authUser.id)
        .single();

      if (error) {
        // Попробуем по email (для web-логина через magic link)
        const { data: byEmail, error: emailError } = await supabase
          .from('users')
          .select('*')
          .eq('phone', authUser.email ?? '')
          .single();

        if (emailError) {
          setError('Пользователь не найден в системе');
        } else {
          setUser(byEmail as User);
        }
      } else {
        setUser(data as User);
      }
      setLoading(false);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading, error };
}
```

### Шаг 7. Авторизация для apps/miniapp (MAX SDK)

В MiniApp авторизация происходит через MAX Mini App SDK — SDK передаёт `init_data` с подписью, бэкенд проверяет подпись и выдаёт JWT.

Создай `apps/miniapp/lib/auth/max-auth.ts`:

```typescript
/**
 * Авторизация через МАХ Mini App.
 *
 * Поток:
 * 1. МАХ SDK передаёт initData при запуске приложения
 * 2. Мы отправляем initData на наш API route /api/auth/max
 * 3. API проверяет подпись МАХ и ищет пользователя по max_user_id
 * 4. Если найден — возвращает Supabase JWT
 * 5. Если не найден — возвращает 403 "Доступ запрещён"
 *
 * TODO (после MVP): реализовать реальную проверку подписи МАХ.
 * На MVP — проверяем только наличие max_user_id в таблице users.
 */

export interface MaxInitData {
  max_user_id: string;
  username?: string;
  // В продакшне здесь будет hash для верификации подписи
}

export async function authenticateWithMax(initData: MaxInitData): Promise<{
  success: boolean;
  error?: string;
}> {
  const response = await fetch('/api/auth/max', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData }),
  });

  if (!response.ok) {
    const data = (await response.json()) as { error?: string };
    return { success: false, error: data.error ?? 'Ошибка авторизации' };
  }

  return { success: true };
}
```

Создай `apps/miniapp/app/api/auth/max/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * POST /api/auth/max
 * Авторизация через МАХ Mini App.
 *
 * На MVP: просто проверяем что max_user_id есть в нашей БД.
 * После MVP: добавить верификацию подписи МАХ SDK.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as { initData?: { max_user_id?: string } };
  const maxUserId = body.initData?.max_user_id;

  if (!maxUserId) {
    return NextResponse.json({ error: 'Нет данных авторизации' }, { status: 400 });
  }

  const supabase = await createClient();

  // Ищем пользователя в нашей таблице
  const { data: user, error } = await supabase
    .from('users')
    .select('id, name, roles, is_active')
    .eq('max_user_id', maxUserId)
    .single();

  if (error || !user) {
    return NextResponse.json(
      { error: 'Доступ запрещён. Обратитесь к администратору.' },
      { status: 403 },
    );
  }

  if (!user.is_active) {
    return NextResponse.json(
      { error: 'Аккаунт деактивирован. Обратитесь к администратору.' },
      { status: 403 },
    );
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      roles: user.roles,
    },
  });
}
```

Создай `apps/miniapp/app/page.tsx` — стартовый экран с заглушкой авторизации:

```tsx
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
      setState('unauthorized');
      setError('Откройте приложение через МАХ');
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
```

### Шаг 8. Middleware для apps/miniapp

Создай `apps/miniapp/middleware.ts`:

```typescript
import { NextResponse, type NextRequest } from 'next/server';

/**
 * MiniApp не использует стандартный Supabase Auth —
 * авторизация через МАХ SDK (max_user_id).
 * Middleware только блокирует прямой доступ к API routes извне.
 */
export async function middleware(request: NextRequest) {
  // API routes открыты — авторизацию проверяет сам handler
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### Шаг 9. Проверка

```powershell
pnpm typecheck
pnpm lint
pnpm build
```

Открой http://localhost:3000/login — должна появиться форма с полем email.
Открой http://localhost:3001/?uid=test123 — должен появиться экран «Доступ запрещён» (пользователя нет в БД).

### Шаг 10. Коммит

```powershell
git add .
git commit -m "feat: авторизация web (magic-link) и miniapp (MAX SDK)

- apps/web: magic-link через Supabase Auth, middleware, /login страница
- apps/miniapp: MAX auth через API route /api/auth/max
- useUser хук для web
- Экраны: логин, ошибка, загрузка, доступ запрещён"
git push
```

---

## Критерии приёмки

- [ ] `apps/web/middleware.ts` создан и защищает роуты
- [ ] `apps/web/app/login/page.tsx` — форма magic-link
- [ ] `apps/web/app/auth/callback/route.ts` — обработка callback
- [ ] `apps/web/lib/hooks/use-user.ts` — хук пользователя
- [ ] `apps/miniapp/app/api/auth/max/route.ts` — endpoint авторизации
- [ ] `apps/miniapp/app/page.tsx` — стартовый экран с проверкой авторизации
- [ ] `pnpm typecheck` зелёный
- [ ] `pnpm build` зелёный
- [ ] http://localhost:3000/login открывается
- [ ] Коммит и push выполнены

---

## Что НЕ делать

- ❌ Не реализуй верификацию подписи МАХ SDK — это после MVP
- ❌ Не добавляй OAuth через Google/GitHub — только magic-link
- ❌ Не делай роутинг по ролям в MiniApp — это TASK_11

---

## Отчёт

```
✅ TASK_10 выполнено

- Web login (magic-link): работает (middleware, callback, login page, error page)
- MiniApp MAX auth endpoint: работает (/api/auth/max)
- useUser хук: реализован для Web
- pnpm typecheck ✓ (с использованием eslint-disable/any из-за placeholder типов БД)
- pnpm build ✓
- Git: push успешно

Вопросы:
- При сборке Next.js 16 выдаёт предупреждение о депрекации middleware.ts в пользу proxy.ts. На данный момент оставлено как middleware.ts согласно заданию.
- Типы в database.types.ts всё ещё являются заглушками, поэтому в коде авторизации пришлось использовать временные приведения типов.
```
