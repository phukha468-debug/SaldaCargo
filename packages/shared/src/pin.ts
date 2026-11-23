import * as crypto from 'crypto';
import { encryptSecret, decryptSecret } from './crypto';
import { getSessionSecret, getEncryptionMasterKey } from './env';

const SCRYPT_PREFIX = 'scrypt:';
const KEY_LENGTH = 32;

function resolvePinEncryptionKeys(masterKeyOverride?: string): string[] {
  if (masterKeyOverride && masterKeyOverride.trim().length >= 32) {
    return [masterKeyOverride.trim()];
  }
  const keys: string[] = [];
  const encKey = getEncryptionMasterKey();
  if (encKey) keys.push(encKey);
  const authKey = getSessionSecret();
  if (authKey && !keys.includes(authKey)) keys.push(authKey);
  return keys;
}

/**
 * Шифрует PIN-код алгоритмом AES-256-GCM для возможности просмотра администратором.
 * Если мастер-ключ шифрования не настроен в окружении — возвращает null (не ломает сохранение scrypt-хеша).
 */
export function encryptPin(pin: string, masterKeyOverride?: string): string | null {
  const cleanPin = String(pin).trim();
  if (!cleanPin) return null;
  const [primaryKey] = resolvePinEncryptionKeys(masterKeyOverride);
  if (!primaryKey) return null;
  return encryptSecret(cleanPin, primaryKey);
}

/**
 * Расшифровывает PIN-код, зашифрованный через `encryptPin`.
 * Возвращает null при отсутствии значения, неверном формате или ключе.
 */
export function decryptPin(
  encrypted: string | null | undefined,
  masterKeyOverride?: string,
): string | null {
  if (!encrypted || typeof encrypted !== 'string') return null;
  const keys = resolvePinEncryptionKeys(masterKeyOverride);
  for (const key of keys) {
    try {
      return decryptSecret(encrypted, key);
    } catch {
      // Пробуем следующий доступный ключ (например, fallback при ротации)
    }
  }
  return null;
}

export function isHashedPin(stored: string | null | undefined): boolean {
  return typeof stored === 'string' && stored.startsWith(SCRYPT_PREFIX);
}

/**
 * Хэширует PIN-код с помощью scrypt и случайной 16-байтной соли.
 * Формат: scrypt:<salt_hex>:<hash_hex>
 */
export function hashPin(pin: string): string {
  const cleanPin = String(pin).trim();
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(cleanPin, salt, KEY_LENGTH).toString('hex');
  return `${SCRYPT_PREFIX}${salt}:${derived}`;
}

/**
 * Проверяет PIN-код с обратной совместимостью:
 * - если в БД уже scrypt-хэш — сверяет через scrypt + timingSafeEqual (`needsRehash: false`);
 * - если в БД legacy plaintext PIN — сверяет через SHA-256 + timingSafeEqual и возвращает `needsRehash: true`,
 *   чтобы вызывающий роут прозрачно обновил запись на scrypt-хэш.
 */
export function verifyPin(
  inputPin: string,
  storedPin: string | null | undefined,
): { valid: boolean; needsRehash: boolean } {
  if (!storedPin || typeof storedPin !== 'string') {
    return { valid: false, needsRehash: false };
  }

  const cleanInput = String(inputPin).trim();
  const cleanStored = storedPin.trim();
  if (!cleanInput || !cleanStored) {
    return { valid: false, needsRehash: false };
  }

  if (cleanStored.startsWith(SCRYPT_PREFIX)) {
    const parts = cleanStored.slice(SCRYPT_PREFIX.length).split(':');
    if (parts.length !== 2) {
      return { valid: false, needsRehash: false };
    }
    const [salt, storedHashHex] = parts;
    if (!salt || !storedHashHex) {
      return { valid: false, needsRehash: false };
    }

    try {
      const derivedBuf = crypto.scryptSync(cleanInput, salt, KEY_LENGTH);
      const storedBuf = Buffer.from(storedHashHex, 'hex');
      if (derivedBuf.length !== storedBuf.length) {
        return { valid: false, needsRehash: false };
      }
      return {
        valid: crypto.timingSafeEqual(derivedBuf, storedBuf),
        needsRehash: false,
      };
    } catch {
      return { valid: false, needsRehash: false };
    }
  }

  // Legacy plaintext PIN — constant-time сравнение через SHA-256
  const inputDigest = crypto.createHash('sha256').update(cleanInput).digest();
  const storedDigest = crypto.createHash('sha256').update(cleanStored).digest();
  const valid = crypto.timingSafeEqual(inputDigest, storedDigest);
  return { valid, needsRehash: valid };
}
