# 🛠 ЗАДАЧА 22: Парсинг реального URL мессенджера MAX

## 1. Контекст и Роль
**Роль:** Senior Fullstack Developer.
**Проблема:** Мессенджер МАХ передает данные не через `window.location.search`, а через дважды закодированный JSON внутри `window.location.hash` (`#WebAppData=...&user={"id":123...}`). Из-за этого текущая авторизация пропускает реальных пользователей.

## 2. Строгие правила
1. **NO REFACTORING:** Не меняй логику UI (ПИН-код оставь как фоллбэк).
2. **CLEANUP:** Удали зеленую отладочную полосу (`div` с классом `absolute top-0 left-0 w-full bg-black...`), которую мы добавляли в Task 21.

## 3. Целевой файл
- `apps/miniapp/app/page.tsx`

## 4. Пошаговое выполнение

**Шаг 1: Напиши правильный парсер URL**
Найди блок, где извлекается `maxUserId` (строки 15-16), и замени логику на эту безопасную конструкцию:

```typescript
let maxUserId = null;
try {
  // Парсим hash (например: #WebAppData=chat%3D...%26user%3D%257B%2522id%2522%253A56628256...)
  const hashString = window.location.hash.replace('#', '');
  const hashParams = new URLSearchParams(hashString);
  const webAppDataStr = hashParams.get('WebAppData');
  
  if (webAppDataStr) {
    const webAppData = new URLSearchParams(decodeURIComponent(webAppDataStr));
    const userStr = webAppData.get('user');
    if (userStr) {
      const userData = JSON.parse(decodeURIComponent(userStr));
      maxUserId = userData.id?.toString();
    }
  }
} catch (e) {
  console.error('[MAX Auth] URL Parse Error:', e);
}
Шаг 2: Убедись, что POST-запрос использует этот ID
Убедись, что ниже по коду (в fetch('/api/auth/max')) отправляется найденный maxUserId.