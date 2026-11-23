-- =============================================================================
-- Migration: 20261123000002_tenant1_telematics_settings.sql
-- Purpose:   Перенос текущих параметров Автопилота Wialon Тенанта №1
--            в organizations.settings.telematics и assets (wialon_id, odometer_offset_km)
--            для полного отказа от хардкода в коде.
--
-- ROLLBACK PLAN:
--   UPDATE public.organizations
--   SET settings = settings - 'telematics',
--       updated_at = now()
--   WHERE id = '00000000-0000-4000-8000-000000000001';
--
--   UPDATE public.assets
--   SET odometer_offset_km = 0,
--       updated_at = now()
--   WHERE organization_id = '00000000-0000-4000-8000-000000000001';
-- =============================================================================

UPDATE public.organizations
SET
  settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
    'telematics', jsonb_build_object(
      'autopilot_enabled', true,
      'base_geofence', jsonb_build_object(
        'name', 'Верхняя Салда',
        'lat', 58.053,
        'lon', 60.552,
        'radius_m', 8000,
        'departure_hysteresis_m', 1500
      ),
      'thresholds', jsonb_build_object(
        'min_moving_speed_kmh', 10,
        'stop_max_speed_kmh', 5,
        'stop_cluster_radius_m', 250,
        'stop_min_duration_known_min', 15,
        'stop_min_duration_unknown_min', 25,
        'arrival_confirm_min', 5,
        'min_trip_distance_km', 10,
        'max_gps_age_min', 30,
        'noise_speed_spike_limit', 2
      ),
      'known_geofences', jsonb_build_array(
        jsonb_build_object(
          'id', 'shaytanka',
          'name', 'Шайтанка (Рудник)',
          'city', 'Шайтанка',
          'raw_address', 'Шайтанка',
          'lat', 58.0361,
          'lon', 60.9110,
          'radius_m', 10000,
          'role', 'loading'
        ),
        jsonb_build_object(
          'id', 'maminskoe',
          'name', 'с. Маминское (склад 2)',
          'city', 'Маминское',
          'raw_address', 'с. Маминское, склад 2',
          'lat', 56.4334,
          'lon', 61.4088,
          'radius_m', 20000,
          'role', 'unloading'
        ),
        jsonb_build_object(
          'id', 'rezh',
          'name', 'г. Реж',
          'city', 'Реж',
          'raw_address', 'г. Реж',
          'lat', 57.419,
          'lon', 61.4818,
          'radius_m', 15000,
          'role', 'any'
        ),
        jsonb_build_object(
          'id', 'karpinsk',
          'name', 'г. Карпинск',
          'city', 'Карпинск',
          'raw_address', 'г. Карпинск',
          'lat', 59.7681,
          'lon', 60.0235,
          'radius_m', 20000,
          'role', 'any'
        ),
        jsonb_build_object(
          'id', 'vorontsovka',
          'name', 'Воронцовка (Рудник)',
          'city', 'Воронцовка',
          'raw_address', 'пос. Воронцовка',
          'lat', 59.654,
          'lon', 60.231,
          'radius_m', 20000,
          'role', 'any'
        )
      ),
      'route_presets', jsonb_build_array(
        jsonb_build_object(
          'id', 'shaytanka_geostroy',
          'trigger_geofence_id', 'shaytanka',
          'client_id', '83db41b2-c050-4013-a878-bda2ab5c226e',
          'base_doc_name', 'Заявка ООО "Геостройиндустрия"',
          'cargo_name', 'Пробы керна (Шайтанка)',
          'price_without_vat', 40000,
          'default_loading_city', 'Шайтанка',
          'default_loading_raw', 'Шайтанка',
          'default_unloading_city', 'Маминское',
          'default_unloading_raw', 'с. Маминское, склад 2',
          'min_return_distance_km', 300,
          'fallback_distance_km', 600
        )
      ),
      'transit_rules', jsonb_build_object(
        'enabled', true,
        'east_departure_lon_threshold', 60.55,
        'west_exit_lon_threshold', 60.35,
        'max_transit_hours', 36
      ),
      'tariffs', jsonb_build_object(
        'fuel_rate_per_100km', 18,
        'driver_pay_per_km', 10,
        'driver_per_diem', 1000,
        'min_km_for_per_diem', 100
      )
    )
  ),
  updated_at = now()
WHERE id = '00000000-0000-4000-8000-000000000001';

-- Привязка Wialon Unit ID и калибровочных смещений одометра к ТС Тенанта №1
UPDATE public.assets
SET
  wialon_id = COALESCE(NULLIF(wialon_id, ''), '11873'),
  odometer_offset_km = CASE WHEN odometer_offset_km = 0 THEN 266504 ELSE odometer_offset_km END,
  updated_at = now()
WHERE organization_id = '00000000-0000-4000-8000-000000000001'
  AND reg_number LIKE '%096%';

UPDATE public.assets
SET
  wialon_id = COALESCE(NULLIF(wialon_id, ''), '11876'),
  odometer_offset_km = CASE WHEN odometer_offset_km = 0 THEN 434 ELSE odometer_offset_km END,
  updated_at = now()
WHERE organization_id = '00000000-0000-4000-8000-000000000001'
  AND reg_number LIKE '%188%';

UPDATE public.assets
SET
  wialon_id = COALESCE(NULLIF(wialon_id, ''), '11875'),
  odometer_offset_km = CASE WHEN odometer_offset_km = 0 THEN 184202 ELSE odometer_offset_km END,
  updated_at = now()
WHERE organization_id = '00000000-0000-4000-8000-000000000001'
  AND reg_number LIKE '%446%';

UPDATE public.assets
SET
  wialon_id = COALESCE(NULLIF(wialon_id, ''), '11874'),
  updated_at = now()
WHERE organization_id = '00000000-0000-4000-8000-000000000001'
  AND reg_number LIKE '%883%';
