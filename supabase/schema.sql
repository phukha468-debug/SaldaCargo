-- ENUMS
CREATE TYPE lifecycle_status AS ENUM ('draft', 'approved', 'cancelled');
CREATE TYPE settlement_status AS ENUM ('pending', 'completed');
CREATE TYPE vehicle_type AS ENUM ('valday', 'gazelle', 'mitsubishi');
CREATE TYPE payment_method AS ENUM ('cash', 'qr', 'invoice', 'debt', 'card');
CREATE TYPE transaction_type AS ENUM ('in', 'out');

-- 1. Legal Entities
CREATE TABLE legal_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    inn TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Business Units
CREATE TABLE business_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    legal_entity_id UUID REFERENCES legal_entities(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Asset Types
CREATE TABLE asset_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Users (Auth management handled by Supabase Auth)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    roles TEXT[] DEFAULT '{driver}',
    active_vehicle_id UUID,
    balance DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Wallets
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    name TEXT NOT NULL,
    balance DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Categories
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT, -- expense, revenue
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Counterparties
CREATE TABLE counterparties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT, -- client, supplier
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Assets (Vehicles etc)
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plate TEXT UNIQUE NOT NULL,
    model TEXT NOT NULL,
    type vehicle_type NOT NULL,
    capacity TEXT,
    gps_enabled BOOLEAN DEFAULT false,
    current_odometer INT DEFAULT 0,
    next_service_km INT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Trips
CREATE TABLE trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID REFERENCES users(id),
    loader_id UUID REFERENCES users(id),
    vehicle_id UUID REFERENCES assets(id),
    start_time TIMESTAMPTZ DEFAULT now(),
    end_time TIMESTAMPTZ,
    start_odometer INT NOT NULL,
    end_odometer INT,
    trip_type TEXT,
    odometer_start_photo TEXT,
    status lifecycle_status DEFAULT 'draft',
    revenue DECIMAL(12,2) DEFAULT 0,
    driver_salary DECIMAL(12,2) DEFAULT 0,
    loader_salary DECIMAL(12,2) DEFAULT 0,
    expenses DECIMAL(12,2) DEFAULT 0,
    profit DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Trip Orders
CREATE TABLE trip_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    order_number TEXT,
    client_name TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    driver_salary DECIMAL(12,2) DEFAULT 0,
    loader_salary DECIMAL(12,2) DEFAULT 0,
    payment_method payment_method NOT NULL,
    settlement_status settlement_status DEFAULT 'pending',
    lifecycle_status lifecycle_status DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Trip Expenses
CREATE TABLE trip_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id),
    amount DECIMAL(12,2) NOT NULL,
    payment_method payment_method NOT NULL,
    photo_url TEXT,
    lifecycle_status lifecycle_status DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. Transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    wallet_id UUID REFERENCES wallets(id),
    amount DECIMAL(12,2) NOT NULL,
    type transaction_type NOT NULL,
    category_id UUID REFERENCES categories(id),
    trip_id UUID REFERENCES trips(id),
    order_id UUID REFERENCES trip_orders(id),
    expense_id UUID REFERENCES trip_expenses(id),
    settlement_status settlement_status DEFAULT 'pending',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 13. Payroll Rules
CREATE TABLE payroll_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_role TEXT NOT NULL,
    rule_type TEXT NOT NULL, -- percentage, fixed
    value DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 14. Payroll Periods
CREATE TABLE payroll_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 15. Fuel Cards
CREATE TABLE fuel_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_number TEXT UNIQUE NOT NULL,
    provider TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 16. Fuel Transactions Raw
CREATE TABLE fuel_transactions_raw (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID REFERENCES fuel_cards(id),
    transaction_date TIMESTAMPTZ NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    liters DECIMAL(12,2),
    fuel_type TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 17. Bank Statements Raw
CREATE TABLE bank_statements_raw (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_name TEXT,
    statement_date TIMESTAMPTZ NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 18. Maintenance Regulations
CREATE TABLE maintenance_regulations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_type vehicle_type NOT NULL,
    title TEXT NOT NULL,
    interval_km INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 19. Maintenance Alerts
CREATE TABLE maintenance_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES assets(id),
    regulation_id UUID REFERENCES maintenance_regulations(id),
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 20. Service Orders
CREATE TABLE service_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES assets(id),
    mechanic_id UUID REFERENCES users(id),
    cost DECIMAL(12,2) DEFAULT 0,
    status TEXT DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 21. Tools & Parts (Inventory)
CREATE TABLE parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sku TEXT UNIQUE,
    quantity INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 22. Audit Log
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- INDEXES
CREATE INDEX idx_trips_driver ON trips(driver_id);
CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_trip_orders_trip ON trip_orders(trip_id);

-- TRIGGERS Placeholder (Pseudo-code for Supabase Function)
-- function create_wallet_for_user()
-- function sync_transaction_on_order()
