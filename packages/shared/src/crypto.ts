import * as crypto from 'crypto';
import { requireEncryptionMasterKey } from './env';

const VERSION_PREFIX = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

function deriveAesKey(masterKey: string): Buffer {
  const clean = masterKey.trim();
  // Если передан 64-символьный hex (ровно 32 байта) — используем напрямую
  if (/^[0-9a-fA-F]{64}$/.test(clean)) {
    return Buffer.from(clean, 'hex');
  }
  // Иначе детерминированно приводим к 32 байтам через SHA-256
  return crypto.createHash('sha256').update(clean, 'utf8').digest();
}

/**
 * Шифрует строку секрета алгоритмом AES-256-GCM.
 * Формат: v1:<iv_base64url>:<authTag_base64url>:<ciphertext_base64url>
 */
export function encryptSecret(plaintext: string, masterKeyOverride?: string): string {
  const masterKey = masterKeyOverride ?? requireEncryptionMasterKey();
  const key = deriveAesKey(masterKey);
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION_PREFIX,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

/**
 * Дешифрует строку секрета, зашифрованную через `encryptSecret`.
 * Бросает ошибку при неверном ключе, подделке authTag или битом формате.
 */
export function decryptSecret(payload: string, masterKeyOverride?: string): string {
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION_PREFIX) {
    throw new Error('Invalid encrypted secret format');
  }

  const [, ivB64, tagB64, dataB64] = parts;
  if (!ivB64 || !tagB64 || dataB64 === undefined) {
    throw new Error('Incomplete encrypted secret payload');
  }

  const masterKey = masterKeyOverride ?? requireEncryptionMasterKey();
  const key = deriveAesKey(masterKey);
  const iv = Buffer.from(ivB64, 'base64url');
  const authTag = Buffer.from(tagB64, 'base64url');
  const ciphertext = Buffer.from(dataB64, 'base64url');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Шифрует объект с секретами интеграции (например, `{ apiToken: '...' }`) в строку для БД.
 */
export function encryptJsonSecrets(
  secrets: Record<string, unknown>,
  masterKeyOverride?: string,
): string {
  return encryptSecret(JSON.stringify(secrets), masterKeyOverride);
}

/**
 * Дешифрует объект с секретами интеграции из колонки `organization_integrations.encrypted_secrets`.
 */
export function decryptJsonSecrets<T extends Record<string, unknown> = Record<string, string>>(
  payload: string,
  masterKeyOverride?: string,
): T {
  const json = decryptSecret(payload, masterKeyOverride);
  return JSON.parse(json) as T;
}
