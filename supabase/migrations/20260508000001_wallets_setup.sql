-- Шаг 1: добавляем значение enum (должно быть в отдельной транзакции)
-- Rollback: ALTER TYPE wallet_type RENAME TO wallet_type_old; (enum values нельзя удалить в Postgres)

ALTER TYPE wallet_type ADD VALUE IF NOT EXISTS 'company_card';
