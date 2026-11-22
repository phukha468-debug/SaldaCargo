import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ORGANIZATION_ID,
  SALDA_MODULES,
  MODULE_META,
  isValidModule,
  hasModule,
  hasAnyModule,
} from '../modules';

describe('modules (Feature Flags constructor)', () => {
  it('defines all 6 canonical SALDA PRO modules and metadata', () => {
    expect(SALDA_MODULES).toEqual([
      'transport',
      'garage',
      'expeditor',
      'warehouse',
      'payroll',
      'finance',
    ]);
    for (const m of SALDA_MODULES) {
      expect(MODULE_META[m].id).toBe(m);
      expect(MODULE_META[m].label.length).toBeGreaterThan(0);
    }
    expect(DEFAULT_ORGANIZATION_ID).toBe('00000000-0000-4000-8000-000000000001');
  });

  it('checks single and multiple module flags from org object or array', () => {
    const org = { id: 'org-1', enabled_modules: ['transport', 'finance'] };

    expect(hasModule(org, 'transport')).toBe(true);
    expect(hasModule(org, 'garage')).toBe(false);
    expect(hasModule(['garage', 'warehouse'], 'warehouse')).toBe(true);
    expect(hasModule(null, 'transport')).toBe(false);

    expect(hasAnyModule(org, ['garage', 'finance'])).toBe(true);
    expect(hasAnyModule(org, ['garage', 'warehouse'])).toBe(false);
  });

  it('validates module identifiers strictly', () => {
    expect(isValidModule('transport')).toBe(true);
    expect(isValidModule('expeditor')).toBe(true);
    expect(isValidModule('unknown_module')).toBe(false);
  });
});
