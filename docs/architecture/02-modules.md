# 02. Граф модулей и правила импортов

**Файл:** `docs/architecture/02-modules.md`
**Цель:** Зафиксировать архитектурные границы, чтобы AI-ассистенты и разработчик не нарушали их при правках.
**Статус:** Действующий с 28 апреля 2026.

---

## 1. Зачем это нужно

Когда несколько частей кода зависят друг от друга бесконтрольно — получается «суп». Изменение в одном месте ломает три других. На первых порах это терпимо, на долгой дистанции — катастрофа.

Чтобы этого избежать, мы делим бизнес-логику на **модули** и определяем для каждого модуля:

- что он делает (зона ответственности),
- от кого он зависит,
- кто зависит от него.

И — главное — **запрещаем циклические зависимости**. Если модуль A зовёт модуль B, то B уже не может звать A. Никогда. Если кажется, что нужно — это сигнал, что архитектура сломалась.

ESLint-правило `boundaries/element-types` следит за этим автоматически. Сборка падает, если граф нарушен.

---

## 2. Уровни архитектуры

Модули организованы в 4 уровня. Импорт может идти только сверху вниз.

```
Уровень 4. Оркестрация (use-cases в API routes)
           │
           ▼
Уровень 3. Бизнес-модули
           ├── logistics
           ├── service
           ├── payroll
           ├── receivables
           └── integrations
           │
           ▼
Уровень 2. Финансовое и фактологическое ядро
           ├── finance
           └── fleet
           │
           ▼
Уровень 1. Фундамент
           ├── identity
           └── shared
```

**Чем ниже уровень — тем стабильнее.** `shared` практически не меняется. `logistics` и `service` меняются регулярно — там бизнес-правила.

---

## 3. Описание каждого модуля

### Уровень 1: Фундамент

#### `shared`

**Что делает:** общие технические утилиты, которые нужны везде.

**Содержит:**

- Работа с деньгами (`Money` как `string`, арифметика, форматирование).
- Работа с датами (зона `Asia/Yekaterinburg`, форматы, диапазоны).
- Идемпотентность (генерация и проверка ключей).
- Тип `Result<T, E>` для функций, которые могут провалиться.
- Базовые ошибки (`DomainError`, `ValidationError`, `NotFoundError`).
- Хелперы для работы с UUID, перечислениями, проверками.

**От кого зависит:** ни от кого внутри `domain`. Может тянуть `zod`, `date-fns`, утилиты из npm.

**Кто зависит:** все остальные модули.

**Чего не делает:** не знает о Supabase, не знает о бизнес-сущностях (рейс, машина, кошелёк).

---

#### `identity`

**Что делает:** идентификация и авторизация. Кто пользователь, какая у него роль, есть ли у него доступ.

**Содержит:**

- Сущность `User` (домейновый объект).
- Перечисление ролей (`owner`, `admin`, `dispatcher`, `driver`, `loader`, `mechanic`, `mechanic_lead`, `accountant`).
- Функция `getCurrentUser(req)` — извлекает пользователя из JWT.
- Функция `requireRole(user, ['admin', 'owner'])` — проверка прав.
- Интеграция с MAX OAuth (получение `max_user_id`, верификация подписи).
- Интеграция с Supabase Auth.

**От кого зависит:** `shared`.

**Кто зависит:** `fleet`, `finance`, `logistics`, `service`, `payroll`. Все, кому нужно знать «кто это сделал».

**Чего не делает:** не управляет правами на конкретные ресурсы — это делает RLS в БД и use-cases в роутах. `identity` только говорит «вот пользователь, вот его роль».

---

### Уровень 2: Финансовое и фактологическое ядро

#### `fleet`

**Что делает:** машины как актив. Жизненный цикл от поступления до списания.

**Содержит:**

