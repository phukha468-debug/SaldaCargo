-- counterparties: add is_regular flag to distinguish regular (trusted) vs new clients
-- Rollback: ALTER TABLE counterparties DROP COLUMN IF EXISTS is_regular;

ALTER TABLE counterparties
  ADD COLUMN IF NOT EXISTS is_regular BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN counterparties.is_regular IS 'true = постоянный клиент (проверенный), false = новый/разовый';
