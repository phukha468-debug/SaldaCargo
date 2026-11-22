import { describe, it, expect } from 'vitest';
import { checkRateLimit, getClientIp } from '../rateLimit';

describe('rateLimit', () => {
  it('allows requests within limit and blocks once exceeded', () => {
    const key = `test-rl-${Date.now()}-${Math.random()}`;
    const opts = { limit: 3, windowMs: 60_000 };

    const r1 = checkRateLimit(key, opts);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = checkRateLimit(key, opts);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = checkRateLimit(key, opts);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);

    const r4 = checkRateLimit(key, opts);
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
    expect(r4.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it('extracts client IP from proxy headers', () => {
    const req1 = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' },
    });
    expect(getClientIp(req1)).toBe('203.0.113.10');

    const req2 = new Request('http://localhost/api/test', {
      headers: { 'x-real-ip': '198.51.100.42' },
    });
    expect(getClientIp(req2)).toBe('198.51.100.42');

    const req3 = new Request('http://localhost/api/test');
    expect(getClientIp(req3)).toBe('unknown');
  });
});
