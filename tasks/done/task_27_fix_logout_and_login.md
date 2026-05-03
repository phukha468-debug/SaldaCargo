# 🛠 ЗАДАЧА 27: Починка кнопки "Выход" и зависания ПИН-кода

## 1. Контекст
**Проблема 1:** На мобильных устройствах сессия "залипает" (cookie не удаляется). Кнопка "Выход" (Logout) в нижнем тулбаре (интерфейс водителя/профиль) не работает, из-за чего невозможно сменить аккаунт.
**Проблема 2:** При входе через десктоп (fallback-сценарий без MAX) форма ручного ввода ПИН-кода зависает после отправки и не перекидывает пользователя на диспетчер ролей (`/`).

## 2. Пошаговое выполнение

**Шаг 1: Оживление кнопки "Выход" (Logout)**
1. Убедись, что существует API-роут для выхода, например `apps/miniapp/app/api/auth/logout/route.ts`. Он должен очищать сессию Supabase:
```typescript
import { createClient } from '@/utils/supabase/server'; // Или твой путь к серверному клиенту
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.json({ success: true });
}
Найди компонент, где находится кнопка "Выход" (скорее всего в Profile или BottomNav водителя).

Добавь рабочий обработчик onClick:

TypeScript
const handleLogout = async () => {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    // Обязательно делаем жесткую перезагрузку, чтобы сбросить стейты и куки
    window.location.href = '/login'; 
  } catch (error) {
    console.error('Logout failed', error);
  }
};
Шаг 2: Починка формы ПИН-кода (Login Freeze)

Открой страницу авторизации по ПИН-коду (apps/miniapp/app/login/page.tsx или аналогичную).

Найди функцию onSubmit или handleLogin.

Добавь строгий try/catch с обработкой ошибок. Убедись, что при успешном ответе от /api/auth/verify происходит редирект на корневой диспетчер /, который уже сам разберется с ролями:

TypeScript
try {
  const res = await fetch('/api/auth/verify', { /* ... */ });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Ошибка авторизации');
  }
  // Успешный вход -> отдаем управление диспетчеру
  router.push('/');
} catch (error) {
  setError(error.message);
  setIsLoading(false); // Снимаем зависание!
}
3. Ожидаемый результат
Рабочая кнопка выхода, которая убивает куки и выкидывает на /login.

Форма ПИН-кода, которая не виснет в бесконечном лоадере, а либо показывает ошибку, либо пускает в /.