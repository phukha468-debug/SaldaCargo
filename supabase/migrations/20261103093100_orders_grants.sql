-- Grants for orders, presets and loading points
GRANT ALL ON TABLE orders TO service_role, authenticated, anon;
GRANT ALL ON TABLE order_presets TO service_role, authenticated, anon;
GRANT ALL ON TABLE loading_points_directory TO service_role, authenticated, anon;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role, authenticated, anon;
