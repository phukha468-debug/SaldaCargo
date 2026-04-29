# TASK 03: Создание packages/ui и packages/shared-types

**Адресат:** Claude Code.
**Длительность:** 30–45 минут.
**Зависимости:** TASK_02 выполнен (apps/web и apps/miniapp созданы).

---

## Цель

Создать два shared-пакета в монорепо:

- `packages/shared-types` — TypeScript типы, общие для всего проекта
- `packages/ui` — общая библиотека компонентов (shadcn/ui база)

Подключить оба пакета к `apps/web` и `apps/miniapp`. Проверить что импорты работают.

---

## Алгоритм

### Шаг 1. Проверка готовности

```powershell
ls C:\salda\apps\web\
ls C:\salda\apps\miniapp\
# Оба должны существовать с Next.js структурой
```

### Шаг 2. Создать `packages/shared-types`

```powershell
mkdir C:\salda\packages\shared-types
mkdir C:\salda\packages\shared-types\src
```

**`packages/shared-types/package.json`:**

```json
{
  "name": "@saldacargo/shared-types",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.4.5"
  }
}
```

**`packages/shared-types/tsconfig.json`:**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**`packages/shared-types/src/database.types.ts`:**

```typescript
// Этот файл генерируется командой: pnpm gen:types
// Запускать после каждой миграции БД: supabase gen types typescript --local
// НЕ редактировать вручную.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// Placeholder — будет перезаписан после TASK_07 (первая миграция БД)
export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
```

**`packages/shared-types/src/enums.ts`:**

```typescript
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
```

**`packages/shared-types/src/models.ts`:**

```typescript
import type {
  LifecycleStatus,
  SettlementStatus,
  TripType,
  PaymentMethod,
  TransactionDirection,
  UserRole,
  AssetStatus,
  WalletType,
} from './enums';

// ─── Базовые типы ───────────────────────────────────────────────────────────

export type UUID = string;
export type ISODateString = string; // "2026-04-19T08:30:00Z"
export type MoneyString = string; // "1234.56" — всегда строка, никогда float!

// ─── Пользователь ───────────────────────────────────────────────────────────

export interface User {
  id: UUID;
  name: string;
  phone: string | null;
  max_user_id: string | null;
  roles: UserRole[];
  current_asset_id: UUID | null; // Закреплённая машина
  is_active: boolean;
  created_at: ISODateString;
  updated_at: ISODateString;
}

// ─── Актив (машина) ─────────────────────────────────────────────────────────

export interface Asset {
  id: UUID;
  reg_number: string;
  short_name: string;
  asset_type_id: UUID;
  year: number | null;
  status: AssetStatus;
  odometer_current: number;
  current_book_value: MoneyString;
  wialon_id: string | null;
  legal_entity_id: UUID;
  assigned_driver_id: UUID | null;
  created_at: ISODateString;
  updated_at: ISODateString;
}

// ─── Рейс ───────────────────────────────────────────────────────────────────

export interface Trip {
  id: UUID;
  trip_number: number;
  asset_id: UUID;
  driver_id: UUID;
  loader_id: UUID | null;
  trip_type: TripType;
  status: 'in_progress' | 'completed' | 'cancelled';
  lifecycle_status: LifecycleStatus;
  odometer_start: number;
  odometer_end: number | null;
  odometer_photo_start_url: string | null;
  odometer_photo_end_url: string | null;
  driver_note: string | null;
  admin_note: string | null;
  approved_by: UUID | null;
  approved_at: ISODateString | null;
  started_at: ISODateString;
  ended_at: ISODateString | null;
  created_at: ISODateString;
  updated_at: ISODateString;
}

// ─── Заказ в рейсе ──────────────────────────────────────────────────────────

export interface TripOrder {
  id: UUID;
  trip_id: UUID;
  counterparty_id: UUID | null;
  description: string | null;
  amount: MoneyString;
  driver_pay: MoneyString;
  loader_pay: MoneyString;
  payment_method: PaymentMethod;
  settlement_status: SettlementStatus;
  lifecycle_status: LifecycleStatus;
  idempotency_key: UUID;
  created_at: ISODateString;
  updated_at: ISODateString;
}

// ─── Транзакция ─────────────────────────────────────────────────────────────

export interface Transaction {
  id: UUID;
  direction: TransactionDirection;
  amount: MoneyString;
  category_id: UUID;
  from_wallet_id: UUID | null;
  to_wallet_id: UUID | null;
  counterparty_id: UUID | null;
  trip_order_id: UUID | null;
  service_order_id: UUID | null;
  lifecycle_status: LifecycleStatus;
  settlement_status: SettlementStatus;
  transaction_date: ISODateString;
  description: string | null;
  photo_url: string | null;
  idempotency_key: UUID;
  created_by: UUID;
  created_at: ISODateString;
  updated_at: ISODateString;
}

// ─── Кошелёк ────────────────────────────────────────────────────────────────

export interface Wallet {
  id: UUID;
  name: string;
  type: WalletType;
  owner_user_id: UUID | null;
  legal_entity_id: UUID;
  is_active: boolean;
  created_at: ISODateString;
}

// ─── Контрагент ─────────────────────────────────────────────────────────────

export interface Counterparty {
  id: UUID;
  name: string;
  phone: string | null;
  type: 'client' | 'supplier' | 'both';
  credit_limit: MoneyString | null;
  notes: string | null;
  is_active: boolean;
  created_at: ISODateString;
  updated_at: ISODateString;
}
```

