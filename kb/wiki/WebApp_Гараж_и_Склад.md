# WebApp: Гараж и Склад

**Теги:** #webapp #сервис #гараж #наряды
**Обновлено:** 2026-05-20

## Суть

Модуль `/garage` — управление нарядами СТО (станции техобслуживания) через веб-дашборд.
Создание нарядов, назначение механиков, учёт видов работ, расчёт ЗП, печать заказ-наряда.

---

## Жизненный цикл наряда

```
Создание  → lifecycle_status: draft,    status: created
Добавлены работы → виды работ в статусе pending
Механик/Админ выполняет работу → status: completed
  → AUTO: транзакция PAYROLL_MECHANIC (settlement: pending = долг)
Все работы completed → появляется кнопка «Завершить наряд»
  → По нажатию: lifecycle_status: approved → Архив
Открыть заново → lifecycle_status: draft
Удалить (пароль 9111) → lifecycle_status: cancelled (soft-delete)
```

**Авто-закрытие убрано** (сессия 16). Наряд закрывается только явной кнопкой.

---

## Структура UI

- Вкладки: **Активные** (draft) | **Архив** (approved)
- Клик по наряду → боковая панель с деталями
- Боковая панель: заголовок, авто, клиент, механик (выбор), виды работ, кнопка «Завершить»

---

## Справочник работ (work_catalog)

- 95 позиций, 10 категорий (включая Диагностику)
- Поиск по названию
- Аккордеон по категориям
- Поля: `norm_minutes` (норма), `mechanic_salary_pct` (% ЗП механика)

---

## Расчёт цены работы

```
workPrice = actual_minutes × quantity / 60 × hourly_rate
```

- `hourly_rate` = `sto_settings.hourly_rate` (клиент) или `hourly_rate_own` (свой авто)
- Ручной ввод цены **удалён** (сессия 15) — только автоматический расчёт
- `quantity` — количество единиц (шин, дисков и т.п.), умножает нормативное время

---

## Расчёт ЗП механика

```
salary = workPrice × mechanic_salary_pct / 100
```

При двух механиках: `каждый = (workPrice / 2) × собственный_pct / 100`

Транзакция создаётся при закрытии работы («✓ Выполнено»):

- `category_id`: PAYROLL_MECHANIC (`3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6`)
- `direction`: expense
- `settlement_status`: **pending** (долг, не выплата)
- `related_user_id`: UUID механика

---

## Блокировка «✓ Выполнено»

Кнопка заблокирована (показывает «Назначьте механика») если:

- `order.mechanic` пусто (сохранённое значение в БД)
- И `editMechanic` тоже пусто или не выбрано (dropdown не тронут)

Выбор механика в dropdown (до нажатия «Сохранить») — считается достаточным для снятия блокировки.

---

## API эндпоинты

| Метод  | URL                                      | Действие                                           |
| ------ | ---------------------------------------- | -------------------------------------------------- |
| GET    | `/api/garage/orders`                     | Список нарядов (filter: active/history/all)        |
| POST   | `/api/garage/orders`                     | Создать наряд                                      |
| GET    | `/api/garage/orders/[id]`                | Детали наряда                                      |
| PATCH  | `/api/garage/orders/[id]`                | Обновить (mechanic, lifecycle_status)              |
| DELETE | `/api/garage/orders/[id]`                | Мягкое удаление (lifecycle=cancelled, пароль 9111) |
| POST   | `/api/garage/orders/[id]/works`          | Добавить вид работы                                |
| PATCH  | `/api/garage/orders/[id]/works/[workId]` | Обновить работу (status, actual_minutes)           |
| DELETE | `/api/garage/orders/[id]/works/[workId]` | Удалить работу                                     |
| GET    | `/api/garage/orders/[id]/print`          | Печать заказ-наряда (A4 HTML)                      |
| GET    | `/api/garage/dashboard`                  | KPI дашборда                                       |

---

## TanStack Query оптимизация (сессия 16)

- `staleTime: 30000` — на `garage-order` query (не рефетчить при каждом фокусе окна)
- `invalidateQueries` вместо `refetchQueries` — фоновое обновление, не блокирует UI
- Умная инвалидация: `garage-orders` и `garage-dashboard` обновляются **только** когда меняется `lifecycle_status` (а не при каждой PATCH-операции)

---

## Печать заказ-наряда

Эндпоинт `/api/garage/orders/[id]/print` отдаёт HTML для A4-печати.
Данные компании берутся из таблицы `sto_settings`:

- `company_name`, `company_inn`, `company_address`, `company_phone`
- `hourly_rate`, `hourly_rate_own`

---

## Связанные страницы

[[Транзакции]], [[Справочник_таблиц_БД]], [[CrossApp_Features]]
