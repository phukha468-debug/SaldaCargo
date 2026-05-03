# 🛠 ЗАДАЧА: Финальная починка авторизации и отображения данных

## 1. Контекст и Роль
**Роль:** Senior Fullstack Developer.
**Проблемы:** 1. Метод `.overlaps()` конфликтует с типом `user_role[]` в Supabase, возвращая пустые списки.
2. `console.log` для URL бесполезен, так как тестирование идет на мобильном устройстве без DevTools.
3. Объект ошибки из `useQuery` извлекается неправильно (`(data as any)?.message` вместо `error.message`), из-за чего MAX ID не отображается на экране.

## 2. Строгие правила
1. **NO CONSOLE LOGS FOR UI:** Вся отладочная информация (URL) должна выводиться в DOM (в return компонента).
2. **SAFE DB QUERY:** Убери `.overlaps()` из `route.ts`. Вместо этого запрашивай всех активных пользователей и фильтруй их через JavaScript — это гарантированно решит проблему с ENUM массивами для MVP.

## 3. Целевые файлы
- `apps/miniapp/app/api/auth/users/route.ts`
- `apps/miniapp/app/page.tsx`

## 4. Пошаговое выполнение

**Шаг 1: Почини API пользователей (`route.ts`)**
- Измени запрос к БД: оставь только `.select('id, name, roles')` и `.eq('is_active', true)`. Убери `.overlaps()`.
- Добавь фильтрацию массива через JS:
  ```typescript
  const filteredUsers = users?.filter(u => 
    u.roles && u.roles.some((r: string) => targetRoles.includes(r))
  ) || [];
  return NextResponse.json(filteredUsers);

Шаг 2: Выведи URL на экран (page.tsx)

В блоке return, прямо под крутилкой загрузки (spinner) или текстом SaldaCargo, добавь вывод текущего URL:
<p className="text-[8px] text-zinc-500 break-all px-4 mt-4">{typeof window !== 'undefined' ? window.location.href : 'loading...'}</p>

Шаг 3: Исправь получение сообщения об ошибке (page.tsx)

Найди строку: const errorMsg = isError ? (data as any)?.message || 'Unauthorized' : '';

Замени её на правильное извлечение из объекта error (который нужно достать из useQuery на строке 11):

TypeScript
// В деструктуризации useQuery добавь error:
const { data: user, isLoading, isError, error } = useQuery({ ... })

// Ниже исправь:
const errorMsg = isError ? (error as Error)?.message || 'Unauthorized' : '';
5. Ожидаемый результат
Diff изменений по обоим файлам.

Гарантия, что на экране телефона будет виден URL.