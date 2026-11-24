-- =============================================================================
-- Migration: 20261124000003_fix_driver_documents_created_by_fk.sql
-- Purpose:   Переключить FK driver_documents.created_by с auth.users(id) на
--            public.users(id) ON DELETE SET NULL (единообразно с asset_documents
--            и document_sends, т.к. auth.userId в PIN/MAX-сессиях — это public.users.id).
--
-- ROLLBACK PLAN:
--   ALTER TABLE public.driver_documents
--     DROP CONSTRAINT IF EXISTS driver_documents_created_by_fkey;
--   ALTER TABLE public.driver_documents
--     ADD CONSTRAINT driver_documents_created_by_fkey
--     FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
-- =============================================================================

UPDATE public.driver_documents
SET created_by = NULL
WHERE created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = driver_documents.created_by
  );

ALTER TABLE public.driver_documents
  DROP CONSTRAINT IF EXISTS driver_documents_created_by_fkey;

ALTER TABLE public.driver_documents
  ADD CONSTRAINT driver_documents_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
