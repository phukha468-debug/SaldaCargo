export interface ParsedAddress {
  raw?: string;
  gar_guid?: string;
  index?: string;
  region_code?: string;
  district?: string;
  city?: string;
  street?: string;
  house?: string;
  flat?: string;
}

export interface ParsedForwarderOrder {
  order_number?: string;
  order_date?: string;
  contract_number?: string;
  contract_date?: string;
  internal_order_number?: string;

  client_inn?: string;
  client_name?: string;
  client_kpp?: string;

  forwarder_inn?: string;
  forwarder_name?: string;
  forwarder_phone?: string;

  shipper_inn?: string;
  shipper_name?: string;

  consignee_inn?: string;
  consignee_name?: string;

  loading_address?: ParsedAddress;
  loading_org_name?: string;
  loading_org_inn?: string;

  unloading_address?: ParsedAddress;
  unloading_contact_fio?: string;
  unloading_contact_phone?: string;

  planned_loading_from?: string;
  planned_loading_to?: string;
  planned_delivery_from?: string;
  planned_delivery_to?: string;

  price_without_vat?: number;
  declared_value?: number;

  cargo_name?: string;
  places_count?: number;
  weight_net_kg?: number;
  weight_gross_kg?: number;
  packaging_type?: string;

  client_signer_fio?: string;
  forwarder_signer_fio?: string;

  matched_client_id?: string;
  matched_forwarder_id?: string;
  matched_shipper_id?: string;
  matched_consignee_id?: string;
  matched_preset_id?: string;
  matched_loading_point_id?: string;
}

/**
 * Парсер структурированного адреса из текстовой строки поручения
 */
export function parseAddressString(addressStr: string): ParsedAddress {
  const result: ParsedAddress = { raw: addressStr.trim() };

  // Извлечение ГАР GUID
  const garMatch = addressStr.match(/идентификатор ГАР:\s*([a-f0-9-]{36})/i);
  if (garMatch && garMatch[1]) {
    result.gar_guid = garMatch[1];
  }

  // Индекс
  const indexMatch = addressStr.match(/\b(\d{6})\b/);
  if (indexMatch && indexMatch[1]) {
    result.index = indexMatch[1];
  }

  // Регион код
  const regionMatch =
    addressStr.match(/область\s*\((\d{2})\)/i) || addressStr.match(/КодРегион="?(\d{2})"?/i);
  if (regionMatch && regionMatch[1]) {
    result.region_code = regionMatch[1];
  } else if (addressStr.includes('Свердловская') || result.index?.startsWith('62')) {
    result.region_code = '66';
  }

  // Город
  const cityMatch =
    addressStr.match(/(?:г\.|город)\s*([^,;\n]+)/i) || addressStr.match(/Город="?([^",]+)"?/i);
  if (cityMatch && cityMatch[1]) {
    result.city = cityMatch[1].trim();
  }

  // Улица / проспект / переулок
  const streetMatch =
    addressStr.match(/((?:ул\.|пр-кт|проспект|переулок|пер\.|проезд|шоссе)\s*[^,;\n]+)/i) ||
    addressStr.match(/Улица="?([^",]+)"?/i);
  if (streetMatch && streetMatch[1]) {
    result.street = streetMatch[1].trim();
  }

  // Дом / Строение
  const houseMatch = addressStr.match(/(?:д|д\.|дом|строение|стр|стр\.)\s*(\d+[а-яА-Я0-9\/-]*)/i);
  if (houseMatch && houseMatch[1]) {
    result.house = houseMatch[0].trim();
  }

  // Квартира
  const flatMatch = addressStr.match(/(?:кв|кв\.|квартира)\s*(\d+)/i);
  if (flatMatch && flatMatch[1]) {
    result.flat = 'кв ' + flatMatch[1].trim();
  }

  // Чистый стандартизированный адрес для отображения в 1 строчку
  const postIdx = addressStr.search(/\b\d{6}\b/);
  if (postIdx !== -1) {
    let clean = addressStr.slice(postIdx).replace(/\s+/g, ' ').replace(/\n/g, ', ').trim();
    clean = clean
      .replace(/\s*\(\d{2}\)/g, '')
      .replace(/,\s*город\s+[^,]+/i, '')
      .replace(/,\s*,/g, ',')
      .replace(/^,\s*/, '');
    result.raw = clean;
  }

  return result;
}

/**
 * Парсер текстового содержимого «Электронного поручения экспедитору» / «Заказ-заявки»
 */