- Сущность `Asset` (машина).
- CRUD машин.
- Расчёт амортизации (`monthly_depreciation = residual_value / remaining_life_months`).
- Обновление пробега (`updateOdometer`) с триггером на регламенты ТО.
- Регламенты ТО (`maintenance_regulations`) и алерты (`maintenance_alerts`).
- KPI машины: КТГ (коэффициент технической готовности), пробег за период.
- Продажа и списание машины.

**От кого зависит:** `shared`, `identity`.

**Кто зависит:** `logistics` (рейсы привязаны к машине), `service` (наряды на машину), `integrations` (Wialon обновляет пробег), API routes.

**Чего не делает:** не считает прибыль с машины (это делает use-case в API route, который объединяет данные из `fleet`, `logistics`, `finance`).

---

#### `finance`

**Что делает:** деньги. Все движения денег в одной таблице — `transactions`.

**Содержит:**

- Сущность `Transaction` с двухосным статусом (`lifecycle`, `settlement`).
- Сущность `Wallet` (кошелёк): расчётный счёт, касса, подотчёт водителя, топливная карта.
- Категории доходов и расходов (`categories`).
- Функция создания транзакции (`createTransaction`) с валидацией (нельзя из кошелька в тот же кошелёк, сумма > 0).
- Расчёт баланса кошелька (`getWalletBalance`) — **только из транзакций**, никогда не хранится отдельно.
- Утверждение транзакции (`approveTransaction`).
- Закрытие платежа (`completeSettlement`).
- Корректировки (отмена через создание `transaction-обратки`).

**От кого зависит:** `shared`, `identity`.

**Кто зависит:** `logistics` (рейсы создают транзакции), `service` (наряды создают транзакции), `payroll` (выплаты), `receivables` (надстройка), `integrations` (Опти24 создаёт транзакции топлива), API routes.

**Чего не делает:** не знает, откуда транзакция (рейс, наряд, амортизация). Только хранит факты движения денег. Контекст — в `transaction.transaction_type` и в связях.

---

### Уровень 3: Бизнес-модули

#### `logistics`

**Что делает:** рейсы и всё, что в них происходит.

**Содержит:**

- Сущности `Trip`, `TripOrder`, `TripExpense`.
- Старт рейса (`startTrip`) — создание trip со статусом `in_progress`.
- Добавление заказа (`addOrder`) — создаёт `trip_order` + `transaction` (income, draft).
- Добавление расхода (`addExpense`) — создаёт `trip_expense` + `transaction` (expense, draft).
- Завершение рейса (`completeTrip`) — обновляет одометр.
- Утверждение рейса (`approveTrip`) — переводит все связанные транзакции в `approved`.
- Возврат рейса на доработку (`returnTripToDraft`).
- Сводка по рейсу (`getTripSummary`).

**От кого зависит:** `shared`, `identity`, `fleet` (нужны машины), `finance` (создаёт транзакции).

**Кто зависит:** API routes, `payroll` (через факт `trip_orders.driver_pay`).

**Чего не делает:** не считает ЗП (это `payroll`), не вычисляет прибыль машины (это use-case с участием `fleet` и `finance`).

---

#### `service`

**Что делает:** заказ-наряды СТО, склад запчастей, бэклог дефектов.

**Содержит:**

- Сущности `ServiceOrder`, `ServiceOrderWork`, `WorkTimeLog`, `ServiceOrderPart`, `Part`, `PartMovement`, `DefectLog`, `WorkCatalog`.
- Создание наряда (`createServiceOrder`).
- Назначение механика (`assignMechanic`).
- Добавление работы в наряд (`addWork`).
- Управление таймером работы: `startTimer`, `pauseTimer`, `resumeTimer`, `stopTimer`.
- Списание запчастей со склада (`consumePart`).
- Заявка на закупку (`createPurchaseRequest`).
- Фиксация дефекта (`logDefect`).
- Закрытие наряда (`closeServiceOrder`).
- Утверждение наряда (`approveServiceOrder`) — формирует счёт для клиентских машин или себестоимость для своих.

**От кого зависит:** `shared`, `identity`, `fleet` (наряд на машину), `finance` (счета и закупки).

