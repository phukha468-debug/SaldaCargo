/**
 * Авторизация через МАХ Mini App.
 *
 * Поток:
 * 1. МАХ SDK передаёт initData при запуске приложения
 * 2. Мы отправляем initData на наш API route /api/auth/max
 * 3. API проверяет подпись МАХ и ищет пользователя по max_user_id
 * 4. Если найден — возвращает Supabase JWT
 * 5. Если не найден — возвращает 403 "Доступ запрещён"
 *
 * TODO (после MVP): реализовать реальную проверку подписи МАХ.
 * На MVP — проверяем только наличие max_user_id в таблице users.
 */

export interface MaxInitData {
  max_user_id: string;
  username?: string;
  // В продакшне здесь будет hash для верификации подписи
}

export async function authenticateWithMax(initData: MaxInitData): Promise<{
  success: boolean;
  error?: string;
}> {
  const response = await fetch('/api/auth/max', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData }),
  });

  if (!response.ok) {
    const data = (await response.json()) as { error?: string };
    return { success: false, error: data.error ?? 'Ошибка авторизации' };
  }

  return { success: true };
}
