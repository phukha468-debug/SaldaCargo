-- =============================================================================
-- Migration: 20261122000004_tenant1_settings.sql
-- Purpose: Populate organizations.settings for Tenant #1 (ТК501) with its
--          domain-specific counterparty rules, Wialon GPS plates, and system
--          wallet/category IDs so the codebase stays tenant-agnostic.
--
-- ROLLBACK:
--   UPDATE organizations
--   SET settings = '{}'::jsonb,
--       updated_at = now()
--   WHERE id = '00000000-0000-4000-8000-000000000001';
-- =============================================================================

UPDATE organizations
SET
  settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
    'branding', jsonb_build_object(
      'short_name', 'ТК501',
      'timezone', 'Asia/Yekaterinburg'
    ),
    'finance', jsonb_build_object(
      'wallets', jsonb_build_object(
        'bank', '10000000-0000-0000-0000-000000000001',
        'cash', '10000000-0000-0000-0000-000000000002',
        'fuel_card', '10000000-0000-0000-0000-000000000004',
        'garage', '10000000-0000-0000-0000-000000000005',
        'fuel_cube', '10000000-0000-0000-0000-000000000006'
      ),
      'categories', jsonb_build_object(
        'trip_revenue', '74008cf7-0527-4e9f-afd2-d232b8f8125a',
        'payroll_driver', 'd79213ee-3bc6-4433-b58a-ca7ea1040d00',
        'payroll_loader', '18792fa8-fda8-472d-8e04-e19d2c6c053c',
        'fuel', '62cebf3f-9982-4cc6-904b-48c6169cf5e4',
        'other', 'df1022df-4ea6-46fc-b9aa-f3c9eb4e7f30',
        'cash_collect', '72f677d4-84af-4d0d-a845-a1b63c7ae607'
      ),
      'cube_fuel_price_per_liter', 60,
      'diesel_fuel_price_per_liter', 82,
      'default_safe_cash_base', 29000,
      'default_fuel_card_base', 926.13
    ),
    'counterparty_rules', jsonb_build_object(
      'internal_patterns', jsonb_build_array(
        '/^(?:тк\\s*501|тк\\s*510|тк501|тк510)/',
        '/^наша\\s*компания/',
        '/^собственные\\s*нужды/'
      ),
      'no_cash_patterns', jsonb_build_array(
        'геострой',
        'всмпо',
        '/(?:^|[\\s"«»''.,(])увс(?:$|[\\s"«»''.,)])/',
        'территори',
        '/эко[\\s-]?дело/',
        'теострой'
      ),
      'strict_doc_patterns', jsonb_build_array(
        'всмпо',
        'ависма',
        'геострой'
      ),
      'territory_patterns', jsonb_build_array(
        'территори'
      ),
      'geostroy_patterns', jsonb_build_array(
        'геострой'
      )
    ),
    'fleet_rules', jsonb_build_object(
      'wialon_gps_plates', jsonb_build_array('096', '188', '446', '883'),
      'directions', jsonb_build_array(
        'Верхняя Салда',
        'Нижний Тагил',
        'Екатеринбург',
        'Межгород'
      )
    )
  ),
  updated_at = now()
WHERE id = '00000000-0000-4000-8000-000000000001';
