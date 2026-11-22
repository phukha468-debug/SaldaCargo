import { describe, it, expect } from 'vitest';
import { signSessionToken, verifySessionToken } from '../session';

const TEST_SECRET = 'test-super-secret-session-key-32-chars-minimum!';
const OTHER_SECRET = 'another-different-secret-key-32-chars-minimum!';

describe('session (HMAC-SHA256)', () => {
  it('signs and verifies a valid session token', async () => {
    const token = await signSessionToken(
      { uid: 'user-123', roles: ['admin', 'driver'], ttlSeconds: 3600 },
      TEST_SECRET,
    );

    const payload = await verifySessionToken(token, TEST_SECRET);
    expect(payload).not.toBeNull();
    expect(payload?.uid).toBe('user-123');
    expect(payload?.roles).toEqual(['admin', 'driver']);
    expect(payload!.exp - payload!.iat).toBe(3600);
  });

  it('rejects token verified with wrong secret', async () => {
    const token = await signSessionToken({ uid: 'user-123', roles: ['owner'] }, TEST_SECRET);
    const payload = await verifySessionToken(token, OTHER_SECRET);
    expect(payload).toBeNull();
  });

  it('rejects token with tampered payload', async () => {
    const token = await signSessionToken({ uid: 'user-123', roles: ['driver'] }, TEST_SECRET);
    const [, sig] = token.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ uid: 'user-123', roles: ['owner'], iat: 1, exp: 9999999999 }),
    ).toString('base64url');

    const payload = await verifySessionToken(`${forgedPayload}.${sig}`, TEST_SECRET);
    expect(payload).toBeNull();
  });

  it('rejects expired token', async () => {
    const token = await signSessionToken(
      { uid: 'user-123', roles: ['driver'], ttlSeconds: -10 },
      TEST_SECRET,
    );
    const payload = await verifySessionToken(token, TEST_SECRET);
    expect(payload).toBeNull();
  });

  it('rejects raw UUID, malformed, empty, or null tokens', async () => {
    expect(await verifySessionToken(null, TEST_SECRET)).toBeNull();
    expect(await verifySessionToken(undefined, TEST_SECRET)).toBeNull();
    expect(await verifySessionToken('', TEST_SECRET)).toBeNull();
    expect(
      await verifySessionToken('00000000-0000-0000-0000-000000000001', TEST_SECRET),
    ).toBeNull();
    expect(await verifySessionToken('a.b.c', TEST_SECRET)).toBeNull();
    expect(await verifySessionToken('.onlysig', TEST_SECRET)).toBeNull();
  });
});
