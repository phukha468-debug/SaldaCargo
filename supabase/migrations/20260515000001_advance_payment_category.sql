-- Rollback: DELETE FROM transaction_categories WHERE code = 'ADVANCE_PAYMENT';

INSERT INTO transaction_categories (id, code, name, direction)
VALUES ('a0000000-0000-0000-0000-000000000001', 'ADVANCE_PAYMENT', 'Аванс сотруднику', 'expense');
