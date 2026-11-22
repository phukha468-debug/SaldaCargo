-- ============================================================================
-- Миграция 2.1.1: Фундамент Multi-tenancy (organizations, members, integrations)
-- ============================================================================
-- ROLLBACK PLAN:
--   DROP TABLE IF EXISTS public.organization_integrations CASCADE;
--   DROP TABLE IF EXISTS public.organization_members CASCADE;
--   DROP TABLE IF EXISTS public.organizations CASCADE;
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  inn TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Yekaterinburg',
  currency TEXT NOT NULL DEFAULT 'RUB',
  enabled_modules TEXT[] NOT NULL DEFAULT ARRAY['transport', 'finance', 'payroll'],
  plan TEXT NOT NULL DEFAULT 'pro' CHECK (plan IN ('starter', 'pro', 'enterprise')),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organizations IS
  'Компании-клиенты (тенанты) SALDA PRO SaaS. Хранит включённые модули (Feature Flags) и настройки компании.';

CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  roles user_role[] NOT NULL DEFAULT ARRAY['driver']::user_role[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_organization_members_org_user UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_members_org_id
  ON public.organization_members (organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id
  ON public.organization_members (user_id);

COMMENT ON TABLE public.organization_members IS
  'Привязка пользователей к организациям и их роли внутри конкретного тенанта.';

CREATE TABLE IF NOT EXISTS public.organization_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  encrypted_secrets TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_organization_integrations_org_provider UNIQUE (organization_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_organization_integrations_org_id
  ON public.organization_integrations (organization_id);

COMMENT ON TABLE public.organization_integrations IS
  'Изолированные настройки и AES-256-GCM зашифрованные секреты интеграций каждого тенанта (tbank, wialon, opti24, max_bot и др.).';
