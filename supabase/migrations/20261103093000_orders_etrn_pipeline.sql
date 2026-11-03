-- Migration: Pipeline for Orders, Counterparties requisites for ETrN/Waybills, Presets and Loading points
-- Date: 2026-11-03

-- 1. Counterparties extension (ETrN & TN requisites)
ALTER TABLE counterparties
  ADD COLUMN IF NOT EXISTS edo_participant_id text,
  ADD COLUMN IF NOT EXISTS gar_guid text,
  ADD COLUMN IF NOT EXISTS structured_address jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS default_contract_name text,
  ADD COLUMN IF NOT EXISTS default_contract_number text,
  ADD COLUMN IF NOT EXISTS default_contract_date date,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_person_fio text,
  ADD COLUMN IF NOT EXISTS contact_person_position text;

CREATE INDEX IF NOT EXISTS idx_counterparties_edo_id ON counterparties(edo_participant_id);
CREATE INDEX IF NOT EXISTS idx_counterparties_gar_guid ON counterparties(gar_guid);

-- 2. Loading points directory
CREATE TABLE IF NOT EXISTS loading_points_directory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  inn text,
  kpp text,
  ogrn text,
  gar_guid text,
  structured_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact_phone text,
  contact_fio text,
  contact_position text DEFAULT 'Представитель',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loading_points_inn ON loading_points_directory(inn);

-- 3. Order Presets (for 1-click order creation)
CREATE TABLE IF NOT EXISTS order_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  client_counterparty_id uuid REFERENCES counterparties(id) ON DELETE SET NULL,
  forwarder_counterparty_id uuid REFERENCES counterparties(id) ON DELETE SET NULL,
  default_loading_point_id uuid REFERENCES loading_points_directory(id) ON DELETE SET NULL,
  carrier_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  emchd_signer jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Vehicles (assets) and Driver documents / users extension
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS body_type_name text DEFAULT 'Грузовой автомобиль',
  ADD COLUMN IF NOT EXISTS brand_name text,
  ADD COLUMN IF NOT EXISTS payload_tons numeric(5,2) DEFAULT 3.10,
  ADD COLUMN IF NOT EXISTS capacity_m3 numeric(6,2) DEFAULT 40.00,
  ADD COLUMN IF NOT EXISTS ownership_type integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS garage_number text,
  ADD COLUMN IF NOT EXISTS fuel_type text DEFAULT 'ДТ',
  ADD COLUMN IF NOT EXISTS fuel_norm_liters integer DEFAULT 150;

-- Users (Drivers) license and INN columns
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS inn text,
  ADD COLUMN IF NOT EXISTS license_series text,
  ADD COLUMN IF NOT EXISTS license_number text,
  ADD COLUMN IF NOT EXISTS license_issue_date date,
  ADD COLUMN IF NOT EXISTS license_class text DEFAULT 'C',
  ADD COLUMN IF NOT EXISTS tab_number text;

