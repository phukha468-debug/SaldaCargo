-- =============================================================================
-- Migration: 20261123000001_telematics_autopilot_v2.sql
-- Purpose:   Автопилот Wialon / Telematics v2 (Multi-tenant):
--            1. assets.odometer_offset_km для калибровки одометра на уровне ТС
--            2. vehicle_telematics_state — состояние конечного автомата + lease-lock
--            3. telematics_events — структурированный журнал решений (diagnostic trail)
--            4. telematics_geocode_cache — кэш обратного геокодирования по сетке ~100м
--            5. Безопасная дедупликация старых orders (status='in_progress') и
--               partial unique index idx_orders_one_in_progress_per_vehicle
--
-- ROLLBACK PLAN:
--   DROP INDEX IF EXISTS public.idx_orders_one_in_progress_per_vehicle;
--   DROP TABLE IF EXISTS public.telematics_geocode_cache CASCADE;
--   DROP TABLE IF EXISTS public.telematics_events CASCADE;
--   DROP TABLE IF EXISTS public.vehicle_telematics_state CASCADE;
--   ALTER TABLE public.assets DROP COLUMN IF EXISTS odometer_offset_km;
-- =============================================================================

-- 1. Калибровочное смещение одометра трекера на уровне автомобиля
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS odometer_offset_km INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.assets.odometer_offset_km IS
  'Калибровочное смещение (в км), добавляемое к относительному счётчику одометра GPS-трекера';

-- 2. Состояние конечного автомата и распределённая блокировка по машине
CREATE TABLE IF NOT EXISTS public.vehicle_telematics_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'wialon',
  external_unit_id TEXT,
  state TEXT NOT NULL DEFAULT 'AT_BASE'
    CHECK (state IN ('AT_BASE', 'EN_ROUTE', 'AT_STOP', 'IN_BASE_TRANSIT')),
  base_confirm_since TIMESTAMPTZ,
  depart_confirm_count INTEGER NOT NULL DEFAULT 0,
  transit_entered_at TIMESTAMPTZ,
  last_msg_ts BIGINT NOT NULL DEFAULT 0,
  last_lat DOUBLE PRECISION,
  last_lon DOUBLE PRECISION,
  last_speed DOUBLE PRECISION,
  last_odometer_km INTEGER,
  pending_stop_json JSONB,
  locked_until TIMESTAMPTZ,
  locked_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_vehicle_telematics_state_asset UNIQUE (organization_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_telematics_state_org
  ON public.vehicle_telematics_state (organization_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_telematics_state_lock
  ON public.vehicle_telematics_state (asset_id, locked_until);

-- 3. Структурированный журнал решений трекера (Diagnostic Trail)
CREATE TABLE IF NOT EXISTS public.telematics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'cron'
    CHECK (source IN ('cron', 'webhook', 'manual')),
  decision TEXT NOT NULL
    CHECK (decision IN (
      'trip_opened',
      'stop_recorded',
      'stop_ignored',
      'transit_entered',
      'transit_resumed',
      'trip_closed_to_review',
      'ignored_gps_noise',
      'ignored_gps_stale',
      'ignored_duplicate_lock',
      'error'
    )),
  reason_code TEXT NOT NULL,
  reason_text TEXT NOT NULL,
  state_before TEXT,
  state_after TEXT,
  telemetry_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telematics_events_org_asset_created
  ON public.telematics_events (organization_id, asset_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_telematics_events_org_created
  ON public.telematics_events (organization_id, created_at DESC);

-- 4. Кэш обратного геокодирования по координатной сетке (~100 м, 3 знака после запятой)
CREATE TABLE IF NOT EXISTS public.telematics_geocode_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lat_grid INTEGER NOT NULL,
  lon_grid INTEGER NOT NULL,
  city TEXT NOT NULL,
  raw_address TEXT NOT NULL,
  name TEXT NOT NULL,
  is_service_stop BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_telematics_geocode_grid UNIQUE (organization_id, lat_grid, lon_grid)
);

CREATE INDEX IF NOT EXISTS idx_telematics_geocode_expires
  ON public.telematics_geocode_cache (expires_at);

-- 5. Строгий RLS (tenant_isolation_all) на всех новых таблицах
DO $$
DECLARE
  tbl TEXT;
  new_tables TEXT[] := ARRAY[
    'vehicle_telematics_state',
    'telematics_events',
    'telematics_geocode_cache'
  ];
BEGIN
  FOREACH tbl IN ARRAY new_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_all ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_all ON public.%I
         FOR ALL
         USING (organization_id = public.current_organization_id())
         WITH CHECK (organization_id = public.current_organization_id())',
      tbl
    );
  END LOOP;
END $$;

-- 6. Безопасная очистка возможных старых зависших дублей orders (status = 'in_progress')
--    на одну и ту же машину: оставляем только самый свежий рейс, более старые
--    переводим в pending_review с пометкой auto_deduplicated = true.
WITH ranked_in_progress AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, assigned_vehicle_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.orders
  WHERE status = 'in_progress'
    AND assigned_vehicle_id IS NOT NULL
)
UPDATE public.orders o
SET
  status = 'pending_review',
  raw_parser_payload = COALESCE(o.raw_parser_payload, '{}'::jsonb) || jsonb_build_object(
    'auto_deduplicated', true,
    'auto_deduplicated_at', to_jsonb(now())
  ),
  updated_at = now()
FROM ranked_in_progress r
WHERE o.id = r.id
  AND r.rn > 1;

-- 7. Гарантия на уровне БД: не более одного активного заказа in_progress на машину в организации
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_one_in_progress_per_vehicle
  ON public.orders (organization_id, assigned_vehicle_id)
  WHERE status = 'in_progress' AND assigned_vehicle_id IS NOT NULL;
