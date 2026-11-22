import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { createApiHandler, ApiError } from '../apiHandler';
import { EnvConfigError } from '../env';

describe('createApiHandler', () => {
  it('validates body & query with Zod and passes parsed context', async () => {
    const handler = createApiHandler(
      {
        routeName: '/api/test',
        querySchema: z.object({ page: z.coerce.number().int().positive() }),
        bodySchema: z.object({ amount: z.number().positive() }),
        resolveAuth: async () => ({ userId: 'u1', roles: ['admin'] }),
      },
      async ({ body, query, auth, params }) =>
        new Response(JSON.stringify({ body, query, auth, params }), { status: 200 }),
    );

    const req = new Request('http://localhost/api/test?page=2', {
      method: 'POST',
      body: JSON.stringify({ amount: 1500 }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await handler(req, { params: Promise.resolve({ id: '42' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      body: { amount: 1500 },
      query: { page: 2 },
      auth: { userId: 'u1', roles: ['admin'] },
      params: { id: '42' },
    });
  });

  it('returns 400 on invalid JSON or Zod validation failure', async () => {
    const handler = createApiHandler(
      { bodySchema: z.object({ amount: z.number().positive() }) },
      async () => new Response('ok'),
    );

    const badJson = new Request('http://localhost/api/test', {
      method: 'POST',
      body: '{invalid-json',
    });
    expect((await handler(badJson)).status).toBe(400);

    const badBody = new Request('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({ amount: -10 }),
    });
    const res = await handler(badBody);
    expect(res.status).toBe(400);
    const payload = (await res.json()) as { details?: Record<string, unknown> };
    expect(payload.details?.amount).toBeDefined();
  });

  it('short-circuits when resolveAuth returns a Response (401/403)', async () => {
    const handler = createApiHandler(
      {
        resolveAuth: async () =>
          new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
      },
      async () => new Response('should not reach', { status: 200 }),
    );

    const res = await handler(new Request('http://localhost/api/test'));
    expect(res.status).toBe(403);
  });

  it('maps ApiError, EnvConfigError (503), and rateLimit (429)', async () => {
    const apiErrHandler = createApiHandler({}, async () => {
      throw new ApiError(409, 'Conflict', 'DUPLICATE');
    });
    const res409 = await apiErrHandler(new Request('http://localhost/api/test'));
    expect(res409.status).toBe(409);
    expect(await res409.json()).toEqual({ error: 'Conflict', code: 'DUPLICATE' });

    const envErrHandler = createApiHandler({}, async () => {
      throw new EnvConfigError('T-Bank', 'TBANK_API_TOKEN');
    });
    const res503 = await envErrHandler(new Request('http://localhost/api/test'));
    expect(res503.status).toBe(503);

    const rlPrefix = `api-rl-${Date.now()}`;
    const rlHandler = createApiHandler(
      { rateLimit: { keyPrefix: rlPrefix, limit: 1, windowMs: 60_000 } },
      async () => new Response('ok'),
    );
    const req = () =>
      new Request('http://localhost/api/test', { headers: { 'x-real-ip': '192.0.2.1' } });
    expect((await rlHandler(req())).status).toBe(200);
    const res429 = await rlHandler(req());
    expect(res429.status).toBe(429);
    expect(res429.headers.get('Retry-After')).toBeTruthy();
  });
});
