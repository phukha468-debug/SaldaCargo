import { getCronSecret } from './env';

function constantTimeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Проверяет заголовок `Authorization: Bearer <CRON_SECRET>`.
 */
export function verifyCronAuthorization(
  authorizationHeader: string | null,
  secretOverride?: string | null,
): { ok: true } | { ok: false; status: 401 | 503; error: string } {
  const secret = secretOverride !== undefined ? secretOverride : getCronSecret();
  if (!secret) {
    return {
      ok: false,
      status: 503,
      error: 'CRON_SECRET не настроен в переменных окружения',
    };
  }

  const expected = `Bearer ${secret}`;
  if (!authorizationHeader || !constantTimeEqualStrings(authorizationHeader, expected)) {
    return {
      ok: false,
      status: 401,
      error: 'Unauthorized',
    };
  }

  return { ok: true };
}
