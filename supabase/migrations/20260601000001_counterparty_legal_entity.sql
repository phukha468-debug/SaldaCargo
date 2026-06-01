-- Add is_legal_entity flag to counterparties
-- Rollback: ALTER TABLE counterparties DROP COLUMN IF EXISTS is_legal_entity;

ALTER TABLE counterparties
  ADD COLUMN IF NOT EXISTS is_legal_entity BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN counterparties.is_legal_entity IS
  'true = юрлицо (pays by invoice → Р/С); false = физлицо (pays cash/QR → Касса/Р/С)';

-- Transfer card wallet balance to cash wallet (merge wallets)
-- Card wallet: 10000000-0000-0000-0000-000000000003
-- Cash wallet: 10000000-0000-0000-0000-000000000002
-- We keep the card wallet row in DB for history integrity;
-- just route all future card_driver transactions to cash wallet in application code.

-- Re-route existing completed card_driver trip_orders' implied wallet to cash:
-- (No data change needed — the routing is handled at query time in the settle API)
