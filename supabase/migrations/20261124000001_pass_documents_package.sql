-- =============================================================================
-- Migration: 20261124000001_pass_documents_package.sql
-- Purpose:   Пакетная отправка документов водителя и ТС на пропуск:
--            1) driver_documents: is_pass_package, file_size_bytes, mime_type
--            2) asset_documents: таблица документов ТС + multi-tenant RLS
--            3) document_sends: аудит-лог отправок пакетов документов + RLS
--            4) storage.buckets('driver-documents'): лимит 10 МБ, MIME-фильтр
--               (.jpg, .jpeg, .png, .pdf, .docx) и изоляция путей по org_id
--
-- ROLLBACK PLAN:
--   DROP TABLE IF EXISTS public.document_sends;
--   DROP TABLE IF EXISTS public.asset_documents;
--   ALTER TABLE public.driver_documents
--     DROP COLUMN IF EXISTS is_pass_package,
--     DROP COLUMN IF EXISTS file_size_bytes,
--     DROP COLUMN IF EXISTS mime_type;
--   UPDATE storage.buckets
--     SET file_size_limit = NULL, allowed_mime_types = NULL
--     WHERE id = 'driver-documents';
-- =============================================================================

-- 1. Расширяем public.driver_documents
ALTER TABLE public.driver_documents
  ADD COLUMN IF NOT EXISTS is_pass_package BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT;

CREATE INDEX IF NOT EXISTS idx_driver_documents_org_driver
  ON public.driver_documents (organization_id, driver_id);

-- 2. Создаём public.asset_documents
CREATE TABLE IF NOT EXISTS public.asset_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size_bytes BIGINT,
  mime_type TEXT,
  is_pass_package BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_asset_documents_org_asset
  ON public.asset_documents (organization_id, asset_id);

ALTER TABLE public.asset_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_all ON public.asset_documents;
CREATE POLICY tenant_isolation_all ON public.asset_documents
  FOR ALL
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());

GRANT ALL ON TABLE public.asset_documents TO service_role, authenticated;

-- 3. Создаём public.document_sends (аудит отправок пакетов документов)
CREATE TABLE IF NOT EXISTS public.document_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sent_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  counterparty_id UUID REFERENCES public.counterparties(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  document_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  subject TEXT,
  attachments_count INTEGER NOT NULL DEFAULT 0,
  total_size_bytes BIGINT NOT NULL DEFAULT 0,
  provider TEXT NOT NULL DEFAULT 'resend',
  external_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_sends_org_created
  ON public.document_sends (organization_id, created_at DESC);

ALTER TABLE public.document_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_all ON public.document_sends;
CREATE POLICY tenant_isolation_all ON public.document_sends
  FOR ALL
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());

GRANT ALL ON TABLE public.document_sends TO service_role, authenticated;

-- 4. Обновляем бакет driver-documents: лимит 10 MB и разрешённые MIME-типы
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'driver-documents',
  'driver-documents',
  false,
  10485760,
  ARRAY[
    'image/jpeg',
    'image/png',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Заменяем старые открытые политики Storage на изоляцию по префиксу organization_id
DROP POLICY IF EXISTS "Authenticated users can read driver-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can insert into driver-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete from driver-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update driver-documents" ON storage.objects;

DROP POLICY IF EXISTS "tenant_read_driver_documents" ON storage.objects;
CREATE POLICY "tenant_read_driver_documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'driver-documents'
    AND (storage.foldername(name))[1] = public.current_organization_id()::text
  );

DROP POLICY IF EXISTS "tenant_insert_driver_documents" ON storage.objects;
CREATE POLICY "tenant_insert_driver_documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'driver-documents'
    AND (storage.foldername(name))[1] = public.current_organization_id()::text
  );

DROP POLICY IF EXISTS "tenant_update_driver_documents" ON storage.objects;
CREATE POLICY "tenant_update_driver_documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'driver-documents'
    AND (storage.foldername(name))[1] = public.current_organization_id()::text
  );

DROP POLICY IF EXISTS "tenant_delete_driver_documents" ON storage.objects;
CREATE POLICY "tenant_delete_driver_documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'driver-documents'
    AND (storage.foldername(name))[1] = public.current_organization_id()::text
  );
