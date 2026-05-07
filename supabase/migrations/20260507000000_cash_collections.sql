-- Cash collections (инкассация): admin collects cash from driver's accountability
-- Rollback: DROP TABLE cash_collections;

CREATE TABLE cash_collections (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id     UUID NOT NULL REFERENCES users(id),
  amount        DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  collected_by  UUID NOT NULL REFERENCES users(id),
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast per-driver lookups
CREATE INDEX idx_cash_collections_driver_id ON cash_collections(driver_id);

-- RLS (admin client uses service_role and bypasses RLS, but we enable it for consistency)
ALTER TABLE cash_collections ENABLE ROW LEVEL SECURITY;
