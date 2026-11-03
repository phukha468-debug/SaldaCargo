import { randomUUID } from 'crypto';

export interface EtrnGeneratorInput {
  orderNumber: string;
  orderDate: string; // YYYY-MM-DD
  baseDocNumber?: string;
  baseDocDate?: string;
  internalOrderNumber?: string;

  // Участники
  carrier: {
    inn: string;
    ogrnip: string;
    fio: { lastName: string; firstName: string; middleName: string };
    edoId: string;
    phone: string;
    address: {
      index: string;
      regionCode: string;
      district?: string;
      city: string;
      street: string;
      house: string;
      flat?: string;
    };
  };

  client: {
    name: string;
    inn: string;
    kpp?: string;
    edoId?: string;
    phone?: string;
    address: {
      index: string;
      regionCode: string;
      district?: string;
      city: string;
      street: string;
      house: string;
    };
    contractName?: string;
    contractNumber?: string;
    contractDate?: string;
  };

  forwarder: {
    name: string;
    inn: string;
    edoId?: string;
    phone?: string;
  };

  consignee?: {
    name: string;
    inn: string;
    kpp?: string;
    phone?: string;
    address: {
      index: string;
      regionCode: string;
      district?: string;
      city: string;
      street: string;
      house: string;
    };
  };

  // Погрузка
  loadingPoint: {
    orgName: string;
    orgInn: string;
    orgKpp?: string;
    edoId?: string;
    phone?: string;
    contactFio?: string;
    contactPosition?: string;
    address: {
      index: string;
      regionCode: string;
      city: string;
      street: string;
      house: string;
    };
  };

  // Груз
  cargo: {
    name: string;
    condition?: string;
    packagingType?: string;
    packageCode?: string;
    placesCount: number;
    weightGrossKg: number;
  };

  // Водитель
  driver: {
    fio: { lastName: string; firstName: string; middleName?: string };
    inn?: string;
    phone?: string;
    licenseSeries?: string;
    licenseNumber?: string;
    licenseIssueDate?: string; // DD.MM.YYYY
  };

  // Автомобиль
  vehicle: {
    regNumber: string;
    brandName: string;
    bodyType?: string;
    payloadTons?: number;
    capacityM3?: number;
    ownershipType?: number;
  };

  // Даты/время
  times: {
    plannedLoading?: string; // ISO
    actualLoadingArrival?: string;
    actualLoadingDeparture?: string;
  };

  // Подписант и МЧД
  signer: {
    fio: { lastName: string; firstName: string; middleName?: string };
    position?: string;
    emchdNumber?: string;
    emchdDate?: string;
    emchdStorageUrl?: string;
  };
}

export interface EtrnGeneratorResult {
  fileName: string;
  fileId: string;
  xmlString: string;
  buffer: Buffer;
}

function formatDateRu(dateStr?: string): string {
  if (!dateStr) {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    return `${d}.${m}.${y}`;
  }
  if (dateStr.includes('.')) return dateStr;
  const datePart = dateStr.split('T')[0] || dateStr;
  const parts = datePart.split('-');
  return `${parts[2] || '01'}.${parts[1] || '01'}.${parts[0] || '2026'}`;
}

function formatIsoToRuTimestamp(isoStr?: string): string {
  const d = isoStr ? new Date(isoStr) : new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  const secs = String(d.getSeconds()).padStart(2, '0');
  return `${day}.${month}.${year}T${hours}:${mins}:${secs}+05:00`;
}

