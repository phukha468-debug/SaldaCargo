-- ============================================================
-- Создание нарядов ВМ-0517, ВМ-0518, ВМ-0519
-- Запустить в Supabase SQL Editor
-- После запуска зайти как Администратор и утвердить наряды
-- Откат: DELETE FROM service_orders WHERE order_number IN (
--   SELECT order_number FROM service_orders
--   WHERE problem_description IN (
--     'Замена заднего моста, рессоры, сайлентблоков, тормозов',
--     'Диагностика и ремонт ABS/EBS, замена крестовины кардана',
--     'Ремонт кабельной трассы, проверка цепей'
--   ) AND lifecycle_status = 'draft'
-- );
-- ============================================================

DO $$
DECLARE
  v_admin_id      UUID;
  v_mechanic_id   UUID;
  v_asset_883     UUID;
  v_asset_188     UUID;
  v_order_0517    UUID;
  v_order_0518    UUID;
  v_order_0519    UUID;
  v_rate_client   NUMERIC := 2000;
  v_rate_own      NUMERIC := 1600;

  -- work_catalog ids
  w_gbo           UUID;
  w_axle_remove   UUID;
  w_axle_overhaul UUID;
  w_axle_weld     UUID;
  w_spring_stud   UUID;
  w_spring_sb     UUID;
  w_shock_bush    UUID;
  w_brake_bleed   UUID;
  w_abs_diag      UUID;
  w_abs_circuit   UUID;
  w_abs_remove    UUID;
  w_abs_install   UUID;
  w_ecu_reset     UUID;
  w_cardan_cross  UUID;
  w_wiring_part   UUID;
  w_circuit_check UUID;

  -- norm_minutes
  nm_gbo          INTEGER; nm_axle_remove INTEGER; nm_axle_overhaul INTEGER;
  nm_axle_weld    INTEGER; nm_spring_stud INTEGER; nm_spring_sb    INTEGER;
  nm_shock_bush   INTEGER; nm_brake_bleed INTEGER;
  nm_abs_diag     INTEGER; nm_abs_circuit INTEGER; nm_abs_remove   INTEGER;
  nm_abs_install  INTEGER; nm_ecu_reset   INTEGER; nm_cardan_cross INTEGER;
  nm_wiring_part  INTEGER; nm_circuit_check INTEGER;
  nm_v            INTEGER; -- valdai norm

  -- descriptions
  d_gbo TEXT; d_axle_remove TEXT; d_axle_overhaul TEXT;
  d_axle_weld TEXT; d_spring_stud TEXT; d_spring_sb TEXT;
  d_shock_bush TEXT; d_brake_bleed TEXT;
  d_abs_diag TEXT; d_abs_circuit TEXT; d_abs_remove TEXT;
  d_abs_install TEXT; d_ecu_reset TEXT; d_cardan_cross TEXT;
  d_wiring_part TEXT; d_circuit_check TEXT;
