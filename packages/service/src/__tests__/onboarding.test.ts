/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { isHashedPin, verifyPin } from '@saldacargo/shared';
import {
  OnboardingError,
  generateOrganizationSlug,
  normalizePhoneForStorage,
  provisionNewOrganization,
} from '../organization/onboarding';

interface RecordedInsert {
  table: string;
  payload: unknown;
}

function createMockSupabase(options?: { existingPhone?: boolean; existingSlug?: boolean }) {
  const inserts: RecordedInsert[] = [];

  const client = {
    from(table: string) {
      return {
        select() {
          return {
            or() {
              return {
                limit() {
                  return Promise.resolve({
                    data: options?.existingPhone
                      ? [{ id: 'u-existing', phone: '+79220001122' }]
                      : [],
                    error: null,
                  });
                },
              };
            },
            eq() {
              return {
                maybeSingle() {
                  return Promise.resolve({
                    data:
                      options?.existingSlug && table === 'organizations'
                        ? { id: 'org-existing' }
                        : null,
                    error: null,
                  });
                },
              };
            },
          };
        },
        insert(payload: unknown) {
          inserts.push({ table, payload });
          return Promise.resolve({ error: null });
        },
        delete() {
          return {
            eq() {
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };

  return { client: client as any, inserts };
}

describe('provisionNewOrganization', () => {
  it('generates transliterated slug and normalizes Russian phone numbers', () => {
    expect(generateOrganizationSlug('ООО Урал Логистика')).toBe('ooo-ural-logistika');
    expect(normalizePhoneForStorage('8 (922) 123-45-67')).toBe('+79221234567');
    expect(normalizePhoneForStorage('9221234567')).toBe('+79221234567');
  });

  it('provisions org, legal_entity (with INN), 5 wallets, 6 categories, hashed-PIN owner and membership', async () => {
    const { client, inserts } = createMockSupabase();

    const result = await provisionNewOrganization(client, {
      company_name: 'ИП Сидоров А.В.',
      inn: '660700123456',
      enabled_modules: ['transport', 'finance', 'garage'],
      owner_name: 'Алексей Сидоров',
      owner_phone: '8 922 555 44 33',
      owner_pin: '4829',
    });

    expect(result.organization.name).toBe('ИП Сидоров А.В.');
    expect(result.organization.enabled_modules).toEqual(['transport', 'finance', 'garage']);
    expect(result.legalEntity.type).toBe('ip');
    expect(result.legalEntity.inn).toBe('660700123456');
    expect(result.user.phone).toBe('+79225554433');
    expect(result.user.roles).toEqual(['owner', 'admin']);

    // Проверяем все 6 таблиц, куда произошла вставка
    const tables = inserts.map((i) => i.table);
    expect(tables).toEqual([
      'organizations',
      'legal_entities',
      'wallets',
      'transaction_categories',
      'users',
      'organization_members',
    ]);

    const walletsInsert = inserts.find((i) => i.table === 'wallets')?.payload as Array<{
      organization_id: string;
      legal_entity_id: string;
    }>;
    expect(walletsInsert).toHaveLength(5);
    expect(walletsInsert.every((w) => w.organization_id === result.organization.id)).toBe(true);
    expect(walletsInsert.every((w) => w.legal_entity_id === result.legalEntity.id)).toBe(true);

    const categoriesInsert = inserts.find((i) => i.table === 'transaction_categories')
      ?.payload as Array<{ organization_id: string }>;
    expect(categoriesInsert).toHaveLength(6);
    expect(categoriesInsert.every((c) => c.organization_id === result.organization.id)).toBe(true);

    // PIN владельца должен храниться в виде scrypt-хэша, а не plaintext
    const userInsert = inserts.find((i) => i.table === 'users')?.payload as {
      pin_code: string;
      organization_id: string;
      default_organization_id: string;
    };
    expect(userInsert.pin_code).not.toBe('4829');
    expect(isHashedPin(userInsert.pin_code)).toBe(true);
    expect(verifyPin('4829', userInsert.pin_code).valid).toBe(true);
    expect(userInsert.organization_id).toBe(result.organization.id);
    expect(userInsert.default_organization_id).toBe(result.organization.id);
  });

  it('rejects duplicate owner phone with 409 PHONE_ALREADY_REGISTERED', async () => {
    const { client } = createMockSupabase({ existingPhone: true });

    await expect(
      provisionNewOrganization(client, {
        company_name: 'ООО Тест',
        enabled_modules: ['transport'],
        owner_name: 'Тест',
        owner_phone: '+79220001122',
        owner_pin: '1234',
      }),
    ).rejects.toMatchObject({
      code: 'PHONE_ALREADY_REGISTERED',
      statusCode: 409,
    });
  });

  it('rejects invalid INN and short PIN with 400 VALIDATION_ERROR', async () => {
    const { client } = createMockSupabase();

    await expect(
      provisionNewOrganization(client, {
        company_name: 'ООО Тест',
        inn: '12345',
        enabled_modules: ['transport'],
        owner_name: 'Тест',
        owner_phone: '+79220001122',
        owner_pin: '12',
      }),
    ).rejects.toBeInstanceOf(OnboardingError);
  });
});
