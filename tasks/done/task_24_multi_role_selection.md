**Роль:** Senior Fullstack Developer.
**Проблема:** В данный момент диспетчер (`app/page.tsx`) имеет жесткую иерархию редиректов (сначала admin, потом mechanic, потом driver). Если у пользователя (например, владельца) есть роли `["owner", "driver", "mechanic"]`, он всегда попадает только в `/admin` и не может открыть интерфейс водителя.
**Цель:** Если у пользователя доступно более одного раздела, остановить автоматический редирект и показать экран с кнопками выбора нужного раздела. Если доступен только один раздел — оставить автоматический редирект.

## 2. Строгие правила
1. **NO MAX AUTH REFACTORING:** Ни в коем случае не трогай логику парсинга URL мессенджера МАХ и экран "Вы еще не зарегистрированы" с показом ID. Эта часть работает идеально.
2. **SAFE STATE:** Добавь новый стейт для хранения доступных маршрутов, чтобы рендерить UI.

## 3. Целевой файл
- `apps/miniapp/app/page.tsx`

## 4. Пошаговое выполнение

**Шаг 1: Добавь стейт для выбора маршрута**
Внутри компонента `RootDispatcher` добавь:
```typescript
const [availableRoutes, setAvailableRoutes] = useState<{path: string, label: string}[] | null>(null);
Шаг 2: Измени логику в useEffect
Найди блок кода, где проверяются роли (if (roles.includes('admin') || ...)).
Замени его на динамический сбор доступных маршрутов:

TypeScript
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
Шаг 3: Отрисуй UI кнопок
В блоке return (...), там где сейчас крутится лоадер (animate-spin), добавь проверку: если availableRoutes не пустой, покажи кнопки.
Пример структуры:

TypeScript
if (availableRoutes) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-xs space-y-6">
        <h1 className="text-xl font-black text-slate-800 text-center mb-8">Выберите роль</h1>
        {availableRoutes.map(route => (
          <button
            key={route.path}
            onClick={() => router.push(route.path)}
            className="w-full p-4 bg-white border border-slate-200 rounded-2xl shadow-sm text-left text-slate-700 font-bold active:scale-95 transition-transform"
          >
            {route.label}
          </button>
        ))}
      </div>
    </div>
  );
}
(Убедись, что этот возврат UI не перекрывает вывод ошибки с MAX ID из предыдущей задачи).

5. Ожидаемый результат
Diff файла page.tsx с новой логикой маршрутизации и UI.