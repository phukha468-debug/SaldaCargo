# 🛠 ЗАДАЧА 26: Обход RLS для API авторизации МАХ

## 1. Контекст
**Проблема:** Роут `/api/auth/max` получает правильный `maxUserId`, но не может найти его в БД (возвращает 403 и экран регистрации).
**Причина:** API использует обычный клиент (`anon key`). Политики RLS блокируют чтение таблицы `users` для неавторизованных запросов. 
**Решение:** Для поиска по `max_user_id` на этапе логина необходимо использовать Service Role Key (админский клиент), который игнорирует RLS.

## 2. Строгие правила
- Изменить ТОЛЬКО подключение к БД в этом конкретном роуте.

## 3. Пошаговое выполнение
Открой файл: `apps/miniapp/app/api/auth/max/route.ts` (или аналогичный, где обрабатывается POST запрос для MAX).

**Шаг 1: Используй админский ключ**
Убедись, что при поиске пользователя используется `SUPABASE_SERVICE_ROLE_KEY`.
Пример:
```typescript
import { createClient } from '@supabase/supabase-js';

// Внутри функции POST:
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // <- ВАЖНО!
);

const { data: user, error } = await supabaseAdmin
  .from('users')
  .select('*')
  .eq('max_user_id', maxUserId)
  .single();
Шаг 2: Добавь отладочный лог
Сразу после запроса к БД добавь лог, чтобы мы видели, что ответила база:

TypeScript
console.log('[MAX Auth DB Result]:', { userId: user?.id, error: error?.message });
4. Ожидаемый результат
Diff файла API с внедренным supabaseAdmin и логом.