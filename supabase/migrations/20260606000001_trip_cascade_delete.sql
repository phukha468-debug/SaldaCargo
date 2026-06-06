-- Enable cascading deletes for trip-related records
-- This ensures that when a trip is deleted, its orders and transactions are also removed.

-- 1. trip_orders: add CASCADE to trip_id
ALTER TABLE trip_orders
  DROP CONSTRAINT IF EXISTS trip_orders_trip_id_fkey,
  ADD CONSTRAINT trip_orders_trip_id_fkey
    FOREIGN KEY (trip_id) REFERENCES trips(id)
    ON DELETE CASCADE;

-- 2. transactions: add CASCADE to trip_id
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_trip_id_fkey,
  ADD CONSTRAINT transactions_trip_id_fkey
    FOREIGN KEY (trip_id) REFERENCES trips(id)
    ON DELETE CASCADE;

-- 3. transactions: add CASCADE to trip_order_id
-- This covers older records or cases where only trip_order_id is present
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_trip_order_id_fkey,
  ADD CONSTRAINT transactions_trip_order_id_fkey
    FOREIGN KEY (trip_order_id) REFERENCES trip_orders(id)
    ON DELETE CASCADE;

-- 4. Cleanup orphaned records (if any)
-- Delete transactions where trip_id was set but the trip no longer exists
DELETE FROM transactions
WHERE trip_id IS NOT NULL
  AND trip_id NOT IN (SELECT id FROM trips);

-- Delete trip_orders that don't belong to any trip
DELETE FROM trip_orders
WHERE trip_id NOT IN (SELECT id FROM trips);

-- Delete transactions where trip_order_id was set but the order no longer exists
-- (This might happen if trip_orders were deleted manually but transactions stayed)
DELETE FROM transactions
WHERE trip_order_id IS NOT NULL
  AND trip_order_id NOT IN (SELECT id FROM trip_orders);
