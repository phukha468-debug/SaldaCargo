# 🛠 ЗАДАЧА 30: Жесткое восстановление логики RootDispatcher

## 1. Контекст
**Критический баг:** В результате прошлого рефакторинга сломался показ MAX ID для незарегистрированных пользователей. Приложение агрессивно редиректит всех на `/login`. На странице `/login` падает список пользователей из-за RLS.

## 2. Задача
Твоя задача — полностью заменить логику авторизации внутри `useEffect` в файле `apps/miniapp/app/page.tsx` на предоставленный ниже эталонный код. 

## 3. Эталонный код для `app/page.tsx`

Убедись, что стейты компонента выглядят так:
```typescript
const [unregisteredId, setUnregisteredId] = useState<string | null>(null);
const [availableRoutes, setAvailableRoutes] = useState<{path: string, label: string}[] | null>(null);
const router = useRouter();
Замени текущий useEffect на этот строгий флоу:
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
          body: JSON.stringify({ maxUserId })
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

4. Ожидаемый результат
Вставь этот код в app/page.tsx.

Если unregisteredId не null — должен рендериться экран "Ваш аккаунт еще не активирован" с ID (он у тебя уже был написан, просто убедись, что он показывается).

Проверь билд и запушь изменения.