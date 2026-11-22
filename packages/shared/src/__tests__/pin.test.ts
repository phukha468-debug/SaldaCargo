import { describe, it, expect } from 'vitest';
import { hashPin, isHashedPin, verifyPin } from '../pin';

describe('pin (scrypt + legacy compatibility)', () => {
  it('hashes PIN with random salt and verifies it without rehash', () => {
    const hash1 = hashPin('1234');
    const hash2 = hashPin('1234');

    expect(isHashedPin(hash1)).toBe(true);
    expect(hash1).not.toBe(hash2);

    const ok = verifyPin('1234', hash1);
    expect(ok).toEqual({ valid: true, needsRehash: false });

    const wrong = verifyPin('9999', hash1);
    expect(wrong).toEqual({ valid: false, needsRehash: false });
  });

  it('trims whitespace around PIN during hash and verify', () => {
    const hash = hashPin('  4321 ');
    expect(verifyPin('4321', hash)).toEqual({ valid: true, needsRehash: false });
    expect(verifyPin(' 4321 ', hash)).toEqual({ valid: true, needsRehash: false });
  });

  it('supports legacy plaintext PIN and flags needsRehash=true on match', () => {
    expect(isHashedPin('5678')).toBe(false);
    expect(verifyPin('5678', '5678')).toEqual({ valid: true, needsRehash: true });
    expect(verifyPin('0000', '5678')).toEqual({ valid: false, needsRehash: false });
  });

  it('safely rejects null, empty, and malformed scrypt hashes', () => {
    expect(verifyPin('1234', null)).toEqual({ valid: false, needsRehash: false });
    expect(verifyPin('1234', '')).toEqual({ valid: false, needsRehash: false });
    expect(verifyPin('', '1234')).toEqual({ valid: false, needsRehash: false });
    expect(verifyPin('1234', 'scrypt:broken')).toEqual({ valid: false, needsRehash: false });
    expect(verifyPin('1234', 'scrypt:salt:not-valid-hex-len')).toEqual({
      valid: false,
      needsRehash: false,
    });
  });
});