**Кто зависит:** API routes, `payroll` (ЗП механика по нарядам).

---

#### `payroll`

**Что делает:** считает ЗП за период по фактам из других модулей.

**Содержит:**

- Сущности `PayrollPeriod`, `PayrollRule` (справочник подсказок).
- Расчёт ЗП за период для водителя: сумма `trip_orders.driver_pay` по утверждённым рейсам.
- Расчёт ЗП за период для грузчика: сумма `trip_orders.loader_pay`.
- Расчёт ЗП за период для механика: сумма по `service_order_works.actual_minutes × rate`.
- Расчёт авансов (через выплаты-расходы за период).
- Утверждение периода ЗП (`approvePeriod`).
- Выплата (`payOut`) — создаёт транзакцию.

**От кого зависит:** `shared`, `identity`, `finance` (создаёт транзакции выплат).

**Кто зависит:** API routes.

**Важно:** `payroll` **не зависит** от `logistics` или `service`. Он **читает данные напрямую из БД** через свой `repo.ts`. Альтернатива — каждый модуль публиковал бы события, payroll бы их слушал — это сложнее, на MVP не нужно.

---

#### `receivables`

**Что делает:** надстройка над `finance` для удобной работы с дебиторкой и кредиторкой.

**Содержит:**

- Получение списка должников (агрегация по `pending` транзакциям).
- Получение списка наших обязательств.
- Принятие платежа от должника (`receivePayment`) — переводит транзакцию из `pending` в `completed`.
- Частичный платёж (создаёт частичную транзакцию + остаток).
- Расчёт просрочки.

**От кого зависит:** `shared`, `finance`.

**Кто зависит:** API routes.

**Чего не делает:** не создаёт долги напрямую — долги возникают из `logistics` (заказ в долг) и `service` (счёт клиенту в долг).

---

#### `integrations`

**Что делает:** интеграции с внешними сервисами.

**Содержит:**

- **Опти24:** синхронизация заправок, создание `auto-approved` транзакций топлива.
- **Wialon:** получение пробега Валдаев, обновление `assets.odometer_current`.
- **Банк:** парсинг CSV выписки, создание транзакций.
- Логирование синхронизаций в `audit_log`.

**От кого зависит:** `shared`, `finance` (создаёт транзакции), `fleet` (обновляет пробег).

**Кто зависит:** API routes, фоновые задачи (pg_cron, ручные кнопки).

---

### Уровень 4: Оркестрация

Здесь живут **use-cases** — сценарии, которые объединяют несколько модулей. Они **не лежат в `packages/domain/`**, они в API routes (`apps/web/app/api/` и `apps/miniapp/app/api/`).

Примеры use-cases:

- **Завершить рейс** = `logistics.completeTrip` + `fleet.updateOdometer` + `integrations.queueWialonCheck`.
- **Утвердить смену** = `logistics.approveTrip` + `finance.approveBatch` (всех связанных транзакций).
- **Инкассировать у водителя** = `finance.createTransfer(from: driver_wallet, to: cash_office)` + `identity.notifyUser` (push в МАХ).
- **Закрыть период ЗП** = `payroll.calculatePeriod(month)` для каждого сотрудника + `finance.createPayables` (кредиторка перед сотрудниками).
- **Продать машину** = `fleet.markAsSold` + `finance.createTransaction(sale)` + `finance.createTransaction(book_value_writeoff)`.

Use-case — это файл API route. Он:

1. Парсит body через Zod.
2. Проверяет права (через `identity`).
3. Вызывает функции из нужных модулей.
4. Возвращает результат.

Use-cases — место, где ломается принцип «модули не зовут соседей». На уровне 4 это разрешено и нужно.

---

## 4. Матрица разрешённых импортов