BEGIN

  -- ── Справочные данные ──────────────────────────────────────
  SELECT id INTO v_admin_id
  FROM users WHERE roles && ARRAY['admin','owner']::user_role[] LIMIT 1;

  SELECT id INTO v_mechanic_id
  FROM users WHERE roles && ARRAY['mechanic','mechanic_lead']::user_role[]
    AND is_active = true LIMIT 1;

  SELECT id INTO v_asset_883 FROM assets WHERE reg_number = 'У883АР96';
  SELECT id INTO v_asset_188 FROM assets WHERE reg_number = 'О188ТА196';

  -- ── Ставка нормачаса из sto_settings ───────────────────────
  SELECT COALESCE(hourly_rate, 2000), COALESCE(hourly_rate_own, 1600)
  INTO v_rate_client, v_rate_own
  FROM sto_settings LIMIT 1;

  -- ── Загружаем work_catalog ──────────────────────────────────
  SELECT id, norm_minutes, description INTO w_gbo, nm_gbo, d_gbo
    FROM work_catalog WHERE code = 'GBO_BALLOON_LP';
  SELECT id, norm_minutes, description INTO w_axle_remove, nm_axle_remove, d_axle_remove
    FROM work_catalog WHERE code = 'REAR_AXLE_REMOVE';
  SELECT id, norm_minutes, description INTO w_axle_overhaul, nm_axle_overhaul, d_axle_overhaul
    FROM work_catalog WHERE code = 'REAR_AXLE_OVERHAUL';
  SELECT id, norm_minutes, description INTO w_axle_weld, nm_axle_weld, d_axle_weld
    FROM work_catalog WHERE code = 'AXLE_WELD_PAINT';
  SELECT id, norm_minutes, description INTO w_spring_stud, nm_spring_stud, d_spring_stud
    FROM work_catalog WHERE code = 'SPRING_STUD_REMOVE';
  SELECT id, norm_minutes, description INTO w_spring_sb, nm_spring_sb, d_spring_sb
    FROM work_catalog WHERE code = 'SPRING_SILENTBLOCK_REPLACE';
  SELECT id, norm_minutes, description INTO w_shock_bush, nm_shock_bush, d_shock_bush
    FROM work_catalog WHERE code = 'SHOCK_ABSORBER_BUSH';
  SELECT id, norm_minutes, description INTO w_brake_bleed, nm_brake_bleed, d_brake_bleed
    FROM work_catalog WHERE code = 'BRAKE_BLEED';

  SELECT id, norm_minutes_valdai, description INTO w_abs_diag, nm_abs_diag, d_abs_diag
    FROM work_catalog WHERE code = 'ABS_EBS_DIAG';
  SELECT id, norm_minutes_valdai, description INTO w_abs_circuit, nm_abs_circuit, d_abs_circuit
    FROM work_catalog WHERE code = 'ABS_CIRCUIT_CHECK';
  SELECT id, norm_minutes_valdai, description INTO w_abs_remove, nm_abs_remove, d_abs_remove
    FROM work_catalog WHERE code = 'ABS_SENSOR_REMOVE';
  SELECT id, norm_minutes_valdai, description INTO w_abs_install, nm_abs_install, d_abs_install
    FROM work_catalog WHERE code = 'ABS_SENSOR_INSTALL_ADJ';
  SELECT id, norm_minutes_valdai, description INTO w_ecu_reset, nm_ecu_reset, d_ecu_reset
    FROM work_catalog WHERE code = 'ECU_RESET_TEST';
  SELECT id, norm_minutes_valdai, description INTO w_cardan_cross, nm_cardan_cross, d_cardan_cross
    FROM work_catalog WHERE code = 'CARDAN_CROSS_150';

  SELECT id, norm_minutes_valdai, description INTO w_wiring_part, nm_wiring_part, d_wiring_part
    FROM work_catalog WHERE code = 'WIRING_HARNESS_PARTIAL';
  SELECT id, norm_minutes_valdai, description INTO w_circuit_check, nm_circuit_check, d_circuit_check
    FROM work_catalog WHERE code = 'ELECTRIC_CIRCUIT_CHECK';

  -- ═══════════════════════════════════════════════════════════
  -- ВМ-0517 — Клиент Золотухин, ГАЗель 3302 (клиентская машина)
  -- ═══════════════════════════════════════════════════════════
  INSERT INTO service_orders (
    machine_type, client_vehicle_brand, client_vehicle_model,
    client_name, problem_description,
    assigned_mechanic_id, status, lifecycle_status, priority,
    created_by
  ) VALUES (
    'client', 'ГАЗ 3302', 'ГАЗель',
    'Золотухин', 'Замена заднего моста, рессоры, сайлентблоков, тормозов',
    v_mechanic_id, 'completed', 'draft', 'normal',
    v_admin_id
  ) RETURNING id INTO v_order_0517;

  -- Работы ВМ-0517 (клиентская, тариф v_rate_client)
  INSERT INTO service_order_works
    (service_order_id, work_catalog_id, norm_minutes, quantity, price_client, status, work_description)
  VALUES
    (v_order_0517, w_gbo,          nm_gbo,          1, ROUND(nm_gbo::numeric          /60*v_rate_client), 'completed', d_gbo),
    (v_order_0517, w_axle_remove,  nm_axle_remove,  1, ROUND(nm_axle_remove::numeric  /60*v_rate_client), 'completed', d_axle_remove),
    (v_order_0517, w_axle_overhaul,nm_axle_overhaul,2, ROUND(nm_axle_overhaul::numeric/60*v_rate_client*2),'completed',d_axle_overhaul),
    (v_order_0517, w_axle_weld,    nm_axle_weld,    1, ROUND(nm_axle_weld::numeric    /60*v_rate_client), 'completed', d_axle_weld),
    (v_order_0517, w_spring_stud,  nm_spring_stud,  1, ROUND(nm_spring_stud::numeric  /60*v_rate_client), 'completed', d_spring_stud),
    (v_order_0517, w_spring_sb,    nm_spring_sb,    2, ROUND(nm_spring_sb::numeric    /60*v_rate_client*2),'completed',d_spring_sb),
    (v_order_0517, w_shock_bush,   nm_shock_bush,   1, ROUND(nm_shock_bush::numeric   /60*v_rate_client), 'completed', d_shock_bush),
    (v_order_0517, w_brake_bleed,  nm_brake_bleed,  1, ROUND(nm_brake_bleed::numeric  /60*v_rate_client), 'completed', d_brake_bleed);

  RAISE NOTICE 'ВМ-0517 создан: %', v_order_0517;

  -- ═══════════════════════════════════════════════════════════
  -- ВМ-0518 — Свой У883АР96, ABS/EBS + крестовина кардана (Валдай)
  -- ═══════════════════════════════════════════════════════════
  INSERT INTO service_orders (
    machine_type, asset_id,
    problem_description,
    assigned_mechanic_id, status, lifecycle_status, priority,
    created_by
  ) VALUES (
    'own', v_asset_883,
    'Диагностика и ремонт ABS/EBS, замена крестовины кардана',
    v_mechanic_id, 'completed', 'draft', 'normal',
    v_admin_id
  ) RETURNING id INTO v_order_0518;

  -- Работы ВМ-0518 (свой Валдай, тариф v_rate_own, нормы valdai)
  INSERT INTO service_order_works
    (service_order_id, work_catalog_id, norm_minutes, quantity, price_client, status, work_description)
  VALUES
    (v_order_0518, w_abs_diag,    COALESCE(nm_abs_diag,60),     1, ROUND(COALESCE(nm_abs_diag,60)::numeric    /60*v_rate_own), 'completed', d_abs_diag),
    (v_order_0518, w_abs_circuit, COALESCE(nm_abs_circuit,48),  1, ROUND(COALESCE(nm_abs_circuit,48)::numeric /60*v_rate_own), 'completed', d_abs_circuit),
    (v_order_0518, w_abs_remove,  COALESCE(nm_abs_remove,24),   1, ROUND(COALESCE(nm_abs_remove,24)::numeric  /60*v_rate_own), 'completed', d_abs_remove),
    (v_order_0518, w_abs_install, COALESCE(nm_abs_install,48),  1, ROUND(COALESCE(nm_abs_install,48)::numeric /60*v_rate_own), 'completed', d_abs_install),
    (v_order_0518, w_ecu_reset,   COALESCE(nm_ecu_reset,30),    1, ROUND(COALESCE(nm_ecu_reset,30)::numeric   /60*v_rate_own), 'completed', d_ecu_reset),
    (v_order_0518, w_cardan_cross,COALESCE(nm_cardan_cross,150),1, ROUND(COALESCE(nm_cardan_cross,150)::numeric/60*v_rate_own),'completed', d_cardan_cross);

  RAISE NOTICE 'ВМ-0518 создан: %', v_order_0518;

  -- ═══════════════════════════════════════════════════════════
  -- ВМ-0519 — Свой О188ТА196, ремонт кабельной трассы (Валдай)
  -- ═══════════════════════════════════════════════════════════
  INSERT INTO service_orders (
    machine_type, asset_id,
    problem_description,
    assigned_mechanic_id, status, lifecycle_status, priority,
    created_by
  ) VALUES (
    'own', v_asset_188,
    'Ремонт кабельной трассы, проверка цепей',
    v_mechanic_id, 'completed', 'draft', 'normal',
    v_admin_id
  ) RETURNING id INTO v_order_0519;

  -- qty=3 для WIRING_HARNESS_PARTIAL (3 отрезка провода)
  INSERT INTO service_order_works
    (service_order_id, work_catalog_id, norm_minutes, quantity, price_client, status, work_description)
  VALUES
    (v_order_0519, w_wiring_part,  COALESCE(nm_wiring_part,40),   3,
       ROUND(COALESCE(nm_wiring_part,40)::numeric/60*v_rate_own*3), 'completed', d_wiring_part),
    (v_order_0519, w_circuit_check,COALESCE(nm_circuit_check,60), 1,
       ROUND(COALESCE(nm_circuit_check,60)::numeric/60*v_rate_own), 'completed', d_circuit_check);

  RAISE NOTICE 'ВМ-0519 создан: %', v_order_0519;

END $$;

-- ─── Проверка ────────────────────────────────────────────────
SELECT
  so.order_number,
  so.machine_type,
  COALESCE(a.reg_number, so.client_vehicle_brand || ' ' || so.client_name) AS machine,
  so.problem_description,
  so.status,
  so.lifecycle_status,
  COUNT(sow.id) AS works_count,
  SUM(sow.price_client) AS total_price
FROM service_orders so
LEFT JOIN assets a ON a.id = so.asset_id
LEFT JOIN service_order_works sow ON sow.service_order_id = so.id
WHERE so.lifecycle_status = 'draft'
  AND so.problem_description IN (
    'Замена заднего моста, рессоры, сайлентблоков, тормозов',
    'Диагностика и ремонт ABS/EBS, замена крестовины кардана',
    'Ремонт кабельной трассы, проверка цепей'
  )
GROUP BY so.id, a.reg_number
ORDER BY so.order_number;
