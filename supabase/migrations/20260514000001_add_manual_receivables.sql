-- Manual receivables: historical debts that existed before system start
-- Rollback: DROP TABLE IF EXISTS manual_receivables;

CREATE TABLE IF NOT EXISTS manual_receivables (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  counterparty_id UUID          NOT NULL REFERENCES counterparties(id) ON DELETE RESTRICT,
  amount          DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  date            DATE          NOT NULL,
  description     TEXT,
  settled         BOOLEAN       NOT NULL DEFAULT false,
  settled_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_by      UUID          REFERENCES users(id)
);

COMMENT ON TABLE manual_receivables IS 'Historical debts entered manually (before system tracking started)';
COMMENT ON COLUMN manual_receivables.date IS 'Date when the debt originated (user-supplied, may be in the past)';
COMMENT ON COLUMN manual_receivables.settled IS 'true = debt has been repaid';

ALTER TABLE manual_receivables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on manual_receivables"
  ON manual_receivables
  USING (true)
  WITH CHECK (true);