| Откуда → Куда    | shared | identity | fleet | finance | logistics | service | payroll | receivables | integrations | apps |
| ---------------- | :----: | :------: | :---: | :-----: | :-------: | :-----: | :-----: | :---------: | :----------: | :--: |
| **shared**       |   —    |    ✗     |   ✗   |    ✗    |     ✗     |    ✗    |    ✗    |      ✗      |      ✗       |  ✗   |
| **identity**     |   ✓    |    —     |   ✗   |    ✗    |     ✗     |    ✗    |    ✗    |      ✗      |      ✗       |  ✗   |
| **fleet**        |   ✓    |    ✓     |   —   |    ✗    |     ✗     |    ✗    |    ✗    |      ✗      |      ✗       |  ✗   |
| **finance**      |   ✓    |    ✓     |   ✗   |    —    |     ✗     |    ✗    |    ✗    |      ✗      |      ✗       |  ✗   |
| **logistics**    |   ✓    |    ✓     |   ✓   |    ✓    |     —     |    ✗    |    ✗    |      ✗      |      ✗       |  ✗   |
| **service**      |   ✓    |    ✓     |   ✓   |    ✓    |     ✗     |    —    |    ✗    |      ✗      |      ✗       |  ✗   |
| **payroll**      |   ✓    |    ✓     |   ✗   |    ✓    |     ✗     |    ✗    |    —    |      ✗      |      ✗       |  ✗   |
| **receivables**  |   ✓    |    ✗     |   ✗   |    ✓    |     ✗     |    ✗    |    ✗    |      —      |      ✗       |  ✗   |
| **integrations** |   ✓    |    ✗     |   ✓   |    ✓    |     ✗     |    ✗    |    ✗    |      ✗      |      —       |  ✗   |
| **apps**         |   ✓    |    ✓     |   ✓   |    ✓    |     ✓     |    ✓    |    ✓    |      ✓      |      ✓       |  —   |

✓ = разрешено, ✗ = запрещено, — = сам себе.

---

## 5. ESLint-правило

В `.eslintrc.json` корня репо:

```json
{
  "plugins": ["boundaries"],
  "settings": {
    "boundaries/elements": [
      { "type": "domain-shared", "pattern": "packages/domain/shared/**" },
      { "type": "domain-identity", "pattern": "packages/domain/identity/**" },
      { "type": "domain-fleet", "pattern": "packages/domain/fleet/**" },
      { "type": "domain-finance", "pattern": "packages/domain/finance/**" },
      { "type": "domain-logistics", "pattern": "packages/domain/logistics/**" },
      { "type": "domain-service", "pattern": "packages/domain/service/**" },
      { "type": "domain-payroll", "pattern": "packages/domain/payroll/**" },
      { "type": "domain-receivables", "pattern": "packages/domain/receivables/**" },
      { "type": "domain-integrations", "pattern": "packages/domain/integrations/**" },
      { "type": "app", "pattern": "apps/**" }
    ]
  },
  "rules": {
    "boundaries/element-types": [
      "error",
      {
        "default": "disallow",
        "rules": [
          { "from": "domain-shared", "allow": [] },
          { "from": "domain-identity", "allow": ["domain-shared"] },
          { "from": "domain-fleet", "allow": ["domain-shared", "domain-identity"] },
          { "from": "domain-finance", "allow": ["domain-shared", "domain-identity"] },
          {
            "from": "domain-logistics",
            "allow": ["domain-shared", "domain-identity", "domain-fleet", "domain-finance"]
          },
          {
            "from": "domain-service",
            "allow": ["domain-shared", "domain-identity", "domain-fleet", "domain-finance"]
          },
          {
            "from": "domain-payroll",
            "allow": ["domain-shared", "domain-identity", "domain-finance"]
          },
          { "from": "domain-receivables", "allow": ["domain-shared", "domain-finance"] },
          {
            "from": "domain-integrations",
            "allow": ["domain-shared", "domain-fleet", "domain-finance"]
          },
          {
            "from": "app",
            "allow": [
              "domain-shared",
              "domain-identity",
              "domain-fleet",
              "domain-finance",
              "domain-logistics",
              "domain-service",
              "domain-payroll",
              "domain-receivables",
              "domain-integrations"
            ]
          }
        ]
      }
    ]
  }
}
```

