# TASK 04: Создание packages/domain модулей

**Адресат:** Claude Code.
**Длительность:** 45–60 минут.
**Зависимости:** TASK_03 выполнен (shared-types и ui созданы).

---

## Цель

Создать 9 domain-модулей в `packages/domain/`. Каждый модуль — изолированная бизнес-логика с чёткими границами. На этом этапе только структура и базовые типы — без реальной логики (она появится в TASK_11+).

---

## Структура domain-модулей

```
packages/domain/
├── shared/       — общие утилиты (форматирование денег, дат, idempotency)
├── identity/     — пользователи, роли, авторизация
├── fleet/        — машины, типы активов, ТО
├── finance/      — транзакции, кошельки, категории
├── logistics/    — рейсы, заказы
├── service/      — наряды, работы, таймер
├── payroll/      — ЗП, периоды выплат
├── receivables/  — дебиторка/кредиторка
└── warehouse/    — склад запчастей
```

---

## Алгоритм

### Шаг 1. Создать структуру папок

```powershell
$modules = @('shared','identity','fleet','finance','logistics','service','payroll','receivables','warehouse')
foreach ($m in $modules) {
  mkdir "C:\salda\packages\domain\$m"
  mkdir "C:\salda\packages\domain\$m\src"
}
```

### Шаг 2. Создать package.json для каждого модуля

Для каждого модуля создай `packages/domain/<name>/package.json` по шаблону:

```json
{
  "name": "@saldacargo/<name>",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/"
  },
  "dependencies": {
    "@saldacargo/shared-types": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.4.5"
  }
}
```

Замени `<name>` на имя модуля. Полный список имён пакетов:

| Папка       | name в package.json     |
| ----------- | ----------------------- |
| shared      | @saldacargo/shared      |
| identity    | @saldacargo/identity    |
| fleet       | @saldacargo/fleet       |
| finance     | @saldacargo/finance     |
| logistics   | @saldacargo/logistics   |
| service     | @saldacargo/service     |
| payroll     | @saldacargo/payroll     |
| receivables | @saldacargo/receivables |
| warehouse   | @saldacargo/warehouse   |

### Шаг 3. Создать tsconfig.json для каждого модуля

Одинаковый для всех:

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### Шаг 4. Создать src/index.ts для каждого модуля

#### `packages/domain/shared/src/index.ts`

```typescript
// Утилиты, которые используются во ВСЕХ модулях

import { v4 as uuidv4 } from 'uuid';

/**
 * Генерирует idempotency_key при открытии формы.
 * Передаётся с каждой мутацией чтобы сервер отбрасывал дубли.
 */
export function generateIdempotencyKey(): string {
  return uuidv4();
}

/**
 * Форматирует деньги для отображения.
 * ВАЖНО: хранение всегда в строке/DECIMAL, никогда в float.
 */
export function formatMoney(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Форматирует дату для отображения в UI.
 * Все даты в БД в UTC, отображаем в Asia/Yekaterinburg (UTC+5, Верхняя Салда).
 */
export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (dateOnly.getTime() === today.getTime()) return 'Сегодня';
  if (dateOnly.getTime() === yesterday.getTime()) return 'Вчера';

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Yekaterinburg',
  });
}

/**
 * Форматирует время.
 */
export function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Yekaterinburg',
  });
}

/**
 * Форматирует продолжительность в минутах → "3ч 47м"
 */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}м`;
  if (m === 0) return `${h}ч`;
  return `${h}ч ${m}м`;
}

/**
 * Складывает денежные строки. Никогда не используй обычный +.
 * Пример: addMoney("100.50", "200.00") → "300.50"
 */
export function addMoney(...amounts: (string | number)[]): string {
  const sum = amounts.reduce((acc: number, val) => {
    return acc + (typeof val === 'string' ? parseFloat(val) : val);
  }, 0);
  return sum.toFixed(2);
}
```

> **Примечание для программиста:** добавь `uuid` в зависимости `packages/domain/shared/package.json`:
> `"uuid": "^9.0.0"` в dependencies, `"@types/uuid": "^9.0.0"` в devDependencies.

#### `packages/domain/identity/src/index.ts`

```typescript
export type { User, UserRole } from '@saldacargo/shared-types';
export { UserRole } from '@saldacargo/shared-types';

/**
 * Проверяет, имеет ли пользователь указанную роль.
 */
export function hasRole(user: { roles: string[] }, role: string): boolean {
  return user.roles.includes(role);
}

/**
 * Возвращает отображаемое имя роли на русском.
 */
export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    owner: 'Владелец',
    admin: 'Администратор',
    driver: 'Водитель',
    loader: 'Грузчик',
    mechanic: 'Механик',
    mechanic_lead: 'Старший механик',
    accountant: 'Бухгалтер',
  };
  return labels[role] ?? role;
}
```

#### `packages/domain/fleet/src/index.ts`

```typescript
export type { Asset, AssetStatus } from '@saldacargo/shared-types';
export { AssetStatus } from '@saldacargo/shared-types';

