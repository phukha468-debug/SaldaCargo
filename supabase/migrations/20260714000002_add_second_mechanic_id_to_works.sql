ALTER TABLE service_order_works ADD COLUMN IF NOT EXISTS second_mechanic_id UUID REFERENCES users(id);