При запуске `pnpm lint` любое нарушение даёт ошибку и блокирует merge на CI.

---

## 6. Что делать, если правило мешает

Если задача требует, чтобы модуль A позвал модуль B, который ниже в графе — это нормально, разрешено.

Если задача требует, чтобы A позвал B на том же уровне или выше — это сигнал тревоги. Варианты:

1. **Перенести вызов в use-case на уровне 4.** API route склеивает A и B. Это правильное решение в 90% случаев.
2. **Поднять часть кода в общий нижележащий модуль.** Если A и B обоим нужна одна логика — может, эта логика должна быть в `shared`.
3. **Обсудить и принять ADR.** Если архитектура реально требует пересмотра — фиксируем решение в `docs/decisions/` и меняем граф.

**Что нельзя делать:** добавить `eslint-disable` и забыть. Это технический долг, который превратит проект в кашу.

---

## 7. Зоны ответственности — спорные пограничные случаи

Иногда непонятно, к какому модулю отнести функцию. Несколько решений по неочевидным случаям:

| Функция                                       | Куда                                                              |
| --------------------------------------------- | ----------------------------------------------------------------- |
| Расчёт прибыли машины за период               | use-case в API route (объединяет `fleet`, `logistics`, `finance`) |
| Расчёт ЗП водителя за месяц                   | `payroll` (читает `trip_orders` напрямую)                         |
| Уведомление в МАХ при апруве рейса            | use-case в API route (вызывает `identity.sendMaxNotification`)    |
| Загрузка фото одометра в Storage              | `logistics` (это часть процесса рейса)                            |
| Загрузка фото дефекта                         | `service`                                                         |
| Расчёт КТГ парка                              | `fleet`                                                           |
| Расчёт цены 1 км                              | use-case в API route                                              |
| Закрытие месяца ЗП                            | use-case в API route (вызывает `payroll` для каждого сотрудника)  |
| Создание `auto-approved` транзакции из Опти24 | `integrations` (он зовёт `finance.createTransaction`)             |
| Списание запчасти при ремонте                 | `service`                                                         |

Принцип: если функция целиком про один домен → она в этом домене. Если функция объединяет несколько → она use-case.

---

## 8. Что лежит внутри модуля

Каждый модуль `packages/domain/<имя>/` имеет одинаковую внутреннюю структуру:

```
packages/domain/<имя>/
├── src/
│   ├── index.ts          ← публичный API модуля (барель экспортов)
│   ├── types.ts          ← доменные типы
│   ├── schemas.ts        ← Zod-схемы для валидации
│   ├── repo.ts           ← обращения к Supabase (CRUD)
│   ├── services.ts       ← бизнес-логика, use-cases уровня модуля
│   ├── errors.ts         ← кастомные ошибки модуля
│   └── *.test.ts         ← юнит-тесты
├── package.json
└── tsconfig.json
```

**Что экспортируется через `index.ts`:** только то, что нужно снаружи (функции из `services.ts`, типы из `types.ts`). Всё остальное (внутренние хелперы, repo) — приватно.

Если модуль большой — внутри `services.ts` можно разбить на под-файлы (`services/trips.ts`, `services/orders.ts`), но `index.ts` остаётся одним.

---

## 9. Эволюция графа

Граф не вечный. Если бизнес меняется — граф меняется тоже. Любое изменение графа фиксируется ADR в `docs/decisions/`.

Текущий граф (v1) рассчитан на MVP и первые полгода работы. После запуска возможны изменения:

- Появление модуля `notifications` (если их станет много).
- Появление модуля `analytics` (если отчёты станут отдельным крупным куском).
- Разделение `service` на `service-orders` и `inventory` (если склад разрастётся).

Все такие решения — через ADR.

---

**Файл живой. Обновляется при каждом изменении графа модулей.**
