-- Добавляет атрибут client_role в counterparties:
-- 'owner' = Собственник (прямой клиент / грузовладелец)
-- 'forwarder' = Экспедитор (перекуп / диспетчер / логистическая компания)

ALTER TABLE counterparties
  ADD COLUMN IF NOT EXISTS client_role TEXT NOT NULL DEFAULT 'owner';

COMMENT ON COLUMN counterparties.client_role IS
  'owner = Собственник (прямой грузовладелец / прямой клиент); forwarder = Экспедитор (перекуп / диспетчер)';

CREATE INDEX IF NOT EXISTS idx_counterparties_client_role ON counterparties(client_role);