/**
 * Возвращает отображаемое название статуса машины.
 */
export function getAssetStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: '✅ В работе',
    repair: '🔧 В ремонте',
    reserve: '🛏 Резерв',
    sold: '💰 Продана',
    written_off: '🚫 Списана',
  };
  return labels[status] ?? status;
}

/**
 * Вычисляет, нужно ли ТО (по пробегу).
 * Возвращает: 'ok' | 'soon' | 'overdue'
 */
export function getMaintenanceStatus(
  currentOdometer: number,
  lastServiceOdometer: number,
  intervalKm: number,
): 'ok' | 'soon' | 'overdue' {
  const remaining = lastServiceOdometer + intervalKm - currentOdometer;
  if (remaining <= 0) return 'overdue';
  if (remaining <= intervalKm * 0.1) return 'soon'; // < 10% осталось
  return 'ok';
}
```

#### `packages/domain/finance/src/index.ts`

```typescript
export type { Transaction, Wallet, TransactionDirection } from '@saldacargo/shared-types';
export { TransactionDirection, LifecycleStatus, SettlementStatus } from '@saldacargo/shared-types';
import { addMoney } from '@saldacargo/shared';

/**
 * ВАЖНО: балансы кошельков ВСЕГДА вычисляются из транзакций.
 * Никогда не хранятся как отдельное поле в БД.
 * Эта функция — reference implementation для фронта.
 */
export function calculateWalletBalance(
  transactions: Array<{
    direction: string;
    amount: string;
    from_wallet_id: string | null;
    to_wallet_id: string | null;
    lifecycle_status: string;
    settlement_status: string;
  }>,
  walletId: string,
): string {
  // Считаем только approved + completed
  const relevant = transactions.filter(
    (t) =>
      t.lifecycle_status === 'approved' &&
      t.settlement_status === 'completed' &&
      (t.from_wallet_id === walletId || t.to_wallet_id === walletId),
  );

  let balance = 0;
  for (const t of relevant) {
    const amount = parseFloat(t.amount);
    if (t.to_wallet_id === walletId) balance += amount;
    if (t.from_wallet_id === walletId) balance -= amount;
  }
  return balance.toFixed(2);
}

/**
 * Возвращает иконку способа оплаты.
 */
export function getPaymentMethodIcon(method: string): string {
  const icons: Record<string, string> = {
    cash: '💵',
    qr: '📱',
    bank_invoice: '🏦',
    debt_cash: '⏳',
    card_driver: '💳',
  };
  return icons[method] ?? '💰';
}

/**
 * Возвращает русское название способа оплаты.
 */
export function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: 'Наличные',
    qr: 'QR на р/с',
    bank_invoice: 'Безнал по счёту',
    debt_cash: 'Долг наличными',
    card_driver: 'На карту водителя',
  };
  return labels[method] ?? method;
}
```

#### `packages/domain/logistics/src/index.ts`

```typescript
export type { Trip, TripOrder, TripType, TripStatus } from '@saldacargo/shared-types';
export { TripType, PaymentMethod } from '@saldacargo/shared-types';

/**
 * Возвращает русское название типа рейса.
 */
export function getTripTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    local: 'По городу',
    intercity: 'Межгород',
    moving: 'Переезд',
    hourly: 'Почасовой',
  };
  return labels[type] ?? type;
}

/**
 * Вычисляет итоги рейса из списка заказов.
 */
export function calcTripTotals(
  orders: Array<{
    amount: string;
    driver_pay: string;
    loader_pay: string;
    lifecycle_status: string;
  }>,
) {
  const active = orders.filter((o) => o.lifecycle_status !== 'cancelled');
  return {
    revenue: active.reduce((s, o) => s + parseFloat(o.amount), 0).toFixed(2),
    driverPay: active.reduce((s, o) => s + parseFloat(o.driver_pay), 0).toFixed(2),
    loaderPay: active.reduce((s, o) => s + parseFloat(o.loader_pay), 0).toFixed(2),
  };
}
```

#### `packages/domain/service/src/index.ts`

```typescript
export type { ServiceOrderStatus, WorkStatus } from '@saldacargo/shared-types';
export { ServiceOrderStatus, WorkStatus } from '@saldacargo/shared-types';

/**
 * Вычисляет фактическое время работы из сегментов таймера.
 * Несколько записей work_time_logs → суммируем stopped - started.
 */
export function calcActualMinutes(
  segments: Array<{ started_at: string; stopped_at: string | null }>,
): number {
  return segments.reduce((total, seg) => {
    if (!seg.stopped_at) return total;
    const diff = new Date(seg.stopped_at).getTime() - new Date(seg.started_at).getTime();
    return total + Math.round(diff / 60000);
  }, 0);
}

