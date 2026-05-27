-- Права доступа для таблиц клиентских автомобилей
GRANT ALL ON TABLE client_vehicles                    TO service_role, authenticated, anon;
GRANT ALL ON TABLE client_vehicle_maintenance_rules   TO service_role, authenticated, anon;
GRANT ALL ON TABLE client_vehicle_recommendations     TO service_role, authenticated, anon;
