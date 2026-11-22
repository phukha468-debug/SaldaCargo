-- ============================================================================
-- Migration: 20261122000005_legal_entities_details.sql
-- Purpose:   Добавляет расширенные реквизиты юрлиц (ОГРН, КПП, юр. адрес,
--            корр. счёт, ID ЭДО) в таблицу public.legal_entities для
--            мультитенантного онбординга и админки /settings.
--
-- ROLLBACK:
--   ALTER TABLE public.legal_entities
--     DROP COLUMN IF EXISTS ogrn,
--     DROP COLUMN IF EXISTS kpp,
--     DROP COLUMN IF EXISTS legal_address,
--     DROP COLUMN IF EXISTS corr_account,
--     DROP COLUMN IF EXISTS edo_id;
-- ============================================================================

ALTER TABLE public.legal_entities
  ADD COLUMN IF NOT EXISTS ogrn TEXT,
  ADD COLUMN IF NOT EXISTS kpp TEXT,
  ADD COLUMN IF NOT EXISTS legal_address TEXT,
  ADD COLUMN IF NOT EXISTS corr_account TEXT,
  ADD COLUMN IF NOT EXISTS edo_id TEXT;

COMMENT ON COLUMN public.legal_entities.ogrn IS 'ОГРН (13 цифр) или ОГРНИП (15 цифр)';
COMMENT ON COLUMN public.legal_entities.kpp IS 'КПП (9 цифр, для ООО)';
COMMENT ON COLUMN public.legal_entities.legal_address IS 'Юридический адрес организации';
COMMENT ON COLUMN public.legal_entities.corr_account IS 'Корреспондентский счёт (20 цифр)';
COMMENT ON COLUMN public.legal_entities.edo_id IS 'Идентификатор участника ЭДО (Диадок, СБИС и т.д.)';
