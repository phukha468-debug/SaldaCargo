-- AI-генерация заказ-нарядов: поддержка свободных запчастей и сохранение сметы
-- Rollback:
--   ALTER TABLE service_order_parts ALTER COLUMN part_id SET NOT NULL;
--   ALTER TABLE service_order_parts DROP COLUMN IF EXISTS custom_part_name;
--   ALTER TABLE service_order_parts DROP COLUMN IF EXISTS unit;
--   ALTER TABLE service_orders DROP COLUMN IF EXISTS ai_generated_text;

-- 1. Разрешаем service_order_parts без part_id (для ИИ-импорта с произвольными запчастями)
ALTER TABLE service_order_parts
  ALTER COLUMN part_id DROP NOT NULL;

-- 2. Добавляем поле для произвольного названия запчасти (когда part_id IS NULL)
ALTER TABLE service_order_parts
  ADD COLUMN IF NOT EXISTS custom_part_name TEXT;

-- 3. Единица измерения для свободных запчастей
ALTER TABLE service_order_parts
  ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'шт';

-- 4. Сохраняем оригинальную смету от LLM в наряде (для печати клиенту)
ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS ai_generated_text TEXT;

-- Проверка: либо part_id, либо custom_part_name должны быть заполнены
ALTER TABLE service_order_parts
  ADD CONSTRAINT chk_sop_part_source
    CHECK (part_id IS NOT NULL OR custom_part_name IS NOT NULL);
