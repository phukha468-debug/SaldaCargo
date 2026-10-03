// Статусы жизненного цикла — ДВУХОСНЫЙ СТАТУС (критически важно)
// lifecycle_status: кто утвердил данные
// settlement_status: прошли ли деньги физически

export const LifecycleStatus = {
  DRAFT: 'draft',
  APPROVED: 'approved',
  RETURNED: 'returned',
  CANCELLED: 'cancelled',
} as const;
export type LifecycleStatus = (typeof LifecycleStatus)[keyof typeof LifecycleStatus];

export const SettlementStatus = {
  PENDING: 'pending',
  COMPLETED: 'completed',
} as const;
export type SettlementStatus = (typeof SettlementStatus)[keyof typeof SettlementStatus];

// Статусы рейса
export const TripStatus = {
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;
export type TripStatus = (typeof TripStatus)[keyof typeof TripStatus];

// Тип рейса
export const TripType = {
  LOCAL: 'local',
  INTERCITY: 'intercity',
  MOVING: 'moving',
  HOURLY: 'hourly',
} as const;
export type TripType = (typeof TripType)[keyof typeof TripType];

// Способ оплаты заказа
export const PaymentMethod = {
  CASH: 'cash', // Наличные
  QR: 'qr', // QR на р/с (мгновенно)
  BANK_INVOICE: 'bank_invoice', // Безнал по счёту (ждём)
  DEBT_CASH: 'debt_cash', // Долг наличными (ждём)
  CARD_DRIVER: 'card_driver', // На карту водителя (= нал учётно)
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

// Направление транзакции
export const TransactionDirection = {
  INCOME: 'income',
  EXPENSE: 'expense',
  TRANSFER: 'transfer',
} as const;
export type TransactionDirection = (typeof TransactionDirection)[keyof typeof TransactionDirection];

// Роли пользователей
export const UserRole = {
  OWNER: 'owner',
  ADMIN: 'admin',
  DRIVER: 'driver',
  LOADER: 'loader',
  MECHANIC: 'mechanic',
  MECHANIC_LEAD: 'mechanic_lead',
  ACCOUNTANT: 'accountant',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

// Статусы активов (машин)
export const AssetStatus = {
  ACTIVE: 'active',
  REPAIR: 'repair',
  RESERVE: 'reserve',
  SOLD: 'sold',
  WRITTEN_OFF: 'written_off',
} as const;
export type AssetStatus = (typeof AssetStatus)[keyof typeof AssetStatus];

// Статусы наряда
export const ServiceOrderStatus = {
  CREATED: 'created',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;
export type ServiceOrderStatus = (typeof ServiceOrderStatus)[keyof typeof ServiceOrderStatus];

// Статусы работы в наряде
export const WorkStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;
export type WorkStatus = (typeof WorkStatus)[keyof typeof WorkStatus];

// Тип кошелька
export const WalletType = {
  BANK_ACCOUNT: 'bank_account',
  CASH_REGISTER: 'cash_register',
  FUEL_CARD: 'fuel_card',
  DRIVER_ACCOUNTABLE: 'driver_accountable',
  OWNER_PERSONAL: 'owner_personal',
} as const;
export type WalletType = (typeof WalletType)[keyof typeof WalletType];

// Срочность дефекта
export const DefectUrgency = {
  CRITICAL: 'critical', // Опасно ехать
  SOON: 'soon', // В ближайшее ТО
  LOW: 'low', // Можно отложить
} as const;
export type DefectUrgency = (typeof DefectUrgency)[keyof typeof DefectUrgency];
