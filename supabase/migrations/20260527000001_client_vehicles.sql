-- Клиентские автомобили СТО: нормализация + регламенты + рекомендации
-- Rollback:
--   ALTER TABLE service_orders DROP COLUMN IF EXISTS client_vehicle_id;
--   DROP TABLE IF EXISTS client_vehicle_recommendations;
--   DROP TABLE IF EXISTS client_vehicle_maintenance_rules;
--   DROP TABLE IF EXISTS client_vehicles;

-- ─── Машины клиентов ──────────────────────────────────────────────────────────
CREATE TABLE client_vehicles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counterparty_id       UUID REFERENCES counterparties(id),
  brand                 TEXT NOT NULL,
  model                 TEXT,
  year                  INTEGER,
  reg_number            TEXT NOT NULL,
  vin                   TEXT,
  color                 TEXT,
  odometer_last         INTEGER,
  odometer_updated_at   TIMESTAMPTZ,
  notes                 TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_vehicles_counterparty ON client_vehicles(counterparty_id);
CREATE INDEX idx_client_vehicles_reg_number   ON client_vehicles(reg_number);

-- ─── Плановые регламенты ТО по машине ────────────────────────────────────────
CREATE TABLE client_vehicle_maintenance_rules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_vehicle_id   UUID NOT NULL REFERENCES client_vehicles(id) ON DELETE CASCADE,
  work_name           TEXT NOT NULL,
  interval_km         INTEGER,
  interval_months     INTEGER,
  last_done_km        INTEGER,
  last_done_at        DATE,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_maint_rules_vehicle ON client_vehicle_maintenance_rules(client_vehicle_id);

-- ─── Рекомендации мастера по машине ──────────────────────────────────────────
CREATE TABLE client_vehicle_recommendations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_vehicle_id   UUID NOT NULL REFERENCES client_vehicles(id) ON DELETE CASCADE,
  service_order_id    UUID REFERENCES service_orders(id),
  text                TEXT NOT NULL,
  due_km              INTEGER,
  due_date            DATE,
  is_done             BOOLEAN NOT NULL DEFAULT false,
  done_at             TIMESTAMPTZ,
  done_by             UUID REFERENCES users(id),
  created_by          UUID NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rec_vehicle    ON client_vehicle_recommendations(client_vehicle_id);
CREATE INDEX idx_rec_order      ON client_vehicle_recommendations(service_order_id);

-- ─── Привязка нарядов к клиентским машинам ───────────────────────────────────
ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS client_vehicle_id UUID REFERENCES client_vehicles(id);

CREATE INDEX idx_service_orders_client_vehicle ON service_orders(client_vehicle_id);

-- ─── Триггеры updated_at ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_client_vehicles_updated_at
  BEFORE UPDATE ON client_vehicles
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER trg_client_vehicle_maintenance_rules_updated_at
  BEFORE UPDATE ON client_vehicle_maintenance_rules
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
