-- =============================================================================
-- Migration: 20261124000002_grant_driver_documents_and_cleanup_resend.sql
-- Purpose:   1) Выдать привилегии service_role и authenticated на таблицу
--               public.driver_documents (устраняет permission denied при загрузке).
--            2) Удалить устаревший провайдер 'resend' из organization_integrations
--               и сменить DEFAULT колонки document_sends.provider на 'smtp'.
--
-- ROLLBACK PLAN:
--   REVOKE ALL ON TABLE public.driver_documents FROM service_role, authenticated;
--   ALTER TABLE public.document_sends ALTER COLUMN provider SET DEFAULT 'resend';
-- =============================================================================

GRANT ALL ON TABLE public.driver_documents TO service_role, authenticated;

ALTER TABLE public.document_sends
  ALTER COLUMN provider SET DEFAULT 'smtp';

DELETE FROM public.organization_integrations
WHERE provider = 'resend';
