import type { UserRole } from './types';

export const ROLE_LABEL: Record<UserRole, string> = {
  owner: 'Владелец',
  admin: 'Администратор',
  driver: 'Водитель',
  loader: 'Грузчик',
  mechanic: 'Механик',
  mechanic_lead: 'Ст. механик',
  accountant: 'Бухгалтер',
  welder: 'Сварщик',
  painter: 'Маляр',
  electrician: 'Электрик',
  handyman: 'Разнорабочий',
  cleaner: 'Уборщица',
};

export const ROLE_COLOR: Record<UserRole, string> = {
  owner: 'bg-violet-100 text-violet-700',
  admin: 'bg-blue-100 text-blue-700',
  driver: 'bg-emerald-100 text-emerald-700',
  loader: 'bg-orange-100 text-orange-700',
  mechanic: 'bg-amber-100 text-amber-700',
  mechanic_lead: 'bg-amber-200 text-amber-800',
  accountant: 'bg-slate-100 text-slate-600',
  welder: 'bg-cyan-100 text-cyan-700',
  painter: 'bg-pink-100 text-pink-700',
  electrician: 'bg-yellow-100 text-yellow-700',
  handyman: 'bg-stone-100 text-stone-600',
  cleaner: 'bg-teal-100 text-teal-800',
};

export const ALL_ROLES: UserRole[] = [
  'driver',
  'mechanic',
  'mechanic_lead',
  'loader',
  'cleaner',
  'welder',
  'painter',
  'electrician',
  'handyman',
  'admin',
  'owner',
  'accountant',
];

export const WALLETS = [
  { id: '10000000-0000-0000-0000-000000000001', label: '🏦 Р/С' },
  { id: '10000000-0000-0000-0000-000000000002', label: '💵 Касса' },
];

export const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

export const emptyForm = {
  name: '',
  phone: '',
  max_user_id: '',
  pin_code: '',
  roles: [] as UserRole[],
  current_asset_id: '',
  auto_settle: false,
  notes: '',
  is_officially_employed: false,
  official_salary_amount: '22500',
  official_salary_day: 10,
  has_court_orders: false,
  court_order_pct: '50',
  court_order_notes: '',
};

export const ADVANCE_CAT = 'a0000000-0000-0000-0000-000000000001';
export const PAYROLL_CATS = [
  'd79213ee-3bc6-4433-b58a-ca7ea1040d00',
  '18792fa8-fda8-472d-8e04-e19d2c6c053c',
  '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6',
];
