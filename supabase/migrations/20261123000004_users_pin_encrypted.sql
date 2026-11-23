-- ============================================================================
-- Миграция: Добавление колонки users.pin_encrypted для безопасного просмотра
--           PIN-кодов сотрудников администратором (AES-256-GCM).
--
-- Откат (rollback):
--   ALTER TABLE public.users DROP COLUMN IF EXISTS pin_encrypted;
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS pin_encrypted TEXT;

COMMENT ON COLUMN public.users.pin_encrypted IS
  'AES-256-GCM зашифрованная копия PIN-кода (формат v1:iv:tag:ct) для просмотра администратором; проверка входа по-прежнему выполняется по scrypt-хешу pin_code.';
