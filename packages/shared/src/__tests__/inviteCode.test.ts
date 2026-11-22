import { describe, expect, it } from 'vitest';
import { getOrgRegistrationInviteCode, verifyOrgRegistrationInviteCode } from '../env';

describe('Private Beta ORG_REGISTRATION_INVITE_CODE', () => {
  it('closes registration when ORG_REGISTRATION_INVITE_CODE is not set', () => {
    expect(getOrgRegistrationInviteCode({})).toBeNull();
    expect(verifyOrgRegistrationInviteCode('any-code', {})).toEqual({
      allowed: false,
      reason: 'REGISTRATION_CLOSED',
    });
  });

  it('closes registration when ORG_REGISTRATION_INVITE_CODE is blank whitespace', () => {
    expect(
      verifyOrgRegistrationInviteCode('any-code', { ORG_REGISTRATION_INVITE_CODE: '   ' }),
    ).toEqual({
      allowed: false,
      reason: 'REGISTRATION_CLOSED',
    });
  });

  it('rejects empty or wrong invite code when env code is configured', () => {
    const env = { ORG_REGISTRATION_INVITE_CODE: 'SALDA-BETA-2026' };
    expect(verifyOrgRegistrationInviteCode('', env)).toEqual({
      allowed: false,
      reason: 'INVALID_INVITE_CODE',
    });
    expect(verifyOrgRegistrationInviteCode('SALDA-BETA-2025', env)).toEqual({
      allowed: false,
      reason: 'INVALID_INVITE_CODE',
    });
    expect(verifyOrgRegistrationInviteCode('short', env)).toEqual({
      allowed: false,
      reason: 'INVALID_INVITE_CODE',
    });
  });

  it('allows matching invite code with surrounding whitespace trimmed', () => {
    const env = { ORG_REGISTRATION_INVITE_CODE: '  SALDA-BETA-2026  ' };
    expect(verifyOrgRegistrationInviteCode('SALDA-BETA-2026', env)).toEqual({ allowed: true });
    expect(verifyOrgRegistrationInviteCode('  SALDA-BETA-2026 ', env)).toEqual({ allowed: true });
  });
});
