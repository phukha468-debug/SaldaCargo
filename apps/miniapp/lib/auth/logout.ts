/**
 * Единая надёжная функция выхода из аккаунта для всего MiniApp.
 * Очищает клиентские куки, localStorage, sessionStorage,
 * вызывает серверные эндпоинты сброса сессии и перенаправляет на экран выбора роли.
 */
export async function performLogout(): Promise<void> {
  try {
    // 1. Очищаем клиентское локальное хранилище
    if (typeof window !== 'undefined') {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (storageErr) {
        console.warn('Storage clear error:', storageErr);
      }

      // 2. Очищаем клиентскую куку во всех возможных вариациях SameSite
      const expireStr = '=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      document.cookie = `salda_user_id${expireStr} SameSite=None; Secure;`;
      document.cookie = `salda_user_id${expireStr} SameSite=Lax;`;
      document.cookie = `salda_user_id${expireStr}`;
    }

    // 3. Сбрасываем серверную сессию (не блокируем, если сеть недоступна)
    await Promise.allSettled([
      fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' }),
      fetch('/api/auth/session', { method: 'DELETE', cache: 'no-store' }),
    ]);
  } catch (err) {
    console.error('Logout error:', err);
  } finally {
    // 4. Гарантированно перенаправляем на выбор роли с флагом logout
    if (typeof window !== 'undefined') {
      window.location.replace('/?step=role&logout=true');
    }
  }
}