function escapeXml(unsafe: string = ''): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generateEtrnXml(data: EtrnGeneratorInput): EtrnGeneratorResult {
  const now = new Date();
  const todayRu = formatDateRu();
  const timeRu = now.toTimeString().split(' ')[0];

  const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, '');
  const guid = randomUUID();

  const carrierEdo = data.carrier.edoId || '2BM-660704814106-20260506082129781701600000000';
  const clientEdo = data.client.edoId || '2BM-6607000556-2013011605491613718210000000000';
  const loadingEdo = data.loadingPoint.edoId || '2BM-6609002301-2026101500000000000000000000000';
  const forwarderEdo = data.forwarder.edoId || '2BM-660700184414--2016060605481636716910000000';

  const fileId = `ON_TRNACLGROT_${carrierEdo}_${clientEdo}_${loadingEdo}_1_${yyyymmdd}_${guid}`;
  const fileName = `${fileId}.xml`;

  const baseDocDateRu = formatDateRu(data.baseDocDate || data.orderDate);
  const baseDocNum = data.baseDocNumber || data.orderNumber;
  const contractDateRu = formatDateRu(data.client.contractDate || '2012-08-01');
  const contractNum = data.client.contractNumber || '10676';
  const contractName = data.client.contractName || 'договор';
  const internalOrderNum = data.internalOrderNumber || data.orderNumber;

  const plannedLoadRu = formatIsoToRuTimestamp(data.times.plannedLoading);
  const actualArrivalRu = formatIsoToRuTimestamp(
    data.times.actualLoadingArrival || data.times.plannedLoading,
  );
  const actualDepartRu = formatIsoToRuTimestamp(data.times.actualLoadingDeparture);

  // Разбор ФИО лица на погрузке
  const loadFioParts = (data.loadingPoint.contactFio || 'Гончарова Марина Владимировна').split(' ');
  const loadLastName = loadFioParts[0] || 'Гончарова';
  const loadFirstName = loadFioParts[1] || 'Марина';
  const loadMiddleName = loadFioParts[2] || 'Владимировна';

  // Разбор ФИО водителя
  const driverLastName = data.driver.fio.lastName || 'Никифоров';
  const driverFirstName = data.driver.fio.firstName || 'Денис';
  const driverMiddleName = data.driver.fio.middleName || 'Викторович';

  // Разбор ФИО подписанта
  const signLastName = data.signer.fio.lastName || 'Симанова';
  const signFirstName = data.signer.fio.firstName || 'Олеся';
  const signMiddleName = data.signer.fio.middleName || 'Витальевна';

  const emchdNum = data.signer.emchdNumber || '532497b2-e630-4925-b6dd-947e6d26534a';
  const emchdDateRu = formatDateRu(data.signer.emchdDate || '2026-09-01');
  const emchdUrl =
    data.signer.emchdStorageUrl || `https://m4d.nalog.gov.ru/emchd/check-status?guid=${emchdNum}`;

  const xmlLines: string[] = [
    `<?xml version="1.0" encoding="utf-8"?>`,
    `<Файл ИдФайл="${fileId}" ВерсФорм="5.01" ВерсПрог="Diadoc 1.0">`,
    `  <ИдПолИной>${escapeXml(forwarderEdo)}</ИдПолИной>`,
    `  <ИдПолИной>${escapeXml(clientEdo)}</ИдПолИной>`,
    `  <Документ КНД="1110339" ПоФактХЖ="Транспортная накладная, информация грузоотправителя" ДатИнфГО="${todayRu}" ВрИнфГО="${timeRu}" НаимЭкСубСост="${escapeXml(data.forwarder.name)}, ИНН ${data.forwarder.inn}">`,
    `    <ОснДовОргСост НаимДок="Поручение экспедитору" НомерДок="${escapeXml(baseDocNum)}" ДатаДок="${baseDocDateRu}">`,
    `      <ИдРекСост>`,
    `        <ИННФЛ>${escapeXml(data.forwarder.inn)}</ИННФЛ>`,
    `      </ИдРекСост>`,
    `      <ИдРекСост>`,
    `        <ИННЮЛ>${escapeXml(data.client.inn)}</ИННЮЛ>`,
    `      </ИдРекСост>`,
    `    </ОснДовОргСост>`,
    `    <СодИнфГО СодОпер="Лицом, осуществляющим погрузку груза, при указанных обстоятельствах передан водителю груз с указанными характеристиками" НомерТрН="${escapeXml(baseDocNum)}" ДатаТрН="${baseDocDateRu}" НомЗак="${escapeXml(internalOrderNum)}" ДатаЗак="${baseDocDateRu}">`,
    `      <СвГО ГОЭксп="1">`,
    `        <РекИдентГО>`,
    `          <ИдСв>`,
    `            <СвЮЛУч НаимОрг="${escapeXml(data.client.name)}" ИННЮЛ="${escapeXml(data.client.inn)}" КПП="${escapeXml(data.client.kpp || '997550001')}" />`,
    `          </ИдСв>`,
    `          <Адрес>`,
    `            <АдрРФ Индекс="${data.client.address.index}" КодРегион="${data.client.address.regionCode}" Район="${escapeXml(data.client.address.district || 'м.о. Верхнесалдинский')}" Город="${escapeXml(data.client.address.city)}" Улица="${escapeXml(data.client.address.street)}" Дом="${escapeXml(data.client.address.house)}" />`,
    `          </Адрес>`,
    `          <Контакт>`,
    `            <Тлф>${escapeXml(data.client.phone || '+79667100167')}</Тлф>`,
    `          </Контакт>`,
    `        </РекИдентГО>`,
    `      </СвГО>`,
    `      <СвЗак>`,
    `        <РекИдентЗак>`,
    `          <ИдСв>`,
    `            <СвЮЛУч НаимОрг="${escapeXml(data.client.name)}" ИННЮЛ="${escapeXml(data.client.inn)}" КПП="${escapeXml(data.client.kpp || '997550001')}" />`,
    `          </ИдСв>`,
    `          <Адрес>`,
    `            <АдрРФ Индекс="${data.client.address.index}" КодРегион="${data.client.address.regionCode}" Район="${escapeXml(data.client.address.district || 'м.о. Верхнесалдинский')}" Город="${escapeXml(data.client.address.city)}" Улица="${escapeXml(data.client.address.street)}" Дом="${escapeXml(data.client.address.house)}" />`,
    `          </Адрес>`,
    `          <Контакт>`,
    `            <Тлф>${escapeXml(data.client.phone || '+79667100167')}</Тлф>`,
    `          </Контакт>`,
    `        </РекИдентЗак>`,
    `        <ДогУслПер НаимДок="${escapeXml(contractName)}" НомерДок="${escapeXml(contractNum)}" ДатаДок="${contractDateRu}">`,
    `          <ИдРекСост>`,
    `            <ИННФЛ>${escapeXml(data.forwarder.inn)}</ИННФЛ>`,
    `          </ИдРекСост>`,
    `          <ИдРекСост>`,
    `            <ИННЮЛ>${escapeXml(data.client.inn)}</ИННЮЛ>`,
    `          </ИдРекСост>`,
    `        </ДогУслПер>`,
    `      </СвЗак>`,
    `      <СвГП>`,
    `        <РекИдентГП>`,
    `          <ИдСв>`,
    `            <СвЮЛУч НаимОрг="${escapeXml(data.consignee?.name || data.client.name)}" ИННЮЛ="${escapeXml(data.consignee?.inn || data.client.inn)}" КПП="${escapeXml(data.consignee?.kpp || data.client.kpp || '997550001')}" />`,
    `          </ИдСв>`,
    `          <Адрес>`,
    `            <АдрРФ Индекс="${data.client.address.index}" КодРегион="${data.client.address.regionCode}" Район="${escapeXml(data.client.address.district || 'м.о. Верхнесалдинский')}" Город="${escapeXml(data.client.address.city)}" Улица="${escapeXml(data.client.address.street)}" Дом="${escapeXml(data.client.address.house)}" />`,
    `          </Адрес>`,
    `          <Контакт>`,
    `            <Тлф>${escapeXml(data.consignee?.phone || '6-44-26')}</Тлф>`,
    `          </Контакт>`,
    `        </РекИдентГП>`,
    `        <АдресДостГр>`,
    `          <АдресРФ Индекс="${data.client.address.index}" КодРегион="${data.client.address.regionCode}" Город="${escapeXml(data.client.address.city)}" Улица="Площадка Б" Дом="склад 0802" />`,
    `        </АдресДостГр>`,
    `      </СвГП>`,
    `      <СвГруз>`,
    `        <ОпГруз НаимГруз="${escapeXml(data.cargo.name)}" СостГруз="${escapeXml(data.cargo.condition || 'без повреждений')}" СпУпак="${escapeXml(data.cargo.packagingType || 'палетты')}" ВидТар="${escapeXml(data.cargo.packageCode || '00')}" КолМестГр="${data.cargo.placesCount}" УчГосСист="0">`,
    `          <Марк>отсутствует</Марк>`,
    `          <ПлМасГруз МасБрутЗнач="${data.cargo.weightGrossKg}" />`,
    `        </ОпГруз>`,
    `      </СвГруз>`,
    `      <УказГО УкНормПрвз="Отсутствует" ЗапрПерегруз="0">`,
    `        <СвПА СпосПерУкПА="Электронное уведомление перевозчика о переадресовке" ЛицоПА="Грузоотправитель">`,
    `          <КонтПА>`,
    `            <Тлф>${escapeXml(data.client.phone || '+79667100167')}</Тлф>`,
    `          </КонтПА>`,
    `        </СвПА>`,
    `      </УказГО>`,
    `      <СвПер>`,
    `        <ИдСв>`,
    `          <СвИП ИННФЛ="${data.carrier.inn}" ОГРНИП="${data.carrier.ogrnip}">`,
    `            <ФИО Фамилия="${escapeXml(data.carrier.fio.lastName)}" Имя="${escapeXml(data.carrier.fio.firstName)}" Отчество="${escapeXml(data.carrier.fio.middleName)}" />`,
    `          </СвИП>`,
    `        </ИдСв>`,
    `        <Адрес>`,
    `          <АдрРФ Индекс="${data.carrier.address.index}" КодРегион="${data.carrier.address.regionCode}" Район="${escapeXml(data.carrier.address.district || 'м.о. Верхнесалдинский')}" Город="${escapeXml(data.carrier.address.city)}" Улица="${escapeXml(data.carrier.address.street)}" Дом="${escapeXml(data.carrier.address.house)}" Кварт="${escapeXml(data.carrier.address.flat || '22')}" />`,
    `        </Адрес>`,
    `        <Контакт>`,
    `          <Тлф>${escapeXml(data.carrier.phone)}</Тлф>`,
    `        </Контакт>`,
    `      </СвПер>`,
    `      <СвВодит НомВУ="${escapeXml(data.driver.licenseNumber || '273350')}" СерВУ="${escapeXml(data.driver.licenseSeries || '9945')}" ДатаВыдВУ="${formatDateRu(data.driver.licenseIssueDate || '2026-09-09')}" ИННФЛ="${escapeXml(data.driver.inn || '660704282934')}">`,
    `        <Тлф>${escapeXml(data.driver.phone || '+79221672787')}</Тлф>`,
    `        <ФИО Фамилия="${escapeXml(driverLastName)}" Имя="${escapeXml(driverFirstName)}" Отчество="${escapeXml(driverMiddleName)}" />`,
    `      </СвВодит>`,
    `      <СвТС>`,
    `        <ТС РегНомер="${escapeXml(data.vehicle.regNumber)}" ТипВлад="${data.vehicle.ownershipType || 1}">`,
    `          <ПарТС Тип="${escapeXml(data.vehicle.bodyType || 'Грузовой автомобиль')}" Марка="${escapeXml(data.vehicle.brandName || 'Валдай')}" Грузопод="${data.vehicle.payloadTons || '3.1'}" Вместим="${data.vehicle.capacityM3 || '40'}" />`,
    `        </ТС>`,
    `      </СвТС>`,
    `      <СвПогруз ЗаявПогр="${plannedLoadRu}" НалКоорТочВрЗаяв="1" ФДатВрПриб="${actualArrivalRu}" НалКоорТочВрФПогр="1" ФДатВрУбыт="${actualDepartRu}" НалКоорТочВрФУбыт="1" МасБрутОтгр="${data.cargo.weightGrossKg}" МетОпрМасс="01" КолМестПрием="${data.cargo.placesCount}">`,
    `        <ФАдресПогр>`,
    `          <АдресРФ Индекс="${data.loadingPoint.address.index}" КодРегион="${data.loadingPoint.address.regionCode}" Город="${escapeXml(data.loadingPoint.address.city)}" Улица="${escapeXml(data.loadingPoint.address.street)}" Дом="${escapeXml(data.loadingPoint.address.house)}" />`,
    `        </ФАдресПогр>`,
    `        <СвЛицПогрГр СовпГОП="2">`,
    `          <РекЛицПогрГр>`,
    `            <ИдСв>`,
    `              <СвЮЛУч НаимОрг="${escapeXml(data.loadingPoint.orgName)}" ИННЮЛ="${escapeXml(data.loadingPoint.orgInn)}" КПП="${escapeXml(data.loadingPoint.orgKpp || '668301001')}" />`,
    `            </ИдСв>`,
    `            <Адрес>`,
    `              <АдрРФ Индекс="${data.loadingPoint.address.index}" КодРегион="${data.loadingPoint.address.regionCode}" Город="${escapeXml(data.loadingPoint.address.city)}" Улица="${escapeXml(data.loadingPoint.address.street)}" Дом="${escapeXml(data.loadingPoint.address.house)}" />`,
    `            </Адрес>`,
    `            <Контакт>`,
    `              <Тлф>${escapeXml(data.loadingPoint.phone || '+73432435353')}</Тлф>`,
    `            </Контакт>`,
    `          </РекЛицПогрГр>`,
    `          <ОснПогрГр НаимДок="Поручение экспедитору" НомерДок="${escapeXml(baseDocNum)}" ДатаДок="${baseDocDateRu}">`,
    `            <ИдРекСост>`,
    `              <ИННФЛ>${escapeXml(data.forwarder.inn)}</ИННФЛ>`,
    `            </ИдРекСост>`,
    `            <ИдРекСост>`,
    `              <ИННЮЛ>${escapeXml(data.client.inn)}</ИННЮЛ>`,
    `            </ИдРекСост>`,
    `          </ОснПогрГр>`,
    `          <РабЛицПогрГр Должность="${escapeXml(data.loadingPoint.contactPosition || 'Представитель')}">`,
    `            <ОДолжОб>Должностные обязанности</ОДолжОб>`,
    `            <ФИО Фамилия="${escapeXml(loadLastName)}" Имя="${escapeXml(loadFirstName)}" Отчество="${escapeXml(loadMiddleName)}" />`,
    `          </РабЛицПогрГр>`,
    `        </СвЛицПогрГр>`,
    `        <ВладИнфр СовпГОВ="2">`,
    `          <РекВладИнф>`,
    `            <ИдСв>`,
    `              <СвЮЛУч НаимОрг="${escapeXml(data.loadingPoint.orgName)}" ИННЮЛ="${escapeXml(data.loadingPoint.orgInn)}" КПП="${escapeXml(data.loadingPoint.orgKpp || '668301001')}" />`,
    `            </ИдСв>`,
    `            <Адрес>`,
    `              <АдрРФ Индекс="${data.loadingPoint.address.index}" КодРегион="${data.loadingPoint.address.regionCode}" Город="${escapeXml(data.loadingPoint.address.city)}" Улица="${escapeXml(data.loadingPoint.address.street)}" Дом="${escapeXml(data.loadingPoint.address.house)}" />`,
    `            </Адрес>`,
    `            <Контакт>`,
    `              <Тлф>${escapeXml(data.loadingPoint.phone || '+73432435353')}</Тлф>`,
    `            </Контакт>`,
    `          </РекВладИнф>`,
    `        </ВладИнфр>`,
    `      </СвПогруз>`,
    `    </СодИнфГО>`,
    `    <Подписант СтатПодп="5" Должн="${escapeXml(data.signer.position || 'Сотрудник')}" ИдСистХран="${escapeXml(emchdUrl)}">`,
    `      <ФИО Фамилия="${escapeXml(signLastName)}" Имя="${escapeXml(signFirstName)}" Отчество="${escapeXml(signMiddleName)}" />`,
    `      <СвДовер ДатаДовер="${emchdDateRu}" НомерДовер="${escapeXml(emchdNum)}" ИдентДовер="${escapeXml(emchdNum)}" СведСистОтм="${escapeXml(emchdUrl)}" />`,
    `    </Подписант>`,
    `  </Документ>`,
    `</Файл>`,
  ];

  const xmlString = xmlLines.join('\n');
  const buffer = Buffer.from(xmlString, 'utf-8');

  return {
    fileName,
    fileId,
    xmlString,
    buffer,
  };
}
