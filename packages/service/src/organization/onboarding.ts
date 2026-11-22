/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_ORGANIZATION_SETTINGS,
  ProvisionOrganizationSchema,
  hashPin,
  logger,
  type OrganizationSettings,
  type ProvisionOrganizationInput,
  type SaldaModule,
} from '@saldacargo/shared';

export { ProvisionOrganizationSchema, type ProvisionOrganizationInput };

export class OnboardingError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = 'OnboardingError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface ProvisionOrganizationResult {
  organization: {
    id: string;
    slug: string;
    name: string;
    enabled_modules: SaldaModule[];
  };
  user: {
    id: string;
    full_name: string;
    phone: string;
    roles: string[];
  };
  legalEntity: {
    id: string;
    name: string;
    inn: string | null;
    type: string;
  };
}

const CYRILLIC_MAP: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

export function generateOrganizationSlug(companyName: string): string {
  const transliterated = companyName
    .toLowerCase()
    .split('')
    .map((ch) => CYRILLIC_MAP[ch] ?? ch)
    .join('');

  const cleaned = transliterated
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  if (cleaned.length >= 3) {
    return cleaned;
  }
  return `org-${randomUUID().slice(0, 8)}`;
}

export function normalizePhoneForStorage(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) {
    return `+7${digits.slice(1)}`;
  }
  if (digits.length === 11 && digits.startsWith('7')) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+7${digits}`;
  }
  return raw.trim();
}

/**
 * Создаёт новую изолированную организацию (тенанта) с полным стартовым набором:
 * - запись в `organizations` (с включёнными модулями и настроенным `settings.finance`)
 * - стартовое юрлицо в `legal_entities` (из названия и ИНН)
 * - 5 базовых кошельков (`bank`, `cash`, `fuel_card`, `fuel_cube`, `garage`) с нулевыми балансами
 * - 6 базовых категорий транзакций
 * - владельца (`users` с scrypt-хэшем PIN + `organization_members` с ролью `owner`)
 */
export async function provisionNewOrganization(
  supabase: SupabaseClient<any, any, any>,
  rawInput: ProvisionOrganizationInput,
): Promise<ProvisionOrganizationResult> {
  const parsed = ProvisionOrganizationSchema.safeParse(rawInput);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    throw new OnboardingError('VALIDATION_ERROR', msg, 400);
  }

  const input = parsed.data;
  const normalizedPhone = normalizePhoneForStorage(input.owner_phone);
  const inn = input.inn ? input.inn.trim() : null;
  const shortName = (input.short_name?.trim() || input.company_name.trim()).slice(0, 40);
  const uniqueModules = Array.from(new Set(input.enabled_modules));

  // 1. Проверяем, не занят ли телефон владельца
  const phoneDigits = normalizedPhone.replace(/\D/g, '');
  const last10 = phoneDigits.slice(-10);
  const { data: existingUsers } = await (supabase.from('users') as any)
    .select('id, phone')
    .or(`phone.eq.${normalizedPhone},phone.ilike.%${last10}`)
    .limit(1);

  if (existingUsers && existingUsers.length > 0) {
    throw new OnboardingError(
      'PHONE_ALREADY_REGISTERED',
      'Пользователь с таким номером телефона уже зарегистрирован в системе.',
      409,
    );
  }

  // 2. Подбираем уникальный slug организации
  let slug = input.slug || generateOrganizationSlug(input.company_name);
  const { data: existingOrg } = await (supabase.from('organizations') as any)
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (existingOrg) {
    if (input.slug) {
      throw new OnboardingError(
        'SLUG_TAKEN',
        `Идентификатор "${slug}" уже занят другой компанией.`,
        409,
      );
    }
    slug = `${slug.slice(0, 32)}-${randomUUID().slice(0, 6)}`;
  }

  // 3. Генерируем IDs для организации, кошельков и категорий
  const orgId = randomUUID();
  const shortOrgTag = orgId.slice(0, 8);

  const walletIds = {
    bank: randomUUID(),
    cash: randomUUID(),
    fuel_card: randomUUID(),
    fuel_cube: randomUUID(),
    garage: randomUUID(),
  };

  const categoryIds = {
    trip_revenue: randomUUID(),
    payroll_driver: randomUUID(),
    payroll_loader: randomUUID(),
    fuel: randomUUID(),
    other: randomUUID(),
    cash_collect: randomUUID(),
  };

  const orgSettings: OrganizationSettings = {
    ...DEFAULT_ORGANIZATION_SETTINGS,
    branding: {
      ...DEFAULT_ORGANIZATION_SETTINGS.branding,
      short_name: shortName,
    },
    finance: {
      ...DEFAULT_ORGANIZATION_SETTINGS.finance,
      wallets: walletIds,
      categories: categoryIds,
      default_safe_cash_base: 0,
      default_fuel_card_base: 0,
    },
  };

  // 4. Создаём организацию
  const { error: orgError } = await (supabase.from('organizations') as any).insert({
    id: orgId,
    slug,
    name: input.company_name.trim(),
    is_active: true,
    enabled_modules: uniqueModules,
    settings: orgSettings,
  });

  if (orgError) {
    logger.error('Failed to insert organization during onboarding', { slug }, orgError);
    throw new OnboardingError('ORG_CREATE_FAILED', 'Не удалось создать организацию.', 500);
  }

  // 5. Создаём стартовое юрлицо в legal_entities (с первой минуты)
  const legalEntityId = randomUUID();
  const legalEntityType = inn && inn.length === 12 ? 'ip' : 'ooo';

  const { error: leError } = await (supabase.from('legal_entities') as any).insert({
    id: legalEntityId,
    organization_id: orgId,
    name: input.company_name.trim(),
    inn,
    type: legalEntityType,
    is_active: true,
  });

  if (leError) {
    logger.error('Failed to insert initial legal_entity', { orgId }, leError);
    await (supabase.from('organizations') as any).delete().eq('id', orgId);
    throw new OnboardingError(
      'LEGAL_ENTITY_CREATE_FAILED',
      'Не удалось создать юрлицо компании.',
      500,
    );
  }

  // 6. Создаём базовые кошельки организации
  const walletsPayload = [
    {
      id: walletIds.bank,
      organization_id: orgId,
      legal_entity_id: legalEntityId,
      name: 'Расчётный счёт',
      type: 'bank_account',
      is_active: true,
    },
    {
      id: walletIds.cash,
      organization_id: orgId,
      legal_entity_id: legalEntityId,
      name: 'Касса (Сейф)',
      type: 'cash_register',
      is_active: true,
    },
    {
      id: walletIds.fuel_card,
      organization_id: orgId,
      legal_entity_id: legalEntityId,
      name: 'Топливные карты',
      type: 'fuel_card',
      is_active: true,
    },
    {
      id: walletIds.fuel_cube,
      organization_id: orgId,
      legal_entity_id: legalEntityId,
      name: 'Топливный куб',
      type: 'fuel_card',
      is_active: true,
    },
    {
      id: walletIds.garage,
      organization_id: orgId,
      legal_entity_id: legalEntityId,
      name: 'Касса Гараж / СТО',
      type: 'cash_register',
      is_active: true,
    },
  ];

  const { error: walletsError } = await (supabase.from('wallets') as any).insert(walletsPayload);
  if (walletsError) {
    logger.error('Failed to insert initial wallets', { orgId }, walletsError);
    await (supabase.from('organizations') as any).delete().eq('id', orgId);
    throw new OnboardingError(
      'WALLETS_CREATE_FAILED',
      'Не удалось создать кошельки организации.',
      500,
    );
  }

  // 7. Создаём базовые категории транзакций
  const categoriesPayload = [
    {
      id: categoryIds.trip_revenue,
      organization_id: orgId,
      code: `trip_revenue_${shortOrgTag}`,
      name: 'Выручка по рейсам',
      direction: 'income',
      is_active: true,
    },
    {
      id: categoryIds.payroll_driver,
      organization_id: orgId,
      code: `payroll_driver_${shortOrgTag}`,
      name: 'Зарплата водителей',
      direction: 'expense',
      is_active: true,
    },
    {
      id: categoryIds.payroll_loader,
      organization_id: orgId,
      code: `payroll_loader_${shortOrgTag}`,
      name: 'Зарплата грузчиков',
      direction: 'expense',
      is_active: true,
    },
    {
      id: categoryIds.fuel,
      organization_id: orgId,
      code: `fuel_${shortOrgTag}`,
      name: 'Топливо (ГСМ)',
      direction: 'expense',
      is_active: true,
    },
    {
      id: categoryIds.other,
      organization_id: orgId,
      code: `other_${shortOrgTag}`,
      name: 'Прочие расходы',
      direction: 'expense',
      is_active: true,
    },
    {
      id: categoryIds.cash_collect,
      organization_id: orgId,
      code: `cash_collect_${shortOrgTag}`,
      name: 'Сдача наличных / инкассация',
      direction: 'transfer',
      is_active: true,
    },
  ];

  const { error: catError } = await (supabase.from('transaction_categories') as any).insert(
    categoriesPayload,
  );
  if (catError) {
    logger.error('Failed to insert initial transaction_categories', { orgId }, catError);
    await (supabase.from('organizations') as any).delete().eq('id', orgId);
    throw new OnboardingError(
      'CATEGORIES_CREATE_FAILED',
      'Не удалось создать категории транзакций.',
      500,
    );
  }

  // 8. Создаём владельца организации с scrypt-хэшем PIN
  const userId = randomUUID();
  const pinHash = hashPin(input.owner_pin);
  const ownerRoles = ['owner', 'admin'];

  const { error: userError } = await (supabase.from('users') as any).insert({
    id: userId,
    organization_id: orgId,
    default_organization_id: orgId,
    name: input.owner_name.trim(),
    phone: normalizedPhone,
    pin_code: pinHash,
    roles: ownerRoles,
    is_active: true,
  });

  if (userError) {
    logger.error('Failed to insert owner user during onboarding', { orgId }, userError);
    await (supabase.from('organizations') as any).delete().eq('id', orgId);
    throw new OnboardingError('USER_CREATE_FAILED', 'Не удалось создать аккаунт владельца.', 500);
  }

  // 9. Привязываем владельца в organization_members
  const { error: memberError } = await (supabase.from('organization_members') as any).insert({
    organization_id: orgId,
    user_id: userId,
    role: 'owner',
    is_active: true,
  });

  if (memberError) {
    logger.error(
      'Failed to insert organization_members during onboarding',
      { orgId, userId },
      memberError,
    );
    await (supabase.from('users') as any).delete().eq('id', userId);
    await (supabase.from('organizations') as any).delete().eq('id', orgId);
    throw new OnboardingError(
      'MEMBER_CREATE_FAILED',
      'Не удалось привязать владельца к организации.',
      500,
    );
  }

  logger.info('Provisioned new organization', {
    organizationId: orgId,
    slug,
    modules: uniqueModules,
    ownerUserId: userId,
  });

  return {
    organization: {
      id: orgId,
      slug,
      name: input.company_name.trim(),
      enabled_modules: uniqueModules,
    },
    user: {
      id: userId,
      full_name: input.owner_name.trim(),
      phone: normalizedPhone,
      roles: ownerRoles,
    },
    legalEntity: {
      id: legalEntityId,
      name: input.company_name.trim(),
      inn,
      type: legalEntityType,
    },
  };
}