**`packages/shared-types/src/api.ts`:**

```typescript
// Стандартные типы для API ответов

export interface ApiSuccess<T> {
  data: T;
  error: null;
}

export interface ApiError {
  data: null;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// Пагинация
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Idempotency key — генерируется на клиенте при открытии формы
export type IdempotencyKey = string; // UUID v4
```

**`packages/shared-types/src/index.ts`:**

```typescript
export * from './database.types';
export * from './enums';
export * from './models';
export * from './api';
```

### Шаг 3. Создать `packages/ui`

```powershell
mkdir C:\salda\packages\ui
mkdir C:\salda\packages\ui\src
mkdir C:\salda\packages\ui\src\components
```

**`packages/ui/package.json`:**

```json
{
  "name": "@saldacargo/ui",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./globals.css": "./src/globals.css"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/"
  },
  "dependencies": {
    "@saldacargo/shared-types": "workspace:*",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "lucide-react": "^0.383.0",
    "tailwind-merge": "^2.2.2"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "react": "^19.0.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.4.5"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

**`packages/ui/tsconfig.json`:**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "outDir": "./dist"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist"]
}
```

**`packages/ui/src/lib/utils.ts`:**

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**`packages/ui/src/components/button.tsx`:**

```tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-orange-600 text-white hover:bg-orange-700 focus-visible:ring-orange-500',
        secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
        outline: 'border border-slate-300 bg-white hover:bg-slate-50',
        ghost: 'hover:bg-slate-100',
        link: 'text-orange-600 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-6 text-base',
        // Mobile-first: минимум 48px высота для пальцев
        mobile: 'h-12 w-full px-4 text-base font-semibold',
        // Главные кнопки в MiniApp: 64px
        hero: 'h-16 w-full px-4 text-lg font-bold',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

**`packages/ui/src/components/badge.tsx`:**

```tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';
import type { LifecycleStatus, SettlementStatus } from '@saldacargo/shared-types';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'bg-slate-100 text-slate-700',
        draft: 'bg-amber-100 text-amber-700',
        approved: 'bg-green-100 text-green-700',
        returned: 'bg-red-100 text-red-700',
        cancelled: 'bg-slate-100 text-slate-500 line-through',
        pending: 'bg-blue-100 text-blue-700',
        completed: 'bg-green-100 text-green-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

// Хелперы для статусов
export function LifecycleBadge({ status }: { status: LifecycleStatus }) {
  const labels: Record<LifecycleStatus, string> = {
    draft: 'Черновик',
    approved: 'Утверждено',
    returned: 'Возвращено',
    cancelled: 'Отменено',
  };
  return <Badge variant={status}>{labels[status]}</Badge>;
}

export function SettlementBadge({ status }: { status: SettlementStatus }) {
  const labels: Record<SettlementStatus, string> = {
    pending: 'Ожидает',
    completed: 'Оплачено',
  };
  return <Badge variant={status}>{labels[status]}</Badge>;
}

export { Badge, badgeVariants };
```

**`packages/ui/src/components/money.tsx`:**

```tsx
import * as React from 'react';
import { cn } from '../lib/utils';

interface MoneyProps {
  amount: string | number;
  className?: string;
  showSign?: boolean;
  // Цвет по знаку (для P&L)
  colorize?: boolean;
}

/**
 * Форматирует денежную сумму в рублях.
 * Всегда принимает строку или число, форматирует в "1 234 ₽"
 * Никогда не использует float для хранения — только для отображения.
 */
export function Money({ amount, className, showSign, colorize }: MoneyProps) {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  const formatted = new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);

  const sign = showSign && num > 0 ? '+' : '';
  const colorClass = colorize
    ? num > 0
      ? 'text-green-600'
      : num < 0
        ? 'text-red-600'
        : 'text-slate-500'
    : '';

  return (
    <span className={cn('font-mono tabular-nums', colorClass, className)}>
      {sign}
      {formatted}
    </span>
  );
}
```

**`packages/ui/src/components/network-indicator.tsx`:**

```tsx
'use client';
import * as React from 'react';
import { cn } from '../lib/utils';

