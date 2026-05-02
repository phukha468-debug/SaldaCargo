# TASK 10: Интеграция авторизации через МАКС (Verified Contact)

**Адресат:** Gemini CLI / Claude Code.
**Длительность:** 60–90 минут.
**Зависимости:** TASK_09 выполнен (БД готова).

---

## Цель

Реализовать безопасную систему входа в MiniApp через верификацию номера телефона в мессенджере МАКС.
Вместо логина/пароля мы используем механизм `request_contact` с проверкой подлинности через HMAC-SHA256 на стороне сервера. Это гарантирует, что пользователь действительно владеет номером, привязанным к его аккаунту МАКС.

---

## Алгоритм

### Шаг 1. Реализация логики верификации (Domain Layer)

Создай утилиту для проверки хеша в модуле `identity`.
Файл: `packages/domain/identity/src/utils/max-auth.ts`

```typescript
import { createHmac } from 'crypto';

/**
 * Проверяет подлинность контакта МАКС через HMAC-SHA256.
 * @param vcfInfo - Строка данных контакта из мессенджера.
 * @param hash - Присланный мессенджером хеш для проверки.
 * @param botToken - Токен вашего бота.
 */
export function verifyMaxContact(vcfInfo: string, hash: string, botToken: string): boolean {
  // Перед хешированием преобразуем символы \r\n в реальные переносы строк
  const normalizedVcf = vcfInfo.replace(/\\r\\n/g, '\r\n');

  const computedHash = createHmac('sha256', botToken)
    .update(normalizedVcf)
    .digest('hex');

  return computedHash === hash;
}
Шаг 2. Создание API-роута авторизации
Создай эндпоинт в MiniApp, который принимает данные контакта и выдает сессию.
Файл: apps/miniapp/app/api/auth/verify/route.ts

TypeScript
import { NextResponse } from 'next/server';
import { verifyMaxContact } from '@saldacargo/domain-identity/utils/max-auth';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const { vcf_info, hash, phone } = await request.json();
  const botToken = process.env.MAX_BOT_TOKEN;

  if (!botToken) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  // 1. Проверяем подпись МАКС
  const isValid = verifyMaxContact(vcf_info, hash, botToken);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid contact signature' }, { status: 401 });
  }

  // 2. Ищем пользователя по номеру телефона в БД
  const supabase = await createClient();
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: 'User not found or access denied' }, { status: 403 });
  }

  // 3. Устанавливаем сессию (здесь может быть создание JWT или установка куки)
  // Для MVP используем защищенную куку с ID пользователя
  const response = NextResponse.json({ success: true, role: user.roles[0] });
  response.cookies.set('salda_user_id', user.id, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/'
  });

  return response;
}
Шаг 3. Обновление Middleware для защиты роутов
Файл: apps/miniapp/middleware.ts
Обнови логику, чтобы она проверяла наличие куки salda_user_id. Если её нет — редирект на /login.

Шаг 4. Интерфейс входа в MiniApp
Файл: apps/miniapp/app/login/page.tsx
Реализуй экран, который объясняет пользователю, как войти.

TypeScript
import { APP_CONFIG } from '@saldacargo/constants';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-50">
      <div className="text-center max-w-sm">
        <h1 className="text-2xl font-bold mb-4">{APP_CONFIG.COMPANY_NAME}</h1>
        <p className="text-slate-600 mb-8">
          Для использования приложения необходимо подтвердить ваш номер телефона в чате с ботом.
        </p>
        <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 border border-blue-100">
          Нажмите кнопку <strong>"Поделиться контактом"</strong> в чате МАКС, чтобы войти в систему.
        </div>
      </div>
    </main>
  );
}
Шаг 5. Инструкция для пользователя (Manual Step)
Чтобы этот механизм заработал, тебе нужно отправить боту конфигурацию кнопок через API:

Бот должен отправить сообщение с кнопкой типа request_contact.

Также бот должен иметь кнопку open_app, которая ведет на URL твоего MiniApp.

Шаг 6. Настройка заголовков (Authorization)
При любых будущих запросах от сервера к API МАКС (например, для отправки уведомлений), используй заголовок:
Authorization: <MAX_BOT_TOKEN>.

Критерии приёмки
[ ] Создана функция verifyMaxContact с использованием HMAC-SHA256 и обработкой \r\n.

[ ] API эндпоинт /api/auth/verify корректно проверяет хеш и ищет пользователя в БД.

[ ] Middleware в MiniApp запрещает доступ к страницам без авторизации.

[ ] Все запросы к API МАКС используют корректный заголовок Authorization.

[ ] Коммит сделан и запушен.

Отчёт после выполнения
✅ TASK_ выполнено

Реализовано:
- Криптографическая проверка контактов МАКС (HMAC-SHA256)
- Защита маршрутов через Middleware
- Эндпоинт верификации пользователя по телефону

Конфигурация:
- Добавлен MAX_BOT_TOKEN в .env (убедитесь, что он там есть)
- Обработка форматов VCF согласно документации МАКС
```
