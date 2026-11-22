import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret, encryptJsonSecrets, decryptJsonSecrets } from '../crypto';

const HEX_MASTER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const OTHER_MASTER_KEY = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

describe('crypto (AES-256-GCM integration secrets)', () => {
  it('encrypts and decrypts plaintext with unique random IV per call', () => {
    const c1 = encryptSecret('tbank-token-secret-value', HEX_MASTER_KEY);
    const c2 = encryptSecret('tbank-token-secret-value', HEX_MASTER_KEY);

    expect(c1.startsWith('v1:')).toBe(true);
    expect(c1).not.toBe(c2);
    expect(decryptSecret(c1, HEX_MASTER_KEY)).toBe('tbank-token-secret-value');
    expect(decryptSecret(c2, HEX_MASTER_KEY)).toBe('tbank-token-secret-value');
  });

  it('encrypts and decrypts structured JSON integration secrets', () => {
    const secrets = { apiToken: 'tok_123', accountNumber: '40802810000000000001' };
    const encrypted = encryptJsonSecrets(secrets, 'passphrase-at-least-32-characters-long!');
    const decrypted = decryptJsonSecrets<typeof secrets>(
      encrypted,
      'passphrase-at-least-32-characters-long!',
    );

    expect(decrypted).toEqual(secrets);
  });

  it('rejects wrong key, tampered ciphertext, and invalid format', () => {
    const encrypted = encryptSecret('top-secret', HEX_MASTER_KEY);

    expect(() => decryptSecret(encrypted, OTHER_MASTER_KEY)).toThrow();

    const parts = encrypted.split(':');
    parts[3] = parts[3]!.slice(0, -2) + 'AA';
    expect(() => decryptSecret(parts.join(':'), HEX_MASTER_KEY)).toThrow();

    expect(() => decryptSecret('v0:bad:format', HEX_MASTER_KEY)).toThrow();
  });
});
