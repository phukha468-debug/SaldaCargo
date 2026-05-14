-- receivable_follow_ups: AR follow-up tracking per counterparty-debtor
-- Rollback: DROP TABLE IF EXISTS receivable_follow_ups;

CREATE TABLE IF NOT EXISTS receivable_follow_ups (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  counterparty_id  UUID         NOT NULL REFERENCES counterparties(id) ON DELETE CASCADE,
  status           TEXT         NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'promised', 'disputed', 'bad_debt')),
  promise_date     DATE,
  last_contact_at  TIMESTAMPTZ,
  next_contact_at  DATE,
  notes            TEXT,
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_by       UUID         REFERENCES users(id),
  UNIQUE(counterparty_id)
);

COMMENT ON TABLE receivable_follow_ups IS 'AR follow-up tracking: promise dates, contact notes, status per debtor counterparty';
COMMENT ON COLUMN receivable_follow_ups.status IS 'active=in progress, promised=date set by debtor, disputed=contested debt, bad_debt=write-off candidate';
COMMENT ON COLUMN receivable_follow_ups.promise_date IS 'Date debtor promised to pay';
COMMENT ON COLUMN receivable_follow_ups.last_contact_at IS 'Timestamp of last manager contact with debtor';
COMMENT ON COLUMN receivable_follow_ups.next_contact_at IS 'Scheduled date for next follow-up call';
COMMENT ON COLUMN receivable_follow_ups.notes IS 'Latest note from manager (overwrites on each update)';

ALTER TABLE receivable_follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on receivable_follow_ups"
  ON receivable_follow_ups
  FOR ALL
  USING (true)
  WITH CHECK (true);

GRANT ALL ON TABLE receivable_follow_ups TO postgres, anon, authenticated, service_role;

CREATE TRIGGER trg_receivable_follow_ups_updated_at
  BEFORE UPDATE ON receivable_follow_ups
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
