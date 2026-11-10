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
  loading_contact_fio?: string;
  loading_contact_phone?: string;

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
  responsible_contact?: string;

  matched_client_id?: string;
  matched_forwarder_id?: string;
  matched_shipper_id?: string;
  matched_consignee_id?: string;
  matched_preset_id?: string;
  matched_loading_point_id?: string;
}

const MONTHS_MAP: Record<string, string> = {
  января: '01',
  февраля: '02',
  марта: '03',
  апреля: '04',
  мая: '05',
  июня: '06',
  июля: '07',
  августа: '08',
  сентября: '09',
  октября: '10',
  ноября: '11',
  декабря: '12',
};

/**
 * Парсер дат в русском текстовом формате («06» ноября 2026 г., 06.11.2026, 06.11.26)
 */
export function parseRussianDate(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;
  const trimmed = dateStr.trim();

  // Формат словесный: «06» ноября 2026 г. или 06 ноября 2026
  const textMatch = trimmed.match(/[«"]?(\d{1,2})[»"]?\s+([а-яёА-ЯЁ]+)\s+(\d{4})/i);
  if (textMatch && textMatch[1] && textMatch[2] && textMatch[3]) {
    const day = textMatch[1].padStart(2, '0');
    const monthName = textMatch[2].toLowerCase();
    const year = textMatch[3];
    if (MONTHS_MAP[monthName]) {
      return `${year}-${MONTHS_MAP[monthName]}-${day}`;
    }
  }

  // Формат числовой: 06.11.2026 или 06.11.26 или 06/11/2026
  const numMatch = trimmed.match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (numMatch && numMatch[1] && numMatch[2] && numMatch[3]) {
    const day = numMatch[1].padStart(2, '0');
    const month = numMatch[2].padStart(2, '0');
    let year = numMatch[3];
    if (year.length === 2) {
      year = '20' + year;
    }
    return `${year}-${month}-${day}`;
  }

  return undefined;
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
 * Универсальный парсер текстового содержимого:
 * - «Электронное поручение экспедитору» (ЭДО)
 * - Стандартная «Заявка на перевозку груза» / «Заказ-наряд» / PDF скан
 * - Любые сопутствующие формы транспортных заказов
 */
export function parseForwarderOrderText(rawText: string): ParsedForwarderOrder {
  const result: ParsedForwarderOrder = {};

  // 1. Договор основания (К ДОГОВОРУ № 10676 или Договор транспортной экспедиции Договор № 10676)
  const contractMatch =
    rawText.match(
      /(?:к\s+договору|договор(?:у)?(?:\s+транспортной\s+экспедиции)?)\s*(?:договор(?:у)?)?\s*(?:№|No|N|номер)\s*([0-9A-Za-zА-Яа-я\/-]+)(?:\s*от\s*([«"0-9][^\n\r,]+?(?:года|г\.|\d{2,4})))?/i,
    ) ||
    rawText.match(/(?:к\s+договору|договор(?:у)?)\s*(?:№|No|N|номер)?\s*([0-9A-Za-zА-Яа-я\/-]+)/i);

  if (contractMatch && contractMatch[1]) {
    const candidate = contractMatch[1].trim();
    if (!candidate.toLowerCase().startsWith('договор')) {
      result.contract_number = candidate;
      if (contractMatch[2]) {
        result.contract_date = parseRussianDate(contractMatch[2]);
      }
    }
  }

  // 2. Номер поручения / заявки
  // Способ А: Формат ЭДО: "Электронное поручение экспедитору \n 06.11.2026 \n 793/2026"
  const docHeaderMatch = rawText.match(
    /(?:Электронное\s+)?поручение\s+экспедитору\s*\n+(\d{2}\.\d{2}\.\d{4})\s*\n+([^\n\r]+)/i,
  );
  if (docHeaderMatch && docHeaderMatch[2] && docHeaderMatch[1]) {
    result.order_number = docHeaderMatch[2].replace(/\s*[\/\\]\s*/g, '/').trim();
    const p = parseRussianDate(docHeaderMatch[1]);
    if (p) result.order_date = p;
  }

  // Способ Б: Явный заголовок заявки / заказа (ЗАЯВКА № 801/ 2026, ЗАКАЗ-НАРЯД № ..., ПОРУЧЕНИЕ № ...)
  if (!result.order_number) {
    const explicitAppMatch = rawText.match(
      /(?:ЗАЯВКА|ДОГОВОР-ЗАЯВКА|ЗАКАЗ-НАРЯД|ТРАНСПОРТНЫЙ\s+ЗАКАЗ|ПОСТАНОВЛЕНИЕ|ПОРУЧЕНИЕ(?:\s+ЭКСПЕДИТОРУ)?)\s*(?:№|No|N|номер)\s*([0-9A-Za-zА-Яа-я]+(?:\s*[\/\\]\s*\d{2,4}(?:-\d+)?)?)/i,
    );
    if (explicitAppMatch && explicitAppMatch[1]) {
      result.order_number = explicitAppMatch[1].replace(/\s*[\/\\]\s*/g, '/').trim();
    }
  }

  // Способ В: Шаблон номера со слэшем вида 793/2026 или 801/ 2026
  if (!result.order_number) {
    const slashMatch = rawText.match(/\b(\d{1,6}\s*[\/\\]\s*\d{4}(?:-\d+)?)\b/);
    if (slashMatch && slashMatch[1]) {
      result.order_number = slashMatch[1].replace(/\s*[\/\\]\s*/g, '/').trim();
    }
  }

  // Способ Г: Общий поиск номера № / No / номер, исключая номер договора
  if (!result.order_number) {
    const generalNumMatch = rawText.match(/(?:№|No|номер)\s*([A-Za-zА-Яа-я0-9\/-]+)/i);
    if (generalNumMatch && generalNumMatch[1]) {
      const found = generalNumMatch[1].trim();
      if (!result.contract_number || found !== result.contract_number) {
        result.order_number = found;
      }
    }
  }

  if (result.order_number) {
    result.internal_order_number = result.order_number;
  }

  // Внутренний номер заказа при наличии
  const internalNumMatch =
    rawText.match(/НомЗак[=":\s]+([0-9A-Za-z\/-]+)/i) || rawText.match(/Заказ\s*№?\s*([0-9\/-]+)/i);
  if (internalNumMatch && internalNumMatch[1]) {
    result.internal_order_number = internalNumMatch[1].trim();
  }

  // 3. Дата заявки / документа
  if (!result.order_date) {
    // Дата непосредственно после номера заявки: "ЗАЯВКА № 801/ 2026 от «06» ноября 2026 г."
    const dateAfterOrderMatch = rawText.match(
      /(?:ЗАЯВКА|ПОРУЧЕНИЕ|ЗАКАЗ-НАРЯД|ДОГОВОР-ЗАЯВКА)[^\n\r]*?от\s*([«"0-9][^\n\r,]+?(?:года|г\.|\d{2,4}))/i,
    );
    if (dateAfterOrderMatch && dateAfterOrderMatch[1]) {
      result.order_date = parseRussianDate(dateAfterOrderMatch[1]);
    }
  }

  if (!result.order_date) {
    // Словесная дата в документе
    const textDateMatch = rawText.match(
      /[«"]?(\d{1,2})[»"]?\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+(\d{4})/i,
    );
    if (textDateMatch) {
      result.order_date = parseRussianDate(textDateMatch[0]);
    }
  }

  if (!result.order_date) {
    // Первая числовая дата до блоков погрузки
    const dateMatch = rawText.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (dateMatch && dateMatch[1] && dateMatch[2] && dateMatch[3]) {
      result.order_date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
    }
  }

  // 4. Стоимость перевозки без НДС
  const priceMatches = [
    // "Тариф (ставка):  10 000 рублей без НДС"
    rawText.match(
      /(?:тариф(?:\s*\([^)]*\))?|фрахтовая\s+ставка|фрахт|стоимость\s+перевозки|ставка)[^:\d\n]*?[:=-]\s*(\d[\d\s\u00A0]*\d|\d+)\s*(?:руб|рублей|р\b)?/i,
    ),
    // "10 000 рублей без НДС"
    rawText.match(/(\d[\d\s\u00A0]*\d|\d+)\s*(?:руб|рублей|р\b)?\s*без\s*НДС/i),
    // "Стоимость перевозки без НДС - 11000"
    rawText.match(/Стоимость перевозки без НДС\s*-\s*(\d[\d\s\u00A0]*\d|\d+)/i),
    // "Тариф: 10 000"
    rawText.match(/(?:тариф|ставка)\s*[:=-]?\s*(\d[\d\s\u00A0]*\d|\d+)/i),
  ];

  for (const m of priceMatches) {
    if (m && m[1]) {
      const cleanNum = m[1].replace(/[\s\u00A0]+/g, '');
      const num = parseInt(cleanNum, 10);
      if (!isNaN(num) && num >= 100) {
        result.price_without_vat = num;
        break;
      }
    }
  }

  const declValMatch = rawText.match(/Объявленная\s+стоимость[^:]*:\s*(\d[\d\s\u00A0]*)/i);
  if (declValMatch && declValMatch[1]) {
    result.declared_value = parseInt(declValMatch[1].replace(/[\s\u00A0]/g, ''), 10);
  }

  // 5. Наименование груза
  let cargoName: string | undefined;

  // Способ А: "Наименование (полное) груза: талрепы" или "Наименование груза: ..."
  const cargoMatch = rawText.match(/Наименование\s*(?:\([^)]*\)\s*)?груза\s*[:=-]?\s*([^\n\r]+)/i);
  if (cargoMatch && cargoMatch[1]) {
    const val = cargoMatch[1].trim();
    if (val && !/^(?:кол-во|вес|объем|код|марка|род|вид)/i.test(val)) {
      cargoName = val;
    }
  }

  // Способ Б: Позиция перед строкой "в составе груза отсутствует опасный груз" (ЭДО)
  if (!cargoName) {
    const beforeDangerMatch = rawText.match(
      /([^\n\r]+)\s*\n+в составе груза отсутствует опасный груз/i,
    );
    if (beforeDangerMatch && beforeDangerMatch[1]) {
      const candidate = beforeDangerMatch[1].trim();
      if (candidate && !/запрещена|отсутствует|Россия|контейнера/i.test(candidate)) {
        cargoName = candidate;
      }
    }
  }

  // Способ В: Сканирование строк таблицы снизу вверх от блока безопасности
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

  // Способ Г: Ключевые слова видов груза
  if (!cargoName) {
    const kwMatch = rawText.match(
      /(?:талреп[а-я]*|крепеж|метизы|пруток|труба|металлопрокат|пробы|оборудование|арматура|листы|заготовки|запчасти|материалы|детали|уголок|швеллер)[^\n,.]*/i,
    );
    if (kwMatch) {
      cargoName = kwMatch[0].trim();
    }
  }

  if (cargoName) {
    result.cargo_name = cargoName;
  }

  // 6. Масса и места
  const totalWeightMatch =
    rawText.match(/общий\s+вес\s*[:=-]?\s*(\d+(?:[.,]\d+)?)\s*кг/i) ||
    rawText.match(/вес\s*(?:груза)?(?:\s*\(кг\))?[^:\n]*[:=-]?\s*[^\n]*?(\d+(?:[.,]\d+)?)\s*кг/i) ||
    rawText.match(/вес\s+брутто\s*[:=-]?\s*(\d+(?:[.,]\d+)?)/i) ||
    rawText.match(/МасБрутОтгр="?(\d+(?:[.,]\d+)?)"?/i);
  if (totalWeightMatch && totalWeightMatch[1]) {
    result.weight_gross_kg = parseFloat(totalWeightMatch[1].replace(',', '.'));
  }

  const netWeightMatch = rawText.match(/Вес нетто:\s*(\d+(?:[.,]\d+)?)/i);
  if (netWeightMatch && netWeightMatch[1]) {
    result.weight_net_kg = parseFloat(netWeightMatch[1].replace(',', '.'));
  }

  const placesMatch =
    rawText.match(/(\d+)(?:-(\d+))?\s*(?:мест[а-я]*|кол-во\s+мест)/i) ||
    rawText.match(/Грузовых мест[^:]*:\s*(\d+)/i) ||
    rawText.match(/кол-во\s+мест[^:]*:\s*[^\n]*?(\d+)/i) ||
    rawText.match(/(\d+)\s*шт/i);
  if (placesMatch) {
    result.places_count = parseInt(placesMatch[2] || placesMatch[1] || '1', 10);
  } else {
    result.places_count = 1;
  }

  if (/коробк[а-я]*/i.test(rawText)) {
    result.packaging_type = 'коробки';
  } else if (/палет[а-я]*|паллет[а-я]*/i.test(rawText)) {
    result.packaging_type = 'палетты';
  } else if (/мешок|мешк[а-я]*/i.test(rawText)) {
    result.packaging_type = 'мешки';
  } else if (/ящик[а-я]*/i.test(rawText)) {
    result.packaging_type = 'ящики';
  } else {
    result.packaging_type = 'без упаковки';
  }

  // 7. ИНН и контрагенты
  const allInns = [...rawText.matchAll(/ИНН(?:\s*ФЛ)?:\s*(\d{10,12})/gi)].map((m) => m[1]);

  if (rawText.includes('ВСМПО') || rawText.includes('6607000556')) {
    result.client_inn = '6607000556';
    result.client_name = 'ПАО «Корпорация ВСМПО-АВИСМА»';
    result.client_kpp = '997550001';
  } else if (rawText.includes('Геострой') || rawText.includes('6623101234')) {
    result.client_inn = '6623101234';
    result.client_name = 'ООО "Геостройиндустрия"';
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

  // 8. Пункт погрузки (Откуда)
  if (rawText.includes('Адрес приема груза')) {
    // Формат ЭДО Поручения экспедитору
    const loadingAddrMatch = rawText.match(
      /Адрес приема груза[^\n]*\n+([\s\S]+?)(?=Адрес пункта назначения|Уведомления сторон|Готовность\s+груза|$)/i,
    );
    if (loadingAddrMatch && loadingAddrMatch[1]) {
      const block = loadingAddrMatch[1].trim();
      const orgMatch = block.match(/((?:ООО|АО|ПАО|ЗАО|ИП)\s*["«][^"»]+["»])/i);
      if (orgMatch && orgMatch[1]) {
        result.loading_org_name = orgMatch[1].trim();
      }
      const orgInnMatch =
        block.match(/ИНН(?:\s*ФЛ)?:\s*(\d{10,12})/i) || block.match(/ИНН\s*(\d{10,12})/i);
      if (orgInnMatch && orgInnMatch[1]) {
        result.loading_org_inn = orgInnMatch[1];
      }

      const firstLine = block.split(/\r?\n/)[0]?.trim() || block;
      result.loading_address = parseAddressString(firstLine);
    }
  } else {
    // Стандартная заявка на перевозку груза
    const loadSectionMatch = rawText.match(
      /(?:пункт\s+отправления|место\s+погрузки|адрес\s+приема\s+груза)(?:[^\n:]|\n)*?:\s*([\s\S]+?)(?=(?:пункт\s+назначения|базис\s+поставки|место\s+разгрузки|адрес\s+пункта\s+назначения|дата\s+и\s+время\s+подачи|готовность\s+груза|$))/i,
    );

    if (loadSectionMatch && loadSectionMatch[1]) {
      const rawBlock = loadSectionMatch[1].trim();
      const lines = rawBlock
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const firstLine = lines[0] || '';

      const orgMatch = rawBlock.match(/((?:ООО|АО|ПАО|ЗАО|ИП)\s*["«][^"»]+["»])/i);
      if (orgMatch && orgMatch[1]) {
        result.loading_org_name = orgMatch[1].trim();
      }

      const orgInnMatch =
        rawBlock.match(/ИНН(?:\s*ФЛ)?:\s*(\d{10,12})/i) || rawBlock.match(/ИНН\s*(\d{10,12})/i);
      if (orgInnMatch && orgInnMatch[1]) {
        result.loading_org_inn = orgInnMatch[1];
      }

      let city = 'Екатеринбург';
      const cityM = rawBlock.match(
        /(?:г\.|город)?\s*(Екатеринбург|Верхняя Салда|Нижний Тагил|Заречный|Березовский|Первоуральск|Ревда|Полевской|Тюмень|Челябинск|Курган|Пермь|Москва|Санкт-Петербург)/i,
      );
      if (cityM && cityM[1]) {
        city = cityM[1];
      }

      const contactFioMatch = rawBlock.match(
        /([А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+)(?:\s+Tel|\s+тел|\s+Mob|\s+моб|$)/i,
      );
      if (contactFioMatch && contactFioMatch[1]) {
        result.loading_contact_fio = contactFioMatch[1].trim();
      }

      const phones = [
        ...rawBlock.matchAll(/(?:\+7|8)[\s(-]?\d{3}[\s)-]?\s*\d{3}[\s-]?\d{2}[\s-]?\d{2}/g),
      ].map((m) => m[0]);
      if (phones.length > 0) {
        result.loading_contact_phone = phones.join(', ');
      }

      let cleanAddress = firstLine.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ');
      if (result.loading_org_name) {
        cleanAddress = cleanAddress
          .replace(result.loading_org_name, '')
          .replace(/^[,\s]+/, '')
          .trim();
      }
      result.loading_address = {
        raw: cleanAddress.toLowerCase().includes(city.toLowerCase())
          ? cleanAddress
          : `г. ${city}, ${cleanAddress}`,
        city: city,
        street: cleanAddress,
      };
    } else if (rawText.includes('Заречный')) {
      result.loading_address = {
        raw: '624250, Свердловская область, г. Заречный, ул. Промзона БЗСК, д 2',
        gar_guid: '5a322dd7-4955-4b79-811b-b50fda680cb3',
        city: 'Заречный',
        street: 'ул. Промзона БЗСК, д 2',
        index: '624250',
        region_code: '66',
      };
    }
  }

  // 9. Пункт выгрузки (Куда)
  if (rawText.includes('Адрес пункта назначения')) {
    // Формат ЭДО Поручения экспедитору
    const unloadingAddrMatch = rawText.match(
      /Адрес пункта назначения[^\n]*\n+([\s\S]+?)(?=Готовность\s+груза|Доставка\s+груза|Уведомления сторон|Сведения о транспорте|$)/i,
    );
    if (unloadingAddrMatch && unloadingAddrMatch[1]) {
      const block = unloadingAddrMatch[1].trim();
      const firstLine = block.split(/\r?\n/)[0]?.trim() || block;
      result.unloading_address = parseAddressString(firstLine);

      const contactMatch = block.match(/([А-Яа-яЁё]+ [А-Яа-яЁё]+)\s*тел\.?\s*(\+?\d+)/i);
      if (contactMatch && contactMatch[1] && contactMatch[2]) {
        result.unloading_contact_fio = contactMatch[1];
        result.unloading_contact_phone = contactMatch[2];
      }
    }
  } else {
    // Стандартная заявка на перевозку груза
    const unloadSectionMatch = rawText.match(
      /(?:пункт\s+назначения|базис\s+поставки|место\s+разгрузки|адрес\s+пункта\s+назначения)(?:[^\n:]|\n)*?:\s*([\s\S]+?)(?=(?:дата\s+и\s+время\s+подачи|дополнительная\s+информация|фрахтовая\s+ставка|ответственное\s+лицо|доставка\s+груза|$))/i,
    );

    if (unloadSectionMatch && unloadSectionMatch[1]) {
      const rawBlock = unloadSectionMatch[1].trim();

      let city = 'Верхняя Салда';
      if (rawBlock.includes('В-Салда') || rawBlock.includes('Верхняя Салда')) {
        city = 'Верхняя Салда';
      } else {
        const cityM = rawBlock.match(
          /(?:г\.|город)?\s*(Екатеринбург|Верхняя Салда|Нижний Тагил|Заречный|Березовский|Первоуральск|Тюмень|Челябинск|Москва)/i,
        );
        if (cityM && cityM[1]) city = cityM[1];
      }

      let street = 'ул. Парковая 1';
      const streetM = rawBlock.match(
        /((?:ул\.|улица)\s*[^,;\n]+(?:,\s*(?:склад|пл|цех)\s*[^,;\n]+)*)/i,
      );
      if (streetM && streetM[1]) {
        street = streetM[1].replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
      }

      result.unloading_address = {
        raw: `624760, Свердловская область, г. Верхняя Салда, ${street}`,
        city: city,
        street: street,
        gar_guid: '0ee97715-6406-4a23-958e-b98741ba48e0',
        region_code: '66',
      };
    } else if (
      rawText.includes('Верхняя Салда') ||
      rawText.includes('Парковая') ||
      rawText.includes('В-Салда')
    ) {
      result.unloading_address = {
        raw: '624760, Свердловская область, г. Верхняя Салда, ул. Парковая, д 1',
        gar_guid: '0ee97715-6406-4a23-958e-b98741ba48e0',
        city: 'Верхняя Салда',
        street: 'ул. Парковая, д 1',
        index: '624760',
        region_code: '66',
      };
    }
  }

  // 10. Даты погрузки и доставки
  const loadDateM =
    rawText.match(/(?:подачи[^:]*:\s*)(\d{1,2}[./]\d{1,2}[./]\d{2,4})/i) ||
    rawText.match(
      /Готовность груза к отгрузке:\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4})(?:[^\n]*?(\d{2}:\d{2}))?/i,
    );
  if (loadDateM && loadDateM[1]) {
    const parsed = parseRussianDate(loadDateM[1]);
    const time = loadDateM[2] || '08:00';
    if (parsed) {
      result.planned_loading_from = `${parsed}T${time}:00+05:00`;
    }
  }

  const delivDateM =
    rawText.match(/доставка\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4})(?:\s*до\s*(\d{1,2}))?/i) ||
    rawText.match(
      /Доставка груза:\s*(?:\d{1,2}[./]\d{1,2}[./]\d{2,4}-)?(\d{1,2}[./]\d{1,2}[./]\d{2,4})(?:[^\n]*?(\d{2}:\d{2}))?/i,
    );
  if (delivDateM && delivDateM[1]) {
    const parsed = parseRussianDate(delivDateM[1]);
    let time = '16:00';
    if (delivDateM[2]) {
      time = delivDateM[2].includes(':') ? delivDateM[2] : `${delivDateM[2].padStart(2, '0')}:00`;
    }
    if (parsed) {
      result.planned_delivery_from = `${parsed}T${time}:00+05:00`;
    }
  }

  // 11. Ответственное лицо
  const respMatch = rawText.match(/Ответственное\s+лицо[^:]*:\s*([^\n\r]+)/i);
  if (respMatch && respMatch[1]) {
    result.responsible_contact = respMatch[1].trim();
  }

  // 12. Подписи сторон
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
