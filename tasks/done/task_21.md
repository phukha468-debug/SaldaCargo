# 🛠 ЗАДАЧА 21: Принудительный вывод URL для отладки МАХ

## 1. Контекст и Роль
**Роль:** Senior Fullstack Developer.
**Проблема:** Мессенджер МАХ не передает параметр `?uid=`, из-за чего логика авто-входа в `app/page.tsx` пропускается. Нам нужно визуально увидеть полную ссылку запуска, включая параметры после `#` (hash).

## 2. Строгие правила
1. **NO REFACTORING:** Не меняй текущую логику авторизации.
2. **UGLY BUT VISIBLE:** Добавь отладочный блок поверх всего интерфейса.

## 3. Целевой файл
- `apps/miniapp/app/page.tsx` (или `LoginPage`, если логика перенесена туда).

## 4. Пошаговое выполнение

**Шаг 1: Добавь стейт для полного URL**
Внутри главного компонента страницы добавь:
```typescript
const [debugInfo, setDebugInfo] = useState('');
useEffect(() => {
  setDebugInfo(window.location.href);
}, []);
Шаг 2: Выведи это поверх экрана
В самом начале блока return (...) (сразу после первого <div> или <main>) вставь этот код:

TypeScript
<div className="absolute top-0 left-0 w-full bg-black text-green-400 text-[10px] break-all p-2 z-[9999] opacity-90">
  URL: {debugInfo}
</div>