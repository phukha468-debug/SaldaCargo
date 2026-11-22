import { getSessionSecret } from './env';

export const SESSION_COOKIE_WEB = 'salda_auth_token';
export const SESSION_COOKIE_MINIAPP = 'salda_session';

export interface SessionPayload {
  uid: string;
  oid?: string;
  roles: string[];
  iat: number;
  exp: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(str: string): Uint8Array | null {
  try {
    const padded = str.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (padded.length % 4)) % 4;
    const binary = atob(padded + '='.repeat(padLength));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i]! ^ b[i]!;
  }
  return diff === 0;
}

/**
 * Создаёт криптографически подписанный сессионный токен (HMAC-SHA256).
 * Совместим с Edge Runtime (Next.js middleware/proxy) и Node.js.
 */
export async function signSessionToken(
  input: { uid: string; oid?: string; roles: string[]; ttlSeconds?: number },
  secretOverride?: string,
): Promise<string> {
  const secret = secretOverride ?? getSessionSecret();
  if (!secret) {
    throw new Error('AUTH_SESSION_SECRET is not configured (minimum 32 characters)');
  }

  const now = Math.floor(Date.now() / 1000);
  const ttl = input.ttlSeconds ?? 60 * 60 * 24 * 7; // 7 дней по умолчанию
  const payload: SessionPayload = {
    uid: input.uid,
    ...(input.oid ? { oid: input.oid } : {}),
    roles: Array.isArray(input.roles) ? input.roles : [],
    iat: now,
    exp: now + ttl,
  };

  const payloadB64 = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await importHmacKey(secret);
  const signatureBuffer = await globalThis.crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payloadB64),
  );
  const signatureB64 = toBase64Url(new Uint8Array(signatureBuffer));

  return `${payloadB64}.${signatureB64}`;
}

/**
 * Проверяет подпись и срок жизни сессионного токена.
 * Возвращает SessionPayload или null при невалидной/просроченной подписи.
 */
export async function verifySessionToken(
  token: string | undefined | null,
  secretOverride?: string,
): Promise<SessionPayload | null> {
  if (!token || typeof token !== 'string') return null;

  const secret = secretOverride ?? getSessionSecret();
  if (!secret) return null;

  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0 || dotIdx !== token.lastIndexOf('.')) return null;

  const payloadB64 = token.slice(0, dotIdx);
  const sigB64 = token.slice(dotIdx + 1);
  if (!payloadB64 || !sigB64) return null;

  const providedSig = fromBase64Url(sigB64);
  if (!providedSig) return null;

  try {
    const key = await importHmacKey(secret);
    const expectedBuffer = await globalThis.crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payloadB64),
    );
    const expectedSig = new Uint8Array(expectedBuffer);

    if (!timingSafeEqualBytes(providedSig, expectedSig)) {
      return null;
    }

    const payloadBytes = fromBase64Url(payloadB64);
    if (!payloadBytes) return null;

    const parsed = JSON.parse(decoder.decode(payloadBytes)) as Partial<SessionPayload>;
    if (
      typeof parsed.uid !== 'string' ||
      !parsed.uid ||
      typeof parsed.exp !== 'number' ||
      typeof parsed.iat !== 'number' ||
      !Array.isArray(parsed.roles)
    ) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (parsed.exp <= now) {
      return null;
    }

    return {
      uid: parsed.uid,
      ...(typeof parsed.oid === 'string' && parsed.oid ? { oid: parsed.oid } : {}),
      roles: parsed.roles.filter((r): r is string => typeof r === 'string'),
      iat: parsed.iat,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}
