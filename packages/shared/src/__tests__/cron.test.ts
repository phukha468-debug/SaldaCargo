import { describe, it, expect } from 'vitest';
import { verifyCronAuthorization } from '../cron';

describe('cron authorization', () => {
  it('accepts exact Bearer CRON_SECRET', () => {
    const res = verifyCronAuthorization(
      'Bearer super-secret-cron-token',
      'super-secret-cron-token',
    );
    expect(res).toEqual({ ok: true });
  });

  it('returns 401 when header is missing or does not match', () => {
    expect(verifyCronAuthorization(null, 'secret')).toMatchObject({ ok: false, status: 401 });
    expect(verifyCronAuthorization('Bearer wrong', 'secret')).toMatchObject({
      ok: false,
      status: 401,
    });
    expect(verifyCronAuthorization('secret', 'secret')).toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it('returns 503 when CRON_SECRET is not configured', () => {
    expect(verifyCronAuthorization('Bearer anything', null)).toMatchObject({
      ok: false,
      status: 503,
    });
  });
});
