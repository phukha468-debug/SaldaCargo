-- Add trip_id to transactions to link aggregated trip-level financial records
-- Rollback: ALTER TABLE transactions DROP COLUMN trip_id;

ALTER TABLE transactions ADD COLUMN trip_id UUID REFERENCES trips(id);
CREATE INDEX idx_transactions_trip_id ON transactions(trip_id);