-- 5. Orders table (Unified transportation order lifecycle)
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number serial,
  source_type text NOT NULL DEFAULT 'direct_ad', -- 'loginet' | 'ati' | 'direct_ad' | 'repeat'
  status text NOT NULL DEFAULT 'waiting_vehicle', -- 'draft' | 'waiting_vehicle' | 'assigned' | 'in_progress' | 'pending_review' | 'completed'

  -- Документ-основание (ОснДовОргСост / Поручение экспедитору)
  base_doc_name text DEFAULT 'Поручение экспедитору',
  base_doc_number text,
  base_doc_date date,
  internal_order_number text, -- НомЗак (напр. 693/2026)

  -- Участники перевозки
  shipper_id uuid REFERENCES counterparties(id) ON DELETE SET NULL,
  client_id uuid REFERENCES counterparties(id) ON DELETE SET NULL,
  consignee_id uuid REFERENCES counterparties(id) ON DELETE SET NULL,
  forwarder_id uuid REFERENCES counterparties(id) ON DELETE SET NULL,
  preset_id uuid REFERENCES order_presets(id) ON DELETE SET NULL,

  -- Сведения о лице на погрузке (СвЛицПогрГр / ВладИнфр)
  loading_point_id uuid REFERENCES loading_points_directory(id) ON DELETE SET NULL,
  loading_org_name text,
  loading_org_inn text,
  loading_org_kpp text,
  loading_contact_fio text,
  loading_contact_phone text,
  loading_contact_position text DEFAULT 'Представитель',

  -- Груз (СвГруз)
  cargo_name text NOT NULL DEFAULT 'Металлопрокат',
  cargo_condition text DEFAULT 'без повреждений',
  packaging_type text DEFAULT 'палетты',
  package_code text DEFAULT '00',
  places_count integer DEFAULT 1,
  weight_gross_kg numeric(10,2) DEFAULT 0,
  weight_net_kg numeric(10,2) DEFAULT 0,
  dimensions_text text,
  cargo_declared_value numeric(12,2) DEFAULT 0,

  -- Времена и адреса погрузки/выгрузки
  loading_address_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  unloading_address_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  planned_loading_at timestamptz,
  planned_delivery_at timestamptz,
  actual_loading_arrival_at timestamptz,
  actual_loading_departure_at timestamptz,

  -- Финансы и тарифы
  price_without_vat numeric(12,2) DEFAULT 0,
  vat_rate text DEFAULT 'без НДС',
  payment_terms text DEFAULT 'По факту доставки и оригиналов документов',

  -- Исполнение и привязка к автопарку
  assigned_vehicle_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  assigned_driver_id uuid REFERENCES users(id) ON DELETE SET NULL,
  active_trip_id uuid REFERENCES trips(id) ON DELETE SET NULL,
  waybill_number text,

  -- Сырые данные парсера PDF
  raw_parser_payload jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_vehicle ON orders(assigned_vehicle_id);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_driver ON orders(assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_active_trip ON orders(active_trip_id);

-- RLS policies
ALTER TABLE loading_points_directory ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "loading_points_all" ON loading_points_directory FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "order_presets_all" ON order_presets FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "orders_all" ON orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. SEED DATA (Вставка/обновление эталонных контрагентов, точек погрузки, пресета и ТС)
DO $$
DECLARE
  v_vsmpo_id uuid;
  v_parfenov_id uuid;
  v_loading_pt_id uuid;
  v_vehicle_id uuid;
  v_driver_id uuid;
BEGIN
  -- ВСМПО-АВИСМА
  SELECT id INTO v_vsmpo_id FROM counterparties WHERE inn = '6607000556' LIMIT 1;
  IF v_vsmpo_id IS NULL THEN
    INSERT INTO counterparties (
      name, inn, kpp, ogrn, edo_participant_id, gar_guid,
      structured_address, legal_address, actual_address, contact_phone, contact_person_fio, contact_person_position
    ) VALUES (
      'ПАО «Корпорация ВСМПО-АВИСМА»',
      '6607000556',
      '997550001',
      '1026600784011',
      '2BM-6607000556-2013011605491613718210000000000',
      '0ee97715-6406-4a23-958e-b98741ba48e0',
      '{"index":"624760","region_code":"66","district":"м.о. Верхнесалдинский","city":"Верхняя Салда","street":"ул. Парковая","house":"д 1"}'::jsonb,
      '624760, Свердловская область, г. Верхняя Салда, ул. Парковая, д 1',
      '624760, Свердловская область, г. Верхняя Салда, ул. Парковая, д 1',
      '+79667100167',
      'Добротина Наталья Павловна',
      'Сотрудник'
    ) RETURNING id INTO v_vsmpo_id;
  ELSE
    UPDATE counterparties SET
      edo_participant_id = '2BM-6607000556-2013011605491613718210000000000',
      gar_guid = '0ee97715-6406-4a23-958e-b98741ba48e0',
      structured_address = '{"index":"624760","region_code":"66","district":"м.о. Верхнесалдинский","city":"Верхняя Салда","street":"ул. Парковая","house":"д 1"}'::jsonb,
      contact_phone = COALESCE(contact_phone, '+79667100167'),
      contact_person_fio = COALESCE(contact_person_fio, 'Добротина Наталья Павловна'),
      contact_person_position = COALESCE(contact_person_position, 'Сотрудник')
    WHERE id = v_vsmpo_id;
  END IF;

  -- Экспедитор ИП Парфенов Андрей Виталиевич
  SELECT id INTO v_parfenov_id FROM counterparties WHERE inn = '660700184414' LIMIT 1;
  IF v_parfenov_id IS NULL THEN
    INSERT INTO counterparties (
      name, inn, ogrn, edo_participant_id, gar_guid,
      structured_address, legal_address, actual_address, contact_phone, contact_person_fio,
      default_contract_name, default_contract_number, default_contract_date
    ) VALUES (
      'ИП Парфенов Андрей Виталиевич',
      '660700184414',
      '304660726500044',
      '2BM-660700184414--2016060605481636716910000000',
      '9c1c997c-b3a6-4c89-ba65-c2b74b8f9440',
      '{"index":"624760","region_code":"66","district":"м.о. Верхнесалдинский","city":"Верхняя Салда","street":"ул. Молодежный поселок","house":"д 89а","flat":"кв 12"}'::jsonb,
      '624760, Свердловская область, г. Верхняя Салда, ул. Молодежный поселок, д 89а, кв 12',
      '624760, Свердловская область, г. Верхняя Салда, ул. Молодежный поселок, д 89а, кв 12',
      '+79630501501',
      'Парфенов Андрей Виталиевич',
      'договор',
      '10676',
      '2012-08-01'
    ) RETURNING id INTO v_parfenov_id;
  ELSE
    UPDATE counterparties SET
      edo_participant_id = '2BM-660700184414--2016060605481636716910000000',
      gar_guid = '9c1c997c-b3a6-4c89-ba65-c2b74b8f9440',
      structured_address = '{"index":"624760","region_code":"66","district":"м.о. Верхнесалдинский","city":"Верхняя Салда","street":"ул. Молодежный поселок","house":"д 89а","flat":"кв 12"}'::jsonb,
      contact_phone = COALESCE(contact_phone, '+79630501501'),
      contact_person_fio = COALESCE(contact_person_fio, 'Парфенов Андрей Виталиевич'),
      default_contract_name = 'договор',
      default_contract_number = '10676',
      default_contract_date = '2012-08-01'
    WHERE id = v_parfenov_id;
  END IF;

  -- Точка погрузки: ООО «Континенталь»
  SELECT id INTO v_loading_pt_id FROM loading_points_directory WHERE inn = '6609002301' LIMIT 1;
  IF v_loading_pt_id IS NULL THEN
    INSERT INTO loading_points_directory (
      name, inn, kpp, gar_guid, structured_address, contact_phone, contact_fio, contact_position
    ) VALUES (
      'ООО "Континенталь"',
      '6609002301',
      '668301001',
      '5a322dd7-4955-4b79-811b-b50fda680cb3',
      '{"index":"624250","region_code":"66","city":"Заречный","street":"ул. Промзона БЗСК","house":"строение 2"}'::jsonb,
      '+73432435353',
      'Гончарова Марина Владимировна',
      'Представитель'
    ) RETURNING id INTO v_loading_pt_id;
  END IF;

  -- Пресет: ВСМПО-АВИСМА через экспедитора ИП Парфенов А.В.
  IF NOT EXISTS (SELECT 1 FROM order_presets WHERE title = 'ВСМПО-АВИСМА через экспедитора ИП Парфенов А.В.') THEN
    INSERT INTO order_presets (
      title,
      client_counterparty_id,
      forwarder_counterparty_id,
      default_loading_point_id,
      carrier_settings,
      emchd_signer
    ) VALUES (
      'ВСМПО-АВИСМА через экспедитора ИП Парфенов А.В.',
      v_vsmpo_id,
      v_parfenov_id,
      v_loading_pt_id,
      '{
        "name": "ИП Нигамедьянов Александр Сергеевич",
        "inn": "660704814106",
        "ogrnip": "321665800053976",
        "edo_participant_id": "2BM-660704814106-20260506082129781701600000000",
        "phone": "+79222970911",
        "address": {
          "index": "624760",
          "region_code": "66",
          "district": "м.о. Верхнесалдинский",
          "city": "Верхняя Салда",
          "street": "25 октября",
          "house": "11",
          "flat": "22"
        }
      }'::jsonb,
      '{
        "fio": {
          "last_name": "Симанова",
          "first_name": "Олеся",
          "middle_name": "Витальевна"
        },
        "position": "Сотрудник",
        "status": "5",
        "storage_system_id": "https://m4d.nalog.gov.ru/emchd/check-status?guid=532497b2-e630-4925-b6dd-947e6d26534a",
        "power_of_attorney": {
          "number": "532497b2-e630-4925-b6dd-947e6d26534a",
          "date": "01.09.2026",
          "id": "532497b2-e630-4925-b6dd-947e6d26534a",
          "storage_url": "https://m4d.nalog.gov.ru/emchd/check-status?guid=532497b2-e630-4925-b6dd-947e6d26534a"
        }
      }'::jsonb
    );
  END IF;

  -- Обновление данных автомобиля Валдай (О188ТА196)
  UPDATE assets SET
    brand_name = 'Валдай',
    body_type_name = 'Грузовой автомобиль',
    payload_tons = 3.10,
    capacity_m3 = 40.00,
    fuel_type = 'ДТ',
    fuel_norm_liters = 150
  WHERE reg_number ILIKE '%О188ТА196%' OR reg_number ILIKE '%O188TA196%';

  -- Обновление данных водителя Никифоров Д.В.
  UPDATE users SET
    inn = '660704282934',
    license_series = '9945',
    license_number = '273350',
    license_issue_date = '2026-09-09',
    license_class = 'C',
    tab_number = '096'
  WHERE name ILIKE '%Никифоров%';

END $$;
