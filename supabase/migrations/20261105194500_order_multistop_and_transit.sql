-- Миграция: поддержка составных/мульти-стоп маршрутов и промежуточных заездов в Верхнюю Салду
ALTER TABLE orders ADD COLUMN IF NOT EXISTS routes_json jsonb DEFAULT '[]'::jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS prevent_salda_auto_finish boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS salda_transit_count integer DEFAULT 0;

COMMENT ON COLUMN orders.routes_json IS 'Массив промежуточных точек маршрута (погрузки/разгрузки, адреса, ЛОП, получатели)';
COMMENT ON COLUMN orders.prevent_salda_auto_finish IS 'Флаг составного рейса: запрещает автоматическое закрытие заявки по Wialon при первом заезде в Верхнюю Салду';
COMMENT ON COLUMN orders.salda_transit_count IS 'Количество зафиксированных промежуточных транзитов через геозону Верхней Салды';
