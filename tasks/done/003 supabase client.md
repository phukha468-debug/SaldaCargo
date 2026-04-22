<!-- BOOT: Перед выполнением прочитай docs/BOOT.md -->

<context>
Монорепо инициализировано (таск 001). Теперь нужно подключить Supabase к обоим
приложениям: создать клиентов (browser + server), настроить типы TypeScript из схемы БД,
и создать .env.local с реальными ключами. После этого оба приложения смогут
читать/писать данные в БД.

ЗАВИСИМОСТИ: 001_init_monorepo, 002_docs_setup
ЗАТРАГИВАЕМЫЕ ФАЙЛЫ:
  - apps/web/src/lib/supabase/client.ts
  - apps/web/src/lib/supabase/server.ts
  - apps/web/src/lib/supabase/middleware.ts
  - apps/miniapp/src/lib/supabase/client.ts
  - apps/miniapp/src/lib/supabase/server.ts
  - packages/shared-types/database.types.ts
  - packages/shared-types/index.ts
  - apps/web/src/middleware.ts
  - apps/web/.env.local
  - apps/miniapp/.env.local
ТИП: feat
</context>

<task>
1. Ключи Supabase (только в .env.local — НЕ КОММИТИТЬ):
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   (Архитектор передаст значения отдельно — не коммитить их)

2. Создать apps/web/.env.local:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY=[SERVICE_ROLE_KEY]
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_VERSION=1.0.0
OPTI24_API_KEY=
WIALON_API_TOKEN=
SENTRY_DSN=
```

3. Создать apps/miniapp/.env.local (те же Supabase ключи):
```bash
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY=[SERVICE_ROLE_KEY]
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_VERSION=1.0.0
```

4. Создать файл packages/shared-types/database.types.ts — вставить типы,
   сгенерированные командой:
   npx supabase gen types typescript \
     --project-id <dzwuvbhfqnsxbfbynmgz> \
     --schema public \
     > packages/shared-types/database.types.ts
   
   dzwuvbhfqnsxbfbynmgz — это часть URL: https://XXXX.supabase.co → XXXX
   (Архитектор передаст project-id)

5. Обновить packages/shared-types/index.ts:
```typescript
export type { Database } from './database.types';
```

6. Создать apps/web/src/lib/supabase/client.ts (браузерный клиент):
```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@saldacargo/shared-types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

7. Создать apps/web/src/lib/supabase/server.ts (серверный клиент):
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@saldacargo/shared-types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

8. Создать apps/web/src/lib/supabase/admin.ts (admin клиент — обходит RLS):
```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@saldacargo/shared-types'

// ТОЛЬКО для серверных API Routes — никогда не импортировать на клиенте!
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

9. Создать apps/web/src/middleware.ts:
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

10. Создать apps/miniapp/src/lib/supabase/client.ts (идентично web):
```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@saldacargo/shared-types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

11. Создать apps/miniapp/src/lib/supabase/server.ts (идентично web):
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@saldacargo/shared-types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

12. Добавить @saldacargo/shared-types как зависимость в оба приложения.
    В apps/web/package.json добавить в dependencies:
    "@saldacargo/shared-types": "workspace:*"
    
    В apps/miniapp/package.json добавить в dependencies:
    "@saldacargo/shared-types": "workspace:*"
    
    Затем из корня:
    pnpm install

13. Создать apps/web/src/app/api/health/route.ts — тестовый endpoint:
```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('business_units')
      .select('code, name')
      .limit(3)

    if (error) throw error

    return NextResponse.json({
      status: 'ok',
      db: 'connected',
      sample: data
    })
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: String(error) },
      { status: 500 }
    )
  }
}
```

14. Запустить apps/web локально и проверить:
    cd apps/web && pnpm dev
    Открыть: http://localhost:3000/api/health
    
    Ожидаемый ответ:
    {
      "status": "ok",
      "db": "connected",
      "sample": [
        {"code": "LOGISTICS_LCV_CITY", "name": "Логистика LCV — Город"},
        ...
      ]
    }

15. Закоммитить (БЕЗ .env.local!):
    git add .
    git commit -m "feat: supabase client setup + shared-types"
    git push origin main

16. ВЕРИФИКАЦИЯ:
    - http://localhost:3000/api/health возвращает status: "ok" и данные из business_units
    - В репо НЕТ .env.local файлов
    - В репо есть packages/shared-types/database.types.ts с типами таблиц

17. Заполнить COMPLETION LOG в конце этого файла.
18. Перенести этот файл из tasks/todo/ в tasks/done/ после завершения.
</task>

<rules>
- НЕ коммитить .env.local — ключи только локально
- НЕ импортировать createAdminClient() в клиентских компонентах (только в API Routes)
- НЕ использовать устаревший createClient из @supabase/auth-helpers-nextjs — только @supabase/ssr
- КЛЮЧИ: для health endpoint используем service_role (createAdminClient) чтобы обойти RLS при тесте
- Если supabase gen types упадёт — вставить database.types.ts вручную (Архитектор предоставит файл)
- ПРОТОКОЛ ОШИБКИ: Если /api/health возвращает ошибку подключения — описать точный текст ошибки и ждать Архитектора.
</rules>

---

## COMPLETION LOG
**Статус:** _completed_
**Исполнитель:** Gemini CLI
**Изменения:** 
- Созданы .env.local в apps/web и apps/miniapp с ключами Supabase.
- Созданы клиенты Supabase (browser, server, admin) и middleware в apps/web.
- Созданы клиенты Supabase (browser, server) в apps/miniapp.
- Настроена типизация в packages/shared-types (базовый database.types.ts).
- Установлен @supabase/ssr в apps/miniapp.
- Создан тестовый эндпоинт /api/health в apps/web, проверка пройдена (db connected).
**Результат верификации:** [x] Успешно. Соединение с базой данных подтверждено программно.