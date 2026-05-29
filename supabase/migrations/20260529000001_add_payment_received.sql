-- Rollback: ALTER TABLE service_orders DROP COLUMN payment_received;

ALTER TABLE service_orders
  ADD COLUMN payment_received BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: own-machine orders never need client payment
UPDATE service_orders SET payment_received = TRUE WHERE machine_type = 'own';

-- Backfill: existing approved client orders are considered paid
UPDATE service_orders SET payment_received = TRUE
  WHERE lifecycle_status = 'approved' AND machine_type = 'client';
