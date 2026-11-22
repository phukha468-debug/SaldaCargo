/**
 * Справочник модулей (Feature Flags) модульного конструктора SALDA PRO SaaS.
 * Каждая организация (тенант) включает нужный набор модулей в `organizations.enabled_modules`.
 */

export const DEFAULT_ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';

export const SALDA_MODULES = [
  'transport',
  'garage',
  'expeditor',
  'warehouse',
  'payroll',
  'finance',
] as const;

export type SaldaModule = (typeof SALDA_MODULES)[number];

export interface SaldaModuleMeta {
  id: SaldaModule;
  label: string;
  description: string;
  defaultEnabled: boolean;
}

export const MODULE_META: Record<SaldaModule, SaldaModuleMeta> = {
  transport: {
    id: 'transport',
    label: 'Свой автопарк и рейсы',
    description: 'Управление машинами, рейсами, заказами, одометром и GPS-телематикой',
    defaultEnabled: true,
  },
  garage: {
    id: 'garage',
    label: 'СТО и Гараж',
    description: 'Заказ-наряды, дефектовка, регламенты ТО, механики и клиентский сервис',
    defaultEnabled: false,
  },
  expeditor: {
    id: 'expeditor',
    label: 'Экспедиция и заявки (АТИ)',
    description: 'Экспедиторские заявки, сторонние перевозчики и контроль маржинальности',
    defaultEnabled: false,
  },
  warehouse: {
    id: 'warehouse',
    label: 'Склад запчастей',
    description: 'Учёт номенклатуры, приход/списание, заявки на закупку и остатки',
    defaultEnabled: false,
  },
  payroll: {
    id: 'payroll',
    label: 'Зарплата и смены',
    description: 'Начисления водителям, грузчикам, механикам, авансы и расчётные ведомости',
    defaultEnabled: true,
  },
  finance: {
    id: 'finance',
    label: 'Финансы, Касса и Банк',
    description: 'Кошельки, ДДС, дебиторка/кредиторка, платёжный календарь и банковские выписки',
    defaultEnabled: true,
  },
};

export interface OrganizationFeatureContext {
  id?: string;
  enabled_modules?: readonly string[] | null;
}

export function isValidModule(value: string): value is SaldaModule {
  return (SALDA_MODULES as readonly string[]).includes(value);
}

/**
 * Проверяет, включён ли указанный модуль у организации.
 */
export function hasModule(
  orgOrModules: OrganizationFeatureContext | readonly string[] | null | undefined,
  module: SaldaModule,
): boolean {
  if (!orgOrModules) return false;
  const list = Array.isArray(orgOrModules)
    ? orgOrModules
    : (orgOrModules as OrganizationFeatureContext).enabled_modules;
  if (!Array.isArray(list)) return false;
  return list.includes(module);
}

/**
 * Проверяет, включён ли хотя бы один из указанных модулей у организации.
 */
export function hasAnyModule(
  orgOrModules: OrganizationFeatureContext | readonly string[] | null | undefined,
  modules: readonly SaldaModule[],
): boolean {
  return modules.some((m) => hasModule(orgOrModules, m));
}
