-- Add email column to counterparties
-- Rollback: ALTER TABLE counterparties DROP COLUMN email;

ALTER TABLE counterparties ADD COLUMN email TEXT;