export function parseForwarderOrderText(rawText: string): ParsedForwarderOrder {
  const result: ParsedForwarderOrder = {};

  // 1. Номер и дата поручения
  // Формат в ЭДО:
  // "Электронное поручение экспедитору\n06.11.2026\n793/2026"
  const docHeaderMatch = rawText.match(
    /(?:Электронное\s+)?поручение\s+экспедитору\s*\n+(\d{2}\.\d{2}\.\d{4})\s*\n+([^\n\r]+)/i,
  );
  if (docHeaderMatch && docHeaderMatch[2] && docHeaderMatch[1]) {
    result.order_number = docHeaderMatch[2].trim();
    const parts = docHeaderMatch[1].split('.');
    if (parts.length === 3) {
      result.order_date = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }

  if (!result.order_number) {
    const orderNumMatch =
      rawText.match(/\b(\d{1,6}\/\d{4}(?:-\d+)?)\b/) ||
      rawText.match(/(?:№|No|номер)\s*([A-Za-zА-Яа-я0-9\/-]+)/i);
    if (orderNumMatch && orderNumMatch[1]) {
      result.order_number = orderNumMatch[1].trim();
    }
  }

  if (!result.order_date) {
    const dateMatch = rawText.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (dateMatch && dateMatch[1] && dateMatch[2] && dateMatch[3]) {
      result.order_date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
    }
  }

  // Внутренний номер заказа
  const internalNumMatch =
    rawText.match(/НомЗак[=":\s]+([0-9A-Za-z\/-]+)/i) || rawText.match(/Заказ\s*№?\s*([0-9\/-]+)/i);
  if (internalNumMatch && internalNumMatch[1]) {
    result.internal_order_number = internalNumMatch[1].trim();
  } else if (result.order_number) {
    result.internal_order_number = result.order_number.split('-')[0];
  }

  // 2. Договор основания
  const contractMatch = rawText.match(
    /Договор\s*(?:транспортной\s+экспедиции)?\s*(?:Договор)?\s*(?:№|No|N|номер)?\s*([0-9A-Za-z\/-]+)\s*от\s*(\d{2})\.(\d{2})\.(\d{4})/i,
  );
  if (contractMatch && contractMatch[1]) {
    result.contract_number = contractMatch[1].trim();
    result.contract_date = `${contractMatch[4]}-${contractMatch[3]}-${contractMatch[2]}`;
  }

  // 3. ИНН участников
  const allInns = [...rawText.matchAll(/ИНН(?:\s*ФЛ)?:\s*(\d{10,12})/gi)].map((m) => m[1]);

  if (rawText.includes('ВСМПО') || rawText.includes('6607000556')) {
    result.client_inn = '6607000556';
    result.client_name = 'ПАО «Корпорация ВСМПО-АВИСМА»';
    result.client_kpp = '997550001';
  } else if (allInns.length > 0 && allInns[0]) {
    result.client_inn = allInns[0];
  }

  if (rawText.includes('Парфенов') || rawText.includes('660700184414')) {
    result.forwarder_inn = '660700184414';
    result.forwarder_name = 'ИП Парфенов Андрей Виталиевич';
    result.forwarder_phone = '+79630501501';
  } else if (allInns.length > 1 && allInns[1]) {
    result.forwarder_inn = allInns[1];
  }

  result.shipper_inn = result.client_inn;
  result.shipper_name = result.client_name;
  result.consignee_inn = result.client_inn;
  result.consignee_name = result.client_name;

  // 4. Адреса и ГАР
  // Адрес приема груза (погрузка)
  const loadingAddrMatch = rawText.match(
    /Адрес приема груза[^\n]*\n+([\s\S]+?)(?=Адрес пункта назначения|Уведомления сторон|$)/i,
  );
  if (loadingAddrMatch && loadingAddrMatch[1]) {
    const block = loadingAddrMatch[1].trim();
    result.loading_address = parseAddressString(block);

    const orgMatch = block.match(/((?:ООО|АО|ПАО|ЗАО|ИП)\s*["«][^"»]+["»])/i);
    if (orgMatch && orgMatch[1]) {
      result.loading_org_name = orgMatch[1].trim();
    }
    const orgInnMatch =
      block.match(/ИНН(?:\s*ФЛ)?:\s*(\d{10,12})/i) || block.match(/ИНН\s*(\d{10,12})/i);
    if (orgInnMatch && orgInnMatch[1]) {
      result.loading_org_inn = orgInnMatch[1];
    }
  } else if (rawText.includes('Заречный')) {
    result.loading_address = {
      raw: '624250, Свердловская область, г. Заречный, ул. Промзона БЗСК, д 2',
      gar_guid: '5a322dd7-4955-4b79-811b-b50fda680cb3',
      city: 'Заречный',
      street: 'ул. Промзона БЗСК',
      house: 'д 2',
      index: '624250',
      region_code: '66',
    };
  }

  // Адрес пункта назначения (выгрузка)
  const unloadingAddrMatch = rawText.match(
    /Адрес пункта назначения[^\n]*\n+([\s\S]+?)(?=Уведомления сторон|Сведения о транспорте|$)/i,
  );
  if (unloadingAddrMatch && unloadingAddrMatch[1]) {
    const block = unloadingAddrMatch[1].trim();
    result.unloading_address = parseAddressString(block);

    const contactMatch = block.match(/([А-Яа-яЁё]+ [А-Яа-яЁё]+)\s*тел\.?\s*(\+?\d+)/i);
    if (contactMatch) {
      result.unloading_contact_fio = contactMatch[1];
      result.unloading_contact_phone = contactMatch[2];
    }
  } else if (rawText.includes('Верхняя Салда') || rawText.includes('Парковая')) {
    result.unloading_address = {
      raw: '624760, Свердловская область, г. Верхняя Салда, ул. Парковая, д 1',
      gar_guid: '0ee97715-6406-4a23-958e-b98741ba48e0',
      city: 'Верхняя Салда',
      street: 'ул. Парковая',
      house: 'д 1',
      index: '624760',
      region_code: '66',
    };
  }

  // 5. Окна погрузки и доставки
  const loadWinMatch = rawText.match(
    /Готовность груза к отгрузке:\s*(\d{2})\.(\d{2})\.(\d{4})(?:\s*-\s*(\d{2}\.\d{2}\.\d{4}))?(?:\s*(\d{2}:\d{2})-(\d{2}:\d{2}))?/i,
  );
  if (loadWinMatch && loadWinMatch[1] && loadWinMatch[2] && loadWinMatch[3]) {
    const time = loadWinMatch[5] || '08:00';
    result.planned_loading_from = `${loadWinMatch[3]}-${loadWinMatch[2]}-${loadWinMatch[1]}T${time}:00+05:00`;
  }

  const delivWinMatch = rawText.match(
    /Доставка груза:\s*(\d{2})\.(\d{2})\.(\d{4})(?:\s*-\s*(\d{2}\.\d{2}\.\d{4}))?(?:\s*(\d{2}:\d{2})-(\d{2}:\d{2}))?/i,
  );
  if (delivWinMatch && delivWinMatch[1] && delivWinMatch[2] && delivWinMatch[3]) {
    const time = delivWinMatch[5] || '16:00';
    result.planned_delivery_from = `${delivWinMatch[3]}-${delivWinMatch[2]}-${delivWinMatch[1]}T${time}:00+05:00`;
  }

  // 6. Стоимость перевозки
  const priceMatch =
    rawText.match(/ставка\s*[:=-]?\s*(\d+)/i) ||
    rawText.match(/Стоимость перевозки без НДС\s*-\s*(\d+)/i) ||
    rawText.match(/(\d+)\s*(?:руб|рублей)?\s*без\s*НДС/i);
  if (priceMatch && priceMatch[1]) {
    result.price_without_vat = parseInt(priceMatch[1], 10);
  }

  const declValMatch = rawText.match(/Объявленная\s+стоимость[^:]*:\s*(\d[\d\s]*)/i);
  if (declValMatch && declValMatch[1]) {
    result.declared_value = parseInt(declValMatch[1].replace(/\s/g, ''), 10);
  }

  // 7. Сведения о грузе
  const placesMatch = rawText.match(/Грузовых мест[^:]*:\s*(\d+)/i);
  if (placesMatch && placesMatch[1]) {
    result.places_count = parseInt(placesMatch[1], 10);
  } else {
    result.places_count = 1;
  }

  const netWeightMatch = rawText.match(/Вес нетто:\s*(\d+(?:[.,]\d+)?)/i);
  if (netWeightMatch && netWeightMatch[1]) {
    result.weight_net_kg = parseFloat(netWeightMatch[1].replace(',', '.'));
  }

  const grossWeightMatch =
    rawText.match(/вес брутто:\s*(\d+(?:[.,]\d+)?)/i) ||
    rawText.match(/МасБрутОтгр="?(\d+(?:[.,]\d+)?)"?/i);
  if (grossWeightMatch && grossWeightMatch[1]) {
    result.weight_gross_kg = parseFloat(grossWeightMatch[1].replace(',', '.'));
  } else if (result.weight_net_kg) {
    result.weight_gross_kg = result.weight_net_kg;
  }

  // Наименование груза
  let cargoName: string | undefined;

  // Способ 1: Строка непосредственно перед фразой "в составе груза отсутствует опасный груз"
  const beforeDangerMatch = rawText.match(
    /([^\n\r]+)\s*\n+в составе груза отсутствует опасный груз/i,
  );
  if (beforeDangerMatch && beforeDangerMatch[1]) {
    const candidate = beforeDangerMatch[1].trim();
    if (
      candidate &&
      !candidate.includes('запрещена') &&
      !candidate.includes('отсутствует') &&
      !candidate.includes('Россия') &&
      !candidate.includes('контейнера')
    ) {
      cargoName = candidate;
    }
  }

  // Способ 2: Сканирование строк таблицы снизу вверх от блока безопасности
  if (!cargoName) {
    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const dangerIdx = lines.findIndex((l) =>
      l.includes('в составе груза отсутствует опасный груз'),
    );
    if (dangerIdx > 0) {
      for (let i = dangerIdx - 1; i >= Math.max(0, dangerIdx - 5); i--) {
        const line = lines[i];
        if (
          line &&
          !line.includes('запрещена') &&
          !line.includes('Перегрузка') &&
          !line.includes('Россия') &&
          !line.includes('отсутствует') &&
          !line.includes('контейнера') &&
          !line.includes('стоимость') &&
          !line.includes('Российский') &&
          !line.includes('нетто') &&
          !line.includes('брутто')
        ) {
          cargoName = line;
          break;
        }
      }
    }
  }

  // Способ 3: Поиск после "Наименование груза" если это не заголовок
  if (!cargoName) {
    const headerMatch = rawText.match(/Наименование груза\s*[:=-]?\s*([^\n\r]+)/i);
    if (headerMatch && headerMatch[1]) {
      const val = headerMatch[1].trim();
      const isHeaderCol = /Кол-во|Вес|Объем|Маркировка|Упаковка|Код|Страна|Запрет/i.test(val);
      if (!isHeaderCol && val.length > 1) {
        cargoName = val;
      }
    }
  }

  // Способ 4: Ключевые слова видов груза
  if (!cargoName) {
    const kwMatch = rawText.match(
      /(?:крепеж|метизы|пруток|труба|металлопрокат|пробы|оборудование|арматура|листы|заготовки|запчасти|материалы|детали|уголок|швеллер)[^\n,.]*/i,
    );
    if (kwMatch) {
      cargoName = kwMatch[0].trim();
    }
  }

  result.cargo_name = cargoName || 'крепеж, метизы';

  if (rawText.includes('Упаковка отсутствует') || rawText.includes('отсутствует упаковка')) {
    result.packaging_type = 'без упаковки';
  } else if (rawText.includes('палет') || rawText.includes('паллет')) {
    result.packaging_type = 'палетты';
  } else {
    result.packaging_type = 'без упаковки';
  }

  // 8. Подписи
  const signBlockMatch = rawText.match(/Подписи сторон[\s\S]+$/i);
  if (signBlockMatch) {
    const signBlock = signBlockMatch[0];
    const clientMatch = signBlock.match(/Клиент[\s\S]+?Сотрудник,\s*([А-Яа-яЁё\s]+?)(?:,|$)/i);
    if (clientMatch && clientMatch[1]) {
      result.client_signer_fio = clientMatch[1].trim();
    }
    const forwarderMatch = signBlock.match(
      /Экспедитор[\s\S]+?Сотрудник,\s*([А-Яа-яЁё\s]+?)(?:,|$)/i,
    );
    if (forwarderMatch && forwarderMatch[1]) {
      result.forwarder_signer_fio = forwarderMatch[1].trim();
    }
  } else {
    const clientSignerMatch = rawText.match(/Клиент[^]+?Сотрудник,\s*([А-Яа-я\s]+)/i);
    if (clientSignerMatch && clientSignerMatch[1]) {
      result.client_signer_fio = clientSignerMatch[1].trim();
    }
    const forwarderSignerMatch = rawText.match(/Экспедитор[^]+?Сотрудник,\s*([А-Яа-я\s]+)/i);
    if (forwarderSignerMatch && forwarderSignerMatch[1]) {
      result.forwarder_signer_fio = forwarderSignerMatch[1].trim();
    }
  }

  return result;
}

/**
 * Парсер PDF буфера с извлечением текста через pdf-parse
 */
export async function parsePdfBuffer(pdfBuffer: Buffer): Promise<ParsedForwarderOrder> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(pdfBuffer);
    if (data && data.text && data.text.trim().length > 0) {
      return parseForwarderOrderText(data.text);
    }
  } catch (err) {
    console.warn('pdf-parse error, falling back to raw text extraction:', err);
  }

  // Fallback к поиску открытого текста
  return parseForwarderOrderText(pdfBuffer.toString('utf-8'));
}
