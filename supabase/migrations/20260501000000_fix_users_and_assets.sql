-- 1. Добавляем уникальность госномера, чтобы сиды работали корректно
ALTER TABLE assets ADD CONSTRAINT assets_reg_number_key UNIQUE (reg_number);

-- 2. Обновляем роли пользователей, чтобы они появились в списке выбора
-- Присваиваем роли на основе имен (по тем данным, что я видел в базе)
UPDATE users SET roles = ARRAY['driver']::user_role[], is_active = true WHERE roles = '{}' OR roles IS NULL;
UPDATE users SET roles = ARRAY['admin']::user_role[] WHERE name LIKE '%игамедьянов%' OR name LIKE '%иахмаев%';
UPDATE users SET roles = ARRAY['mechanic']::user_role[] WHERE name IN ('Ваня', 'Вадик');

-- 3. Ослабляем RLS для справочников, чтобы их можно было читать до логина (для выбора себя)
DROP POLICY IF EXISTS "assets_read_all" ON assets;
CREATE POLICY "assets_read_all" ON assets FOR SELECT USING (true);

DROP POLICY IF EXISTS "users_read_all" ON users;
CREATE POLICY "users_read_all" ON users FOR SELECT USING (true);

DROP POLICY IF EXISTS "asset_types_read_all" ON asset_types;
CREATE POLICY "asset_types_read_all" ON asset_types FOR SELECT USING (true);
