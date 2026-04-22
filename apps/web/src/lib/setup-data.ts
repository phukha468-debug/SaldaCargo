// Предзаполненные данные SaldaCargo — известные факты бизнеса
// Поля с null = нужно ввести в Setup Wizard

export const LEGAL_ENTITY_PRESET = {
  name: 'ИП Нигамедьянов А.С.',
  type: 'IP' as const,
  inn: '', // заполняет admin
  tax_regime: 'PATENT',
}

export const ASSETS_PRESET = [
  // Валдаи
  { plate_number: '096', asset_type_code: 'VALDAI_6M', business_unit_code: 'LOGISTICS_TRUCK', status: 'active', year: null, odometer_current: null, residual_value: null, remaining_life_months: null, notes: 'Водитель: Сёма (2/2)' },
  { plate_number: '188', asset_type_code: 'VALDAI_6M', business_unit_code: 'LOGISTICS_TRUCK', status: 'active', year: null, odometer_current: null, residual_value: null, remaining_life_months: null, notes: 'Водитель: Слава' },
  { plate_number: '446', asset_type_code: 'VALDAI_DUMP', business_unit_code: 'LOGISTICS_TRUCK', status: 'active', year: null, odometer_current: null, residual_value: null, remaining_life_months: null, notes: 'Водитель: Вова' },
  { plate_number: '883', asset_type_code: 'VALDAI_5M', business_unit_code: 'LOGISTICS_TRUCK', status: 'active', year: null, odometer_current: null, residual_value: null, remaining_life_months: null, notes: 'Водитель: Женя' },
  // Кантер
  { plate_number: '661', asset_type_code: 'CANTER_5T', business_unit_code: 'LOGISTICS_5T', status: 'active', year: null, odometer_current: null, residual_value: null, remaining_life_months: null, notes: 'Водитель: Владелец (временно)' },
  // Газели межгород
  { plate_number: '009', asset_type_code: 'GAZELLE_4M', business_unit_code: 'LOGISTICS_LCV_INTERCITY', status: 'active', year: null, odometer_current: null, residual_value: null, remaining_life_months: null, notes: 'Водитель: Саша. Маршруты: Екб, Тагил' },
  { plate_number: '098', asset_type_code: 'GAZELLE_4M', business_unit_code: 'LOGISTICS_LCV_INTERCITY', status: 'active', year: null, odometer_current: null, residual_value: null, remaining_life_months: null, notes: 'Водитель: Лёха. Маршруты: Екб, Тагил' },
  { plate_number: '051', asset_type_code: 'GAZELLE_4M', business_unit_code: 'LOGISTICS_LCV_INTERCITY', status: 'active', year: null, odometer_current: null, residual_value: null, remaining_life_months: null, notes: 'Водитель: Денис. Маршруты: Екб, Тагил' },
  // Газели город (номера уточнить — временные)
  { plate_number: 'ГАЗ-Г1', asset_type_code: 'GAZELLE_3M', business_unit_code: 'LOGISTICS_LCV_CITY', status: 'active', year: 2007, odometer_current: null, residual_value: null, remaining_life_months: null, notes: 'Водитель: Вова (Газель). УТОЧНИТЬ НОМЕР' },
  { plate_number: 'ГАЗ-Г2', asset_type_code: 'GAZELLE_3M', business_unit_code: 'LOGISTICS_LCV_CITY', status: 'active', year: 2007, odometer_current: null, residual_value: null, remaining_life_months: null, notes: 'Водитель: Фарух. УТОЧНИТЬ НОМЕР' },
  { plate_number: 'ГАЗ-Г3', asset_type_code: 'GAZELLE_3M', business_unit_code: 'LOGISTICS_LCV_CITY', status: 'active', year: 2007, odometer_current: null, residual_value: null, remaining_life_months: null, notes: 'Водитель: Амир. УТОЧНИТЬ НОМЕР' },
  // Резерв
  { plate_number: '223', asset_type_code: 'GAZELLE_PROJECT', business_unit_code: 'LOGISTICS_LCV_CITY', status: 'reserve', year: null, odometer_current: null, residual_value: null, remaining_life_months: null, notes: 'Заморожен. Проект переделки в самосвал.' },
]

export const USERS_PRESET = [
  { full_name: 'Нигамедьянов А.С.', role: 'owner' as const, notes: 'Владелец. Временно водит Кантер 661.' },
  { full_name: 'Администратор', role: 'admin' as const, notes: '' },
  { full_name: 'Сёма', role: 'driver' as const, notes: 'Валдай 096, режим 2/2' },
  { full_name: 'Слава', role: 'driver' as const, notes: 'Валдай 188' },
  { full_name: 'Вова (Валдай)', role: 'driver' as const, notes: 'Валдай 446 (самосвал)' },
  { full_name: 'Женя', role: 'driver' as const, notes: 'Валдай 883, подменяет на 446' },
  { full_name: 'Саша', role: 'driver' as const, notes: 'Газель 009, межгород' },
  { full_name: 'Лёха', role: 'driver' as const, notes: 'Газель 098, межгород' },
  { full_name: 'Денис', role: 'driver' as const, notes: 'Газель 051, межгород' },
  { full_name: 'Вова (Газель)', role: 'driver' as const, notes: 'Город + грузчик на других машинах' },
  { full_name: 'Фарух', role: 'driver' as const, notes: 'Газель город, подмена' },
  { full_name: 'Амир', role: 'driver' as const, notes: 'Газель город, подмена' },
  { full_name: 'Серёга', role: 'loader' as const, notes: 'Постоянный грузчик (пара с Вовой на 866)' },
  { full_name: 'Ваня', role: 'mechanic' as const, notes: 'Лишён прав. Стратегический резерв.' },
  { full_name: 'Вадик', role: 'mechanic' as const, notes: 'Сдельно. Спец по КПП.' },
]

export const WALLETS_PRESET = [
  { code: 'ip_rs', name: 'Р/с ИП Нигамедьянов', type: 'bank_account' as const },
  { code: 'cash_office', name: 'Касса офиса (сейф)', type: 'cash_register' as const },
  { code: 'opti24_cards', name: 'Баланс топливных карт Опти24', type: 'fuel_card' as const },
  { code: 'ext_clients', name: 'Внешние клиенты (виртуальный)', type: 'external_virtual' as const },
  { code: 'ext_suppliers', name: 'Внешние поставщики (виртуальный)', type: 'external_virtual' as const },
]
