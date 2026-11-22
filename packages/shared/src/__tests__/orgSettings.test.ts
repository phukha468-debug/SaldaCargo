import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ORGANIZATION_SETTINGS,
  parseOrganizationSettings,
  matchesAnyOrgPattern,
  isInternalCounterparty,
  isNoCashCounterparty,
  isStrictDocCounterparty,
  isTerritoryCounterparty,
  isGeostroyCounterparty,
  isWialonGpsAsset,
} from '../index';

describe('OrganizationSettings & TK501 de-hardcoding', () => {
  it('returns neutral defaults when raw settings are null/empty/invalid', () => {
    expect(parseOrganizationSettings(null)).toEqual(DEFAULT_ORGANIZATION_SETTINGS);
    expect(parseOrganizationSettings({})).toEqual(DEFAULT_ORGANIZATION_SETTINGS);
    expect(parseOrganizationSettings('broken')).toEqual(DEFAULT_ORGANIZATION_SETTINGS);

    const defaults = DEFAULT_ORGANIZATION_SETTINGS;
    expect(defaults.finance.default_safe_cash_base).toBe(0);
    expect(defaults.finance.default_fuel_card_base).toBe(0);
    expect(defaults.counterparty_rules.no_cash_patterns).toEqual([]);
    expect(defaults.counterparty_rules.strict_doc_patterns).toEqual([]);
    expect(defaults.fleet_rules.wialon_gps_plates).toEqual([]);
  });

  it('recovers gracefully when one section is invalid while preserving valid sections', () => {
    const parsed = parseOrganizationSettings({
      branding: { short_name: 'Новая Логистика', timezone: 'Europe/Moscow' },
      finance: { cube_fuel_price_per_liter: -10 }, // invalid (must be positive)
      fleet_rules: { wialon_gps_plates: ['777', '888'] },
    });

    expect(parsed.branding.short_name).toBe('Новая Логистика');
    expect(parsed.branding.timezone).toBe('Europe/Moscow');
    expect(parsed.finance.cube_fuel_price_per_liter).toBe(60); // fallback to default
    expect(parsed.fleet_rules.wialon_gps_plates).toEqual(['777', '888']);
  });

  it('matches both plain substrings and regex patterns safely', () => {
    expect(matchesAnyOrgPattern('ООО Геостройиндустрия', ['геострой'])).toBe(true);
    expect(matchesAnyOrgPattern('ТК 501 Внутренний', ['/^(?:тк\\s*501|тк501)/'])).toBe(true);
    expect(matchesAnyOrgPattern('Ромашка', ['/^(?:тк\\s*501|тк501)/'])).toBe(false);
    // Invalid regex falls back to substring match without throwing
    expect(matchesAnyOrgPattern('abc[def', ['/[def/'])).toBe(false);
  });

  it('does NOT trigger TK501 hardcoded rules for a new tenant with default neutral settings', () => {
    const newOrgSettings = DEFAULT_ORGANIZATION_SETTINGS;

    // Для нового клиента ТК501/ВСМПО/Геострой/Территория/096 — обычные значения
    expect(isInternalCounterparty('ТК501', newOrgSettings)).toBe(false);
    expect(isInternalCounterparty('Наша компания', newOrgSettings)).toBe(true);

    expect(isNoCashCounterparty('ООО Геостройиндустрия', newOrgSettings)).toBe(false);
    expect(isNoCashCounterparty('ВСМПО', newOrgSettings)).toBe(false);
    expect(isNoCashCounterparty({ name: 'Любое ООО', is_legal_entity: true }, newOrgSettings)).toBe(
      true,
    );

    expect(isStrictDocCounterparty('ВСМПО-АВИСМА', newOrgSettings)).toBe(false);
    expect(isTerritoryCounterparty('ООО Территория', newOrgSettings)).toBe(false);
    expect(isGeostroyCounterparty('ООО Геостройиндустрия', newOrgSettings)).toBe(false);
    expect(isWialonGpsAsset({ reg_number: 'А096МВ196' }, newOrgSettings)).toBe(false);
  });

  it('applies custom tenant rules when configured in organizations.settings', () => {
    const tenantSettings = parseOrganizationSettings({
      counterparty_rules: {
        internal_patterns: ['альфа логистика'],
        no_cash_patterns: ['газпром'],
        strict_doc_patterns: ['газпром', 'роснефть'],
        territory_patterns: ['ук горизонт'],
        geostroy_patterns: ['спецстрой'],
      },
      fleet_rules: {
        wialon_gps_plates: ['777', '999'],
      },
    });

    expect(isInternalCounterparty('Альфа Логистика (хознужды)', tenantSettings)).toBe(true);
    expect(isNoCashCounterparty('ПАО Газпром', tenantSettings)).toBe(true);
    expect(isStrictDocCounterparty('НК Роснефть', tenantSettings)).toBe(true);
    expect(isTerritoryCounterparty('УК Горизонт', tenantSettings)).toBe(true);
    expect(isGeostroyCounterparty('ООО Спецстрой', tenantSettings)).toBe(true);
    expect(isWialonGpsAsset({ reg_number: 'К777АА77' }, tenantSettings)).toBe(true);
    expect(isWialonGpsAsset({ reg_number: 'А096МВ196' }, tenantSettings)).toBe(false);
  });
});