/**
 * Вычисляет эффективность механика по наряду.
 * > 100% = быстрее нормы, < 100% = медленнее.
 */
export function calcEfficiency(actualMinutes: number, normMinutes: number): number {
  if (normMinutes === 0) return 0;
  return Math.round((normMinutes / actualMinutes) * 100);
}
```

#### `packages/domain/payroll/src/index.ts`

```typescript
/**
 * Расчёт ЗП — ТОЛЬКО подсказка для UI.
 * Реальная ЗП вводится вручную в поле driver_pay по каждому заказу.
 * Формула никогда не перезаписывает ручной ввод автоматически.
 */
export function suggestDriverPay(
  orderAmount: number,
  ruleType: 'percent' | 'fixed',
  ruleValue: number,
): number {
  if (ruleType === 'percent') {
    return Math.round((orderAmount * ruleValue) / 100);
  }
  return ruleValue;
}

/**
 * Суммирует ЗП водителя за период из утверждённых рейсов.
 */
export function calcPeriodPay(
  orders: Array<{ driver_pay: string; lifecycle_status: string }>,
): string {
  return orders
    .filter((o) => o.lifecycle_status === 'approved')
    .reduce((sum, o) => sum + parseFloat(o.driver_pay), 0)
    .toFixed(2);
}
```

#### `packages/domain/receivables/src/index.ts`

```typescript
/**
 * Дебиторка — транзакции с settlement_status = 'pending' и direction = 'income'.
 * Кредиторка — транзакции с settlement_status = 'pending' и direction = 'expense'.
 */

/**
 * Вычисляет дни просрочки от даты транзакции до сегодня.
 */
export function calcOverdueDays(transactionDate: string): number {
  const diff = Date.now() - new Date(transactionDate).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Возвращает статус просрочки для UI.
 */
export function getOverdueStatus(days: number): 'ok' | 'warning' | 'critical' {
  if (days <= 0) return 'ok';
  if (days <= 7) return 'warning';
  return 'critical';
}
```

#### `packages/domain/warehouse/src/index.ts`

```typescript
/**
 * Склад запчастей.
 * Остатки вычисляются из part_movements (приход - расход).
 * Никогда не хранятся как отдельное поле (аналогично кошелькам).
 */

/**
 * Вычисляет остаток позиции из движений.
 */
export function calcPartStock(
  movements: Array<{ quantity: number; direction: 'in' | 'out' }>,
): number {
  return movements.reduce((stock, m) => {
    return m.direction === 'in' ? stock + m.quantity : stock - m.quantity;
  }, 0);
}

/**
 * Возвращает статус остатка.
 */
export function getStockStatus(current: number, minimum: number): 'ok' | 'low' | 'empty' {
  if (current <= 0) return 'empty';
  if (current <= minimum) return 'low';
  return 'ok';
}
```

### Шаг 5. Удалить `.gitkeep` из packages/domain/

```powershell
Remove-Item C:\salda\packages\domain\.gitkeep
```

### Шаг 6. Установить зависимости и проверить

```powershell
cd C:\salda
pnpm install
pnpm typecheck
pnpm lint
```

### Шаг 7. Коммит

```powershell
git add .
git commit -m "feat: packages/domain — 9 бизнес-модулей

- shared: formatMoney, formatDate, formatDuration, addMoney
- identity: hasRole, getRoleLabel
- fleet: getAssetStatusLabel, getMaintenanceStatus
- finance: calculateWalletBalance, getPaymentMethodLabel
- logistics: getTripTypeLabel, calcTripTotals
- service: calcActualMinutes, calcEfficiency
- payroll: suggestDriverPay, calcPeriodPay
- receivables: calcOverdueDays, getOverdueStatus
- warehouse: calcPartStock, getStockStatus"
git push
```

---

## Критерии приёмки

- [ ] Все 9 папок `packages/domain/<name>/` существуют
- [ ] В каждой: `package.json`, `tsconfig.json`, `src/index.ts`
- [ ] `pnpm install` без ошибок
- [ ] `pnpm typecheck` зелёный
- [ ] `packages/domain/.gitkeep` удалён
- [ ] Коммит и push выполнены

## Что НЕ делать

- ❌ Не добавляй реальные API-вызовы к Supabase — только чистая логика
- ❌ Не подключай модули к apps/ — это сделаем в TASK_11+
- ❌ Не создавай тесты — это отдельно

---

## Отчёт

```
✅ TASK_04 выполнено

Создано модулей: 9
- @saldacargo/shared
- @saldacargo/identity
- @saldacargo/fleet
- @saldacargo/finance
- @saldacargo/logistics
- @saldacargo/service
- @saldacargo/payroll
- @saldacargo/receivables
- @saldacargo/warehouse

Команды:
- pnpm install ✓
- pnpm typecheck ✓
- pnpm lint ✓

Git: push успешно

Вопросы:
- (если есть)
```
