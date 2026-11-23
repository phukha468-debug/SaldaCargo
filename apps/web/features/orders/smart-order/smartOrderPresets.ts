import type {
  ClientOrderPart,
  OrderCounterpartyOption,
  OrderPresetOption,
  RouteStop,
  SmartOrderFormState,
} from '../types';

export function buildClientPresetPatch(
  type: 'vsmpo' | 'geostroy' | 'manual',
  presets: OrderPresetOption[],
  counterparties: OrderCounterpartyOption[],
): {
  formPatch: Partial<SmartOrderFormState>;
  routes: RouteStop[];
  clientOrders?: ClientOrderPart[];
  statusMessage: string;
} {
  if (type === 'vsmpo') {
    const vsmpoPreset = presets.find((p) => p.title?.includes('ВСМПО')) || presets[0];
    return {
      clientOrders: [
        {
          id: '1',
          client_id: vsmpoPreset?.client_counterparty_id || '',
          client_name: 'ПАО «Корпорация ВСМПО-АВИСМА»',
          client_inn: '6607000556',
          base_doc_number: `794/${new Date().getFullYear()}`,
          cargo_name: 'Пруток 20мм, труба нерж.сталь',
          weight_gross_kg: 110,
          price_without_vat: 15000,
          forwarder_id: vsmpoPreset?.forwarder_counterparty_id || '',
          forwarder_name: 'ИП Парфенов Андрей Виталиевич',
          payment_method: 'bank_invoice',
          payment_terms: 'Безналичный расчет (Дебиторская задолженность, отсрочка 15 дней)',
        },
      ],
      formPatch: {
        preset_id: vsmpoPreset?.id || '',
        client_id: vsmpoPreset?.client_counterparty_id || '',
        client_name: 'ПАО «Корпорация ВСМПО-АВИСМА»',
        client_inn: '6607000556',
        forwarder_id: vsmpoPreset?.forwarder_counterparty_id || '',
        forwarder_name: 'ИП Парфенов Андрей Виталиевич',
        loading_org_name: 'ООО "Континенталь"',
        loading_address: '624250, Свердловская область, г. Заречный, ул. Промзона БЗСК, д 2',
        loading_city: 'Заречный',
        unloading_address: '624760, Свердловская область, г. Верхняя Салда, ул. Парковая, д 1',
        unloading_city: 'Верхняя Салда',
        cargo_name: 'Пруток 20мм, труба нерж.сталь',
        weight_gross_kg: 110,
        price_without_vat: 15000,
        payment_method: 'bank_invoice',
        payment_terms: 'Безналичный расчет (Дебиторская задолженность, отсрочка 15 дней)',
      },
      routes: [
        {
          id: '1',
          loading_city: 'Заречный',
          loading_address: '624250, Свердловская область, г. Заречный, ул. Промзона БЗСК, д 2',
          loading_org: 'ООО "Континенталь"',
          unloading_city: 'Верхняя Салда',
          unloading_address: '624760, Свердловская область, г. Верхняя Салда, ул. Парковая, д 1',
          unloading_org: 'ПАО «Корпорация ВСМПО-АВИСМА»',
          cargo_name: 'Пруток 20мм, труба нерж.сталь',
          weight_kg: 110,
        },
      ],
      statusMessage: '⭐ Шаблон: схема ВСМПО-АВИСМА через экспедитора ИП Парфенов А.В.',
    };
  }

  if (type === 'geostroy') {
    const geoCp = counterparties.find((c) => c.name?.includes('Геострой'));
    return {
      formPatch: {
        client_id: geoCp?.id || '',
        client_name: 'ООО "Геостройиндустрия"',
        client_inn: '6623101234',
        forwarder_id: '',
        forwarder_name: '— (Прямой заказчик)',
        loading_org_name: 'ООО "Геостройиндустрия" (ЛОП)',
        loading_address: 'Шайтанка',
        loading_city: 'Шайтанка',
        unloading_address: 'Маминское',
        unloading_city: 'Маминское',
        cargo_name: 'Пробы',
        weight_gross_kg: 4000,
        price_without_vat: 60000,
        payment_method: 'bank_invoice',
        payment_terms: 'Безналичный расчет (Дебиторская задолженность)',
      },
      routes: [
        {
          id: '1',
          loading_city: 'Шайтанка',
          loading_address: 'Шайтанка',
          loading_org: 'ООО "Геостройиндустрия" (ЛОП)',
          unloading_city: 'Маминское',
          unloading_address: 'Маминское',
          unloading_org: 'ООО "Геостройиндустрия"',
          cargo_name: 'Пробы',
          weight_kg: 4000,
        },
      ],
      statusMessage: '⭐ Шаблон: ООО "Геостройиндустрия" (прямой заказчик).',
    };
  }

  return {
    formPatch: {
      preset_id: '',
      client_id: '',
      client_name: '',
      client_inn: '',
      forwarder_id: '',
      forwarder_name: '— (Прямой заказчик)',
      loading_org_name: '',
      loading_address: '',
      loading_city: '',
      unloading_address: '',
      unloading_city: '',
      cargo_name: '',
      weight_gross_kg: '',
      price_without_vat: '',
      payment_method: 'bank_invoice',
      payment_terms: 'Безналичный расчет (Дебиторская задолженность)',
    },
    routes: [
      {
        id: '1',
        loading_city: '',
        loading_address: '',
        loading_org: '',
        unloading_city: '',
        unloading_address: '',
        unloading_org: '',
        cargo_name: '',
        weight_kg: 0,
      },
    ],
    statusMessage: '📝 Очищено: ручной ввод пустой заявки.',
  };
}
