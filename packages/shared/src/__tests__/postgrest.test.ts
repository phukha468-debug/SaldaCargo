import { describe, it, expect } from 'vitest';
import { isUuid, escapePostgrestValue, buildIlikeOrFilter } from '../postgrest';

describe('postgrest security helpers', () => {
  it('validates UUIDs accurately', () => {
    expect(isUuid('10000000-0000-0000-0000-000000000001')).toBe(true);
    expect(isUuid('74008cf7-0527-4e9f-afd2-d232b8f8125a')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });

  it('strips PostgREST control characters to prevent Filter Injection', () => {
    const payload = 'Иванов,id.neq.00000000-0000-0000-0000-000000000000),or(is_active.eq.false)';
    const escaped = escapePostgrestValue(payload);

    expect(escaped).not.toContain(',');
    expect(escaped).not.toContain('(');
    expect(escaped).not.toContain(')');
    expect(escaped).not.toContain('*');
    expect(escaped).not.toContain('%');
    expect(escaped).not.toContain('"');
    expect(escaped).not.toContain("'");
    expect(escaped).not.toContain('\\');
  });

  it('builds safe ilike .or() filter and returns null for empty/control-only input', () => {
    const filter = buildIlikeOrFilter(['name', 'inn'], 'ООО "Рога",id.eq.1');
    expect(filter).toBe('name.ilike.%ООО Рога id.eq.1%,inn.ilike.%ООО Рога id.eq.1%');

    expect(buildIlikeOrFilter(['name'], ',,,***()')).toBeNull();
    expect(buildIlikeOrFilter([], 'test')).toBeNull();
  });
});
