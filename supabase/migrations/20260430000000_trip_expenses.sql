-- TRIP_EXPENSES (Расходы в рейсе)
CREATE TABLE IF NOT EXISTS trip_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES transaction_categories(id),
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL, -- 'cash', 'card_driver', 'fuel_card'
  description TEXT,
  receipt_photo TEXT, -- URL фото чека
  idempotency_key UUID NOT NULL UNIQUE,
  linked_expense_tx_id UUID REFERENCES transactions(id),

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Индексы
CREATE INDEX idx_trip_expenses_trip_id ON trip_expenses(trip_id);
CREATE INDEX idx_trip_expenses_category_id ON trip_expenses(category_id);

-- RLS
ALTER TABLE trip_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can view their own trip expenses"
  ON trip_expenses FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM trips 
    WHERE trips.id = trip_expenses.trip_id 
    AND trips.driver_id = auth.uid()
  ));

CREATE POLICY "Drivers can insert expenses for their active trips"
  ON trip_expenses FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM trips 
    WHERE trips.id = trip_id 
    AND trips.driver_id = auth.uid()
    AND trips.status = 'in_progress'
  ));

CREATE POLICY "Admins can do everything with trip expenses"
  ON trip_expenses FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND roles && ARRAY['admin', 'owner']::user_role[]
  ));