interface NetworkIndicatorProps {
  className?: string;
}

/**
 * Индикатор сети для MiniApp — водители ездят в межгород,
 * часто без сигнала. Показывает статус синхронизации.
 */
export function NetworkIndicator({ className }: NetworkIndicatorProps) {
  const [isOnline, setIsOnline] = React.useState(true);
  const [pendingCount, setPendingCount] = React.useState(0);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && pendingCount === 0) {
    return <span className={cn('text-xs text-green-600', className)}>📶 Онлайн</span>;
  }
  if (pendingCount > 0) {
    return (
      <span className={cn('text-xs text-amber-600', className)}>🔄 {pendingCount} в очереди</span>
    );
  }
  return <span className={cn('text-xs text-red-600', className)}>📵 Офлайн</span>;
}
```

**`packages/ui/src/index.ts`:**

```typescript
// Components
export { Button, buttonVariants } from './components/button';
export type { ButtonProps } from './components/button';
export { Badge, badgeVariants, LifecycleBadge, SettlementBadge } from './components/badge';
export type { BadgeProps } from './components/badge';
export { Money } from './components/money';
export { NetworkIndicator } from './components/network-indicator';

// Utils
export { cn } from './lib/utils';
```

### Шаг 4. Удалить `.gitkeep` из packages/

```powershell
Remove-Item C:\salda\packages\.gitkeep
```

### Шаг 5. Подключить пакеты к приложениям

Добавь в `apps/web/package.json` в секцию `dependencies`:

```json
"@saldacargo/shared-types": "workspace:*",
"@saldacargo/ui": "workspace:*"
```

Добавь в `apps/miniapp/package.json` в секцию `dependencies`:

```json
"@saldacargo/shared-types": "workspace:*",
"@saldacargo/ui": "workspace:*"
```

### Шаг 6. Установить зависимости

```powershell
cd C:\salda
pnpm install
```

### Шаг 7. Проверить импорты

Создай временный файл `apps/web/app/test-imports.ts`:

```typescript
// Этот файл только для проверки — удалим после
import type { Trip, User, MoneyString } from '@saldacargo/shared-types';
import { LifecycleStatus, UserRole } from '@saldacargo/shared-types';
import { cn } from '@saldacargo/ui';

const status: LifecycleStatus = LifecycleStatus.DRAFT;
const role: UserRole = UserRole.DRIVER;
console.log(status, role, cn('test'));
```

```powershell
pnpm typecheck
```

Если ошибок нет — удали временный файл.

### Шаг 8. Проверка

```powershell
pnpm install   # без ошибок
pnpm typecheck # зелёный
pnpm lint      # зелёный
```

### Шаг 9. Коммит

```powershell
git add .
git commit -m "feat: packages/shared-types и packages/ui

- shared-types: enums, models, api типы для всего проекта
- ui: Button, Badge, Money, NetworkIndicator компоненты
- Двухосный статус (lifecycle + settlement) зафиксирован в типах
- MoneyString тип — строка, никогда float
- Подключено к apps/web и apps/miniapp"
git push
```

---

## Критерии приёмки

- [ ] `packages/shared-types/` существует с правильной структурой
- [ ] `packages/ui/` существует с правильной структурой
- [ ] `packages/shared-types/package.json` содержит `"name": "@saldacargo/shared-types"`
- [ ] `packages/ui/package.json` содержит `"name": "@saldacargo/ui"`
- [ ] `apps/web/package.json` содержит `"@saldacargo/shared-types": "workspace:*"`
- [ ] `apps/miniapp/package.json` содержит `"@saldacargo/ui": "workspace:*"`
- [ ] `pnpm install` проходит без ошибок
- [ ] `pnpm typecheck` зелёный
- [ ] `pnpm lint` зелёный
- [ ] `packages/.gitkeep` удалён
- [ ] Коммит сделан и запушен

---

## Что НЕ делать

- ❌ Не устанавливай shadcn/ui CLI — компоненты пишем вручную в packages/ui
- ❌ Не создавай packages/domain — это TASK_04
- ❌ Не подключай Supabase — это TASK_07
- ❌ Не добавляй react-hook-form, TanStack Query — это в конкретных TASK по экранам

---

## Отчёт

```
✅ TASK_03 выполнено

Создано пакетов: 2
- packages/shared-types @saldacargo/shared-types
- packages/ui @saldacargo/ui

Команды:
- pnpm install ✓
- pnpm typecheck ✓
- pnpm lint ✓

Git:
- Коммит: "feat: packages/shared-types и packages/ui"
- Push: успешно

Вопросы:
- (если есть)
```
