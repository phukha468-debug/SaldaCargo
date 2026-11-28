-- ============================================================================
-- Миграция: Привязка банковских списаний с Р/С к расходам + журнал уведомлений
-- ============================================================================
-- ROLLBACK PLAN:
--   DROP TABLE IF EXISTS public.bank_debit_notifications CASCADE;
--   DROP TABLE IF EXISTS public.bank_debit_links CASCADE;
-- ============================================================================

-- 1. Таблица связей банковских списаний (Т-Банк Open API) с транзакциями расхода
--    Поддерживает 1-к-1, 1-к-N (сплит одного вывода на карту на несколько расходов)
--    и N-к-1 без создания дублирующих транзакций в P&L.
CREATE TABLE IF NOT EXISTS public.bank_debit_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bank_operation_id TEXT NOT NULL,
  bank_operation_date TIMESTAMPTZ,
  bank_operation_amount NUMERIC(12, 2) NOT NULL CHECK (bank_operation_amount > 0),
  bank_operation_desc TEXT,
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  allocated_amount NUMERIC(12, 2) NOT NULL CHECK (allocated_amount > 0),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bank_debit_links_org_op_tx_unique UNIQUE (organization_id, bank_operation_id, transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_bank_debit_links_org_op
  ON public.bank_debit_links (organization_id, bank_operation_id);

CREATE INDEX IF NOT EXISTS idx_bank_debit_links_org_tx
  ON public.bank_debit_links (organization_id, transaction_id);

-- 2. Журнал отправленных уведомлений в MAX по списаниям (идемпотентность вебхука)
CREATE TABLE IF NOT EXISTS public.bank_debit_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bank_operation_id TEXT NOT NULL,
  recipient_max_id TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bank_debit_notifications_unique UNIQUE (organization_id, bank_operation_id, recipient_max_id)
);

CREATE INDEX IF NOT EXISTS idx_bank_debit_notifications_org_op
  ON public.bank_debit_notifications (organization_id, bank_operation_id);

-- 3. Строгий Row Level Security (Multi-tenancy)
ALTER TABLE public.bank_debit_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_debit_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_all ON public.bank_debit_links;
CREATE POLICY tenant_isolation_all ON public.bank_debit_links
  FOR ALL
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS tenant_isolation_all ON public.bank_debit_notifications;
CREATE POLICY tenant_isolation_all ON public.bank_debit_notifications
  FOR ALL
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());

-- 4. Права доступа
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_debit_links TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_debit_notifications TO authenticated, service_role;
