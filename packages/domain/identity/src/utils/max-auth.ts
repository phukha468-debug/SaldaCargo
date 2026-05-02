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
