export interface TransportWaybillData {
  orderNumber: string;
  orderDate: string; // YYYY-MM-DD
  waybillNumber?: string;

  // 1. Грузоотправитель
  shipper: {
    name: string;
    inn: string;
    kpp?: string;
    address: string;
    phone?: string;
    isForwarder?: boolean;
  };

  // 1а. Заказчик
  client: {
    name: string;
    inn: string;
    address: string;
    contractName?: string;
    contractNumber?: string;
    contractDate?: string;
  };

  // 2. Грузополучатель
  consignee: {
    name: string;
    inn: string;
    address: string;
    deliveryAddress: string;
    phone?: string;
  };

  // 3. Груз
  cargo: {
    name: string;
    placesCount: number;
    packagingType?: string;
    weightGrossKg: number;
    weightNetKg?: number;
    dimensionsText?: string;
    declaredValue?: number;
  };

  // 6. Перевозчик
  carrier: {
    name: string;
    inn: string;
    ogrnip?: string;
    address: string;
    phone: string;
  };

  // Водитель
  driver: {
    fio: string;
    phone?: string;
    licenseSeries?: string;
    licenseNumber?: string;
  };

  // 7. Транспортное средство
  vehicle: {
    regNumber: string;
    brandName: string;
    bodyType?: string;
    payloadTons?: number;
    capacityM3?: number;
    ownershipType?: number; // 1 - собственность
  };

  // 8. Прием груза
  loading: {
    orgName: string;
    orgInn?: string;
    address: string;
    plannedAt?: string;
    actualArrivalAt?: string;
    actualDepartureAt?: string;
    contactFio?: string;
  };

  // 10. Выдача груза
  unloading: {
    address: string;
    plannedAt?: string;
    actualArrivalAt?: string;
    actualDepartureAt?: string;
    contactFio?: string;
  };

  // 12. Стоимость
  finance: {
    priceWithoutVat: number;
    vatRate?: string;
    totalPrice?: number;
  };
}

export function generateTransportWaybillHtml(data: TransportWaybillData): string {
  const contractInfo = `${data.client.contractName || 'Договор'} № ${data.client.contractNumber || '10676'} от ${data.client.contractDate || '01.08.2012'}`;
  const totalCost = data.finance.totalPrice || data.finance.priceWithoutVat;

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Транспортная накладная № ${data.orderNumber}</title>
  <style>
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page {
      size: A4 portrait;
      margin: 5mm 6mm 5mm 6mm;
    }
    body {
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      font-size: 7.5pt;
      line-height: 1.15;
      color: #000;
      background: #e2e8f0;
      margin: 0;
      padding: 15px 0;
    }
    .print-hide {
      max-width: 210mm;
      margin: 0 auto 12px auto;
      padding: 8px 16px;
      background: #0f172a;
      color: #fff;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .btn-print {
      background: #2563eb;
      color: #fff;
      border: none;
      padding: 7px 18px;
      font-weight: 600;
      font-size: 13px;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s ease;
    }
    .btn-print:hover {
      background: #1d4ed8;
    }
    .tn-page {
      width: 210mm;
      min-height: 287mm;
      margin: 0 auto 16px auto;
      background: #fff;
      padding: 5mm 6mm;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
      position: relative;
    }
    @media print {
      body {
        background: #fff !important;
        padding: 0 !important;
      }
      .print-hide {
        display: none !important;
      }
      .tn-page {
        width: 100% !important;
        min-height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
      }
      .page-break {
        page-break-before: always !important;
        break-before: page !important;
      }
    }
    .top-annex {
      text-align: right;
      font-size: 6.5pt;
      line-height: 1.15;
      margin-bottom: 2px;
      font-weight: normal;
    }
    table.tn-grid {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000;
      margin-bottom: 0;
    }
    table.tn-grid td, table.tn-grid th {
      border: 1px solid #000;
      padding: 1.5px 3px;
      vertical-align: top;
      font-size: 7.2pt;
      line-height: 1.15;
    }
    .sec-head {
      font-weight: bold;
      text-align: center;
      font-size: 7.5pt;
      padding: 1px 0;
      text-transform: uppercase;
    }
    .sec-head-left {
      font-weight: bold;
      text-align: left;
      font-size: 7.5pt;
      padding: 1px 0;
    }
    .sub {
      display: block;
      font-size: 5.5pt;
      line-height: 1.05;
      color: #000;
      text-align: center;
      margin-top: 1px;
    }
    .sub-left {
      display: block;
      font-size: 5.5pt;
      line-height: 1.05;
      color: #000;
      text-align: left;
      margin-top: 1px;
    }
    .val {
      font-size: 7.5pt;
      color: #000;
      min-height: 12px;
    }
    .val-bold {
      font-size: 7.5pt;
      font-weight: bold;
      color: #000;
      min-height: 12px;
    }
    .border-b {
      border-bottom: 1px solid #000;
    }
    .no-border {
      border: none !important;
    }
    .inner-table {
      width: 100%;
      border-collapse: collapse;
    }
    .inner-table td {
      border: none;
      padding: 0;
    }
  </style>
</head>
<body>

  <div class="print-hide">
    <div><strong>Транспортная накладная (Форма ПП РФ № 2116)</strong> | Заявка № ${data.orderNumber} от ${data.orderDate}</div>
    <button class="btn-print" onclick="window.print()">🖨️ Печать / Сохранить в PDF</button>
  </div>

  <!-- ================= СТРАНИЦА 1 ================= -->
  <div class="tn-page">
    <div class="top-annex">
      Приложение № 4 к Правилам перевозок грузов автомобильным транспортом<br>
      (в ред. Постановления Правительства РФ от 30.11.2021 № 2116)
    </div>

    <table class="tn-grid">
      <!-- Шапка документа -->
      <tr>
        <td style="width: 58%; padding: 0;">
          <table class="inner-table" style="width: 100%;">
            <tr>
              <td colspan="2" class="sec-head" style="border-bottom: 1px solid #000; padding: 2px 0;">
                ТРАНСПОРТНАЯ НАКЛАДНАЯ (ФОРМА)
              </td>
            </tr>
            <tr style="border-bottom: 1px solid #000;">
              <td style="width: 50%; border-right: 1px solid #000; padding: 1px 3px;">
                Дата &nbsp;<b>${data.orderDate}</b>
              </td>
              <td style="width: 50%; padding: 1px 3px;">
                N &nbsp;<b>${data.orderNumber}</b>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="padding: 1px 3px;">
                Экземпляр N &nbsp;<b>1</b>
              </td>
            </tr>
          </table>
        </td>
        <td style="width: 42%; padding: 0;">
          <table class="inner-table" style="width: 100%;">
            <tr>
              <td colspan="2" class="sec-head" style="border-bottom: 1px solid #000; padding: 2px 0;">
                Заказ (заявка)
              </td>
            </tr>
            <tr>
              <td style="width: 50%; border-right: 1px solid #000; padding: 1px 3px;">
                Дата &nbsp;<b>${data.orderDate}</b>
              </td>
              <td style="width: 50%; padding: 1px 3px;">
                N &nbsp;<b>${data.orderNumber}</b>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Раздел 1 и 1а -->
      <tr>
        <td style="width: 58%;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <span style="font-weight: bold;">1. Грузоотправитель</span>
            <span class="val-bold">${data.shipper.name}</span>
          </div>
          <div>является экспедитором &nbsp; [${data.shipper.isForwarder ? 'X' : '&nbsp;&nbsp;'}]</div>
          <div class="sub">(реквизиты, позволяющие идентифицировать Грузоотправителя)</div>
        </td>
        <td style="width: 42%;">
          <div style="font-weight: bold;">1а. Заказчик услуг по организации перевозки груза (при наличии)</div>
          <div class="val-bold" style="text-align: center;">${data.client.name}</div>
          <div class="sub">(реквизиты, позволяющие идентифицировать Заказчика услуг по организации перевозки груза)</div>
        </td>
      </tr>

      <!-- Основания расчетов / Договор -->
      <tr>
        <td>
          <div class="val" style="min-height: 10px;"></div>
          <div class="sub">(реквизиты документа, определяющего основания осуществления расчетов по договору перевозки иным лицом, отличным от грузоотправителя (при наличии))</div>
        </td>
        <td>
          <div class="val" style="text-align: center;">${contractInfo}</div>
          <div class="sub">(реквизиты договора на выполнение услуг по организации перевозки груза)</div>
        </td>
      </tr>

      <!-- Раздел 2. Грузополучатель -->
      <tr>
        <td colspan="2" class="sec-head-left" style="background: #fafafa;">2. Грузополучатель</td>
      </tr>
      <tr>
        <td colspan="2">
          <div class="val-bold" style="text-align: center;">${data.consignee.name}, ИНН ${data.consignee.inn}${data.consignee.phone ? ', тел: ' + data.consignee.phone : ''}</div>
          <div class="sub">(реквизиты, позволяющие идентифицировать Грузополучателя)</div>
          <div class="val-bold" style="text-align: center; margin-top: 2px;">${data.consignee.deliveryAddress}</div>
          <div class="sub">(адрес места доставки груза)</div>
        </td>
      </tr>

      <!-- Раздел 3. Груз -->
      <tr>
        <td colspan="2" class="sec-head" style="background: #fafafa;">3. Груз</td>
      </tr>
      <tr>
        <td style="width: 58%;">
          <div class="val-bold" style="text-align: center;">${data.cargo.name}</div>
          <div class="sub">(отгрузочное наименование груза (для опасных грузов - в соответствии с ДОПОГ), его состояние и другая необходимая информация о грузе)</div>
        </td>
        <td style="width: 42%;">
          <div class="val-bold" style="text-align: center;">${data.cargo.placesCount} ${data.cargo.packagingType || 'место'}</div>
          <div class="sub">(количество грузовых мест, маркировка, вид тары и способ упаковки)</div>
        </td>
      </tr>
      <tr>
        <td colspan="2">
          <div class="val-bold" style="text-align: center;">${data.cargo.weightGrossKg} кг &nbsp; ${data.cargo.dimensionsText ? data.cargo.dimensionsText : ''}</div>
          <div class="sub">(масса груза брутто в килограммах, масса груза нетто в килограммах (при возможности ее определения), размеры (высота, ширина, длина) в метрах (при перевозке крупногабаритного груза), объем груза в кубических метрах и плотность груза в соответствии с документацией на груз (при необходимости), дополнительные характеристики груза, учитывающие отраслевые особенности (при необходимости))</div>
        </td>
      </tr>
      <tr>
        <td>
          <div class="val" style="min-height: 8px;"></div>
          <div class="sub">(в случае перевозки опасного груза - информация по каждому опасному веществу, материалу или изделию в соответствии с пунктом 5.4.1 ДОПОГ)</div>
        </td>
        <td>
          <div class="val" style="text-align: center;">${data.cargo.declaredValue ? data.cargo.declaredValue.toLocaleString('ru-RU') + ' руб.' : ''}</div>
          <div class="sub">(объявленная стоимость (ценность) груза (при необходимости))</div>
        </td>
      </tr>

      <!-- Раздел 4. Сопроводительные документы -->
      <tr>
        <td colspan="2" class="sec-head-left" style="background: #fafafa;">4. Сопроводительные документы на груз (при наличии)</td>
      </tr>
      <tr>
        <td colspan="2">
          <div class="val" style="min-height: 6px;"></div>
          <div class="sub">(перечень прилагаемых к транспортной накладной документов, предусмотренных ДОПОГ, санитарными, таможенными (при наличии), карантинными, иными правилами в соответствии с законодательством Российской Федерации, либо регистрационные номера указанных документов, если такие документы (сведения о таких документах) содержатся в государственных информационных системах)</div>
          <div class="val" style="min-height: 6px; text-align: center;">Паспорт качества / Сертификат соответствия</div>
          <div class="sub">(перечень прилагаемых к грузу сертификатов, паспортов качества, удостоверений и других документов, наличие которых установлено законодательством Российской Федерации, либо регистрационные номера указанных документов, если такие документы (сведения о таких документах) содержатся в государственных информационных системах)</div>
          <div class="val" style="min-height: 6px; text-align: center;">Поручение экспедитору № ${data.orderNumber} от ${data.orderDate}</div>
          <div class="sub">(реквизиты, позволяющие идентифицировать документ(-ы), подтверждающий(-ие) отгрузку товаров (при наличии), реквизиты сопроводительной ведомости (при перевозке груженых контейнеров или порожних контейнеров))</div>
        </td>
      </tr>

      <!-- Раздел 5. Указания грузоотправителя -->
      <tr>
        <td colspan="2" class="sec-head-left" style="background: #fafafa;">5. Указания грузоотправителя по особым условиям перевозки</td>
      </tr>
      <tr>
        <td>
          <div class="val" style="min-height: 8px;">Соблюдение правил транспортировки и крепления груза</div>
          <div class="sub">(маршрут перевозки, дата и время/сроки доставки груза (при необходимости))</div>
        </td>
        <td>
          <div class="val" style="min-height: 8px; text-align: center;">${data.loading.contactFio || ''}</div>
          <div class="sub">(контактная информация о лицах, по указанию которых может осуществляться переадресовка)</div>
        </td>
      </tr>
      <tr>
        <td>
          <div class="val" style="min-height: 8px;"></div>
          <div class="sub">(указания, необходимые для выполнения фитосанитарных, санитарных, карантинных, таможенных и прочих требований, установленных законодательством Российской Федерации)</div>
        </td>
        <td>
          <div class="val" style="min-height: 8px; text-align: center;">Запрещение перегрузки груза</div>
          <div class="sub">(температурный режим перевозки груза (при необходимости), сведения о запорно-пломбировочных устройствах (в случае их предоставления грузоотправителем), запрещение перегрузки груза)</div>
        </td>
      </tr>

      <!-- Раздел 6. Перевозчик -->
      <tr>
        <td colspan="2" class="sec-head" style="background: #fafafa;">6. Перевозчик</td>
      </tr>
      <tr>
        <td>
          <div class="val-bold">${data.carrier.name}</div>
          <div class="val">ИНН ${data.carrier.inn}${data.carrier.ogrnip ? ', ОГРНИП ' + data.carrier.ogrnip : ''}${data.carrier.phone ? ', тел: ' + data.carrier.phone : ''}</div>
          <div class="sub">(реквизиты, позволяющие идентифицировать Перевозчика)</div>
        </td>
        <td>
          <div class="val-bold" style="text-align: center; text-transform: uppercase;">${data.driver.fio}</div>
          <div class="val" style="text-align: center;">${data.driver.phone ? 'тел: ' + data.driver.phone : ''}${data.driver.licenseSeries ? ' (ВУ: ' + data.driver.licenseSeries + ' ' + (data.driver.licenseNumber || '') + ')' : ''}</div>
          <div class="sub">(реквизиты, позволяющие идентифицировать водителя(ей))</div>
        </td>
      </tr>

      <!-- Раздел 7. Транспортное средство -->
      <tr>
        <td colspan="2" class="sec-head" style="background: #fafafa;">7. Транспортное средство</td>
      </tr>
      <tr>
        <td>
          <div class="val-bold">${data.vehicle.bodyType || 'Грузовой автомобиль'}, ${data.vehicle.brandName || 'Валдай'}${data.vehicle.payloadTons ? ', ' + data.vehicle.payloadTons + ' т' : ''}${data.vehicle.capacityM3 ? ', ' + data.vehicle.capacityM3 + ' м3' : ''}</div>
          <div class="sub">(тип, марка, грузоподъемность (в тоннах), вместимость (в кубических метрах))</div>
        </td>
        <td>
          <div class="val-bold" style="text-align: center; font-size: 8.5pt;">${data.vehicle.regNumber}</div>
          <div class="sub">(регистрационный номер транспортного средства)</div>
        </td>
      </tr>
      <tr>
        <td colspan="2" style="font-size: 6.8pt; padding: 1px 3px;">
          Тип владения: 1 - собственность; 2 - совместная собственность супругов; 3 - аренда; 4 - лизинг; 5 - безвозмездное пользование &nbsp; <b>[ ${data.vehicle.ownershipType || 1} ]</b>
        </td>
      </tr>
      <tr>
        <td>
          <div class="val" style="min-height: 8px;"></div>
          <div class="sub">(реквизиты документа(-ов), подтверждающего(-их) основание владения грузовым автомобилем (тягачом, а также прицепом (полуприцепом) (для типов владения 3, 4, 5))</div>
        </td>
        <td>
          <div class="val" style="min-height: 8px;"></div>
          <div class="sub">(номер, дата и срок действия специального разрешения, установленный маршрут движения тяжеловесного и (или) крупногабаритного транспортного средства или транспортного средства, перевозящего опасный груз) (при наличии))</div>
        </td>
      </tr>

      <!-- Раздел 8. Прием груза -->
      <tr>
        <td colspan="2" class="sec-head" style="background: #fafafa;">8. Прием груза</td>
      </tr>
      <tr>
        <td colspan="2">
          <div class="val-bold" style="text-align: center;">${data.loading.orgName}${data.loading.contactFio ? ' ' + data.loading.contactFio : ''}</div>
          <div class="sub">(реквизиты лица, осуществляющего погрузку груза в транспортное средство)</div>
          <div class="val" style="text-align: center;">${data.loading.orgInn ? 'ИНН ' + data.loading.orgInn : ''}</div>
          <div class="sub">(наименование (ИНН) владельца объекта инфраструктуры пункта погрузки)</div>
          <div class="val-bold" style="text-align: center;">${data.loading.address}</div>
          <div class="sub">(адрес места погрузки)</div>
          <div class="val" style="text-align: center;">${data.loading.plannedAt || ''}</div>
          <div class="sub">(заявленные дата и время подачи транспортного средства под погрузку)</div>
        </td>
      </tr>
      <tr>
        <td style="width: 50%;">
          <div class="val" style="text-align: center;">${data.loading.actualArrivalAt || ''}</div>
          <div class="sub">(фактические дата и время прибытия под погрузку)</div>
        </td>
        <td style="width: 50%;">
          <div class="val" style="text-align: center;">${data.loading.actualDepartureAt || ''}</div>
          <div class="sub">(фактические дата и время убытия)</div>
        </td>
      </tr>
      <tr>
        <td colspan="2">
          <div class="val-bold" style="text-align: center;">${data.cargo.weightGrossKg} кг, расчетная масса груза</div>
          <div class="sub">(масса груза брутто в килограммах и метод ее определения (определение разницы между массой транспортного средства после погрузки и перед погрузкой по общей массе или взвешиванием поосно или расчетная масса груза))</div>
        </td>
      </tr>
      <tr>
        <td>
          <div class="val-bold" style="text-align: center;">${data.cargo.placesCount}</div>
          <div class="sub">(количество грузовых мест)</div>
        </td>
        <td>
          <div class="val" style="text-align: center;">${data.cargo.packagingType || 'поддон'}</div>
          <div class="sub">(тара, упаковка (при наличии))</div>
        </td>
      </tr>
      <tr>
        <td colspan="2">
          <div class="val" style="min-height: 8px;"></div>
          <div class="sub">(оговорки и замечания перевозчика (при наличии) о дате и времени прибытия/убытия, о состоянии, креплении груза, тары, упаковки, маркировки, опломбирования, о массе груза и количестве грузовых мест, о проведении погрузочных работ)</div>
        </td>
      </tr>
      <tr>
        <td style="height: 34px; vertical-align: bottom;">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; padding: 0 4px;">
            <span class="val-bold">${data.loading.contactFio || ''}</span>
            <span>/ &nbsp;___________________</span>
          </div>
          <div class="sub">(подпись, расшифровка подписи лица, осуществившего погрузку груза, с указанием реквизитов документа, подтверждающего полномочия лица на погрузку груза)</div>
        </td>
        <td style="height: 34px; vertical-align: bottom;">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; padding: 0 4px;">
            <span class="val-bold">${data.driver.fio}</span>
            <span>/ &nbsp;___________________</span>
          </div>
          <div class="sub">(подпись, расшифровка подписи водителя, принявшего груз для перевозки)</div>
        </td>
      </tr>

      <!-- Раздел 9. Переадресовка -->
      <tr>
        <td colspan="2" class="sec-head" style="background: #fafafa;">9. Переадресовка (при наличии)</td>
      </tr>
      <tr>
        <td>
          <div class="val" style="min-height: 8px;"></div>
          <div class="sub">(дата, вид переадресовки на бумажном носителе или в электронном виде (с указанием вида доставки документа))</div>
        </td>
        <td>
          <div class="val" style="min-height: 8px;"></div>
          <div class="sub">(адрес нового пункта выгрузки, новые дата и время подачи транспортного средства под выгрузку)</div>
        </td>
      </tr>
      <tr>
        <td>
          <div class="val" style="min-height: 8px;"></div>
          <div class="sub">(реквизиты лица, от которого получено указание на переадресовку)</div>
        </td>
        <td>
          <div class="val" style="min-height: 8px;"></div>
          <div class="sub">(при изменении получателя груза - реквизиты нового получателя)</div>
        </td>
      </tr>
    </table>
  </div>

  <!-- ================= СТРАНИЦА 2 ================= -->
  <div class="page-break"></div>
  <div class="tn-page">
    <div class="top-annex">
      Приложение № 4 к Правилам перевозок грузов автомобильным транспортом<br>
      (в ред. Постановления Правительства РФ от 30.11.2021 № 2116)
    </div>

    <table class="tn-grid">
      <!-- Раздел 10. Выдача груза -->
      <tr>
        <td colspan="2" class="sec-head" style="background: #fafafa;">10. Выдача груза</td>
      </tr>
      <tr>
        <td style="width: 58%;">
          <div class="val-bold" style="text-align: center;">${data.unloading.address}</div>
          <div class="sub">(адрес места выгрузки)</div>
        </td>
        <td style="width: 42%;">
          <div class="val" style="text-align: center;">${data.unloading.plannedAt || ''}</div>
          <div class="sub">(заявленные дата и время подачи транспортного средства под выгрузку)</div>
        </td>
      </tr>
      <tr>
        <td>
          <div class="val-bold" style="text-align: center;">${data.unloading.actualArrivalAt || data.orderDate}</div>
          <div class="sub">(фактические дата и время прибытия)</div>
        </td>
        <td>
          <div class="val" style="text-align: center;">${data.unloading.actualDepartureAt || ''}</div>
          <div class="sub">(фактические дата и время убытия)</div>
        </td>
      </tr>
      <tr>
        <td>
          <div class="val" style="text-align: center;">без повреждений</div>
          <div class="sub">(фактическое состояние груза, тары, упаковки, маркировки, опломбирования)</div>
        </td>
        <td>
          <div class="val-bold" style="text-align: center;">${data.cargo.placesCount} ${data.cargo.packagingType || 'место'}</div>
          <div class="sub">(количество грузовых мест)</div>
        </td>
      </tr>
      <tr>
        <td>
          <div class="val-bold" style="text-align: center;">${data.cargo.weightGrossKg} кг</div>
          <div class="sub">(масса груза брутто в килограммах, масса груза нетто в килограммах (при возможности ее определения), плотность груза в соответствии с документацией на груз (при необходимости))</div>
        </td>
        <td>
          <div class="val" style="min-height: 8px;"></div>
          <div class="sub">(оговорки и замечания перевозчика (при наличии) о дате и времени прибытия/убытия, о состоянии груза, тары, упаковки, маркировки, опломбирования, о массе груза и количестве грузовых мест)</div>
        </td>
      </tr>
      <tr>
        <td style="height: 38px; vertical-align: bottom;">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; padding: 0 4px;">
            <span class="val-bold">${data.unloading.contactFio || 'Кладовщик'}</span>
            <span>/ &nbsp;___________________</span>
          </div>
          <div class="sub">(должность, подпись, расшифровка подписи грузополучателя или уполномоченного грузоотправителем лица)</div>
        </td>
        <td style="height: 38px; vertical-align: bottom;">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; padding: 0 4px;">
            <span class="val-bold">${data.driver.fio}</span>
            <span>/ &nbsp;___________________</span>
          </div>
          <div class="sub">(подпись, расшифровка подписи водителя, сдавшего груз грузополучателю или уполномоченному грузополучателем лицу)</div>
        </td>
      </tr>

      <!-- Раздел 11. Отметки -->
      <tr>
        <td colspan="2" class="sec-head-left" style="background: #fafafa;">11. Отметки грузоотправителей, грузополучателей, перевозчиков (при необходимости)</td>
      </tr>
      <tr>
        <td colspan="2" style="padding: 0;">
          <table class="inner-table" style="width: 100%;">
            <tr>
              <td style="width: 68%; border-right: 1px solid #000; padding: 2px 3px;">
                <div class="val" style="min-height: 24px;">Претензии по количеству мест и состоянию груза отсутствуют.</div>
                <div class="sub">(краткое описание обстоятельств, послуживших основанием для отметки, сведения о коммерческих и иных актах, в том числе о погрузке/выгрузке груза)</div>
              </td>
              <td style="width: 16%; border-right: 1px solid #000; padding: 2px 3px;">
                <div class="val" style="min-height: 24px;"></div>
                <div class="sub">(расчет и размер штрафа)</div>
              </td>
              <td style="width: 16%; padding: 2px 3px;">
                <div class="val" style="min-height: 24px;"></div>
                <div class="sub">(подпись, дата)</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Раздел 12. Стоимость перевозки груза -->
      <tr>
        <td colspan="2" class="sec-head" style="background: #fafafa;">12. Стоимость перевозки груза (установленная плата) в рублях (при необходимости)</td>
      </tr>
      <tr>
        <td colspan="2" style="padding: 0;">
          <table class="inner-table" style="width: 100%;">
            <tr style="border-bottom: 1px solid #000;">
              <td style="width: 25%; border-right: 1px solid #000; padding: 2px 3px;">
                <div class="val-bold" style="text-align: center;">${data.finance.priceWithoutVat ? data.finance.priceWithoutVat.toLocaleString('ru-RU') + ' руб.' : ''}</div>
                <div class="sub">(стоимость перевозки без налога - всего)</div>
              </td>
              <td style="width: 25%; border-right: 1px solid #000; padding: 2px 3px;">
                <div class="val" style="text-align: center;">${data.finance.vatRate || 'без НДС'}</div>
                <div class="sub">(налоговая ставка)</div>
              </td>
              <td style="width: 25%; border-right: 1px solid #000; padding: 2px 3px;">
                <div class="val" style="text-align: center;">0 руб.</div>
                <div class="sub">(сумма налога, предъявляемая покупателю)</div>
              </td>
              <td style="width: 25%; padding: 2px 3px;">
                <div class="val-bold" style="text-align: center;">${totalCost ? totalCost.toLocaleString('ru-RU') + ' руб.' : ''}</div>
                <div class="sub">(стоимость перевозки с налогом - всего)</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td colspan="2">
          <div class="val" style="min-height: 8px;"></div>
          <div class="sub">(порядок (механизм) расчета (исчисления) платы) (при наличии порядка (механизма))</div>
        </td>
      </tr>
      <tr>
        <td style="width: 50%;">
          <div class="val-bold">${data.carrier.name}, ИНН ${data.carrier.inn}</div>
          <div class="sub">(реквизиты, позволяющие идентифицировать Экономического субъекта, составляющего первичный учетный документ о факте хозяйственной жизни со стороны Перевозчика)</div>
        </td>
        <td style="width: 50%;">
          <div class="val-bold">${data.client.name}, ИНН ${data.client.inn}</div>
          <div class="sub">(реквизиты, позволяющие идентифицировать Экономического субъекта, составляющего первичный учетный документ о факте хозяйственной жизни со стороны Грузоотправителя)</div>
        </td>
      </tr>
      <tr>
        <td>
          <div class="val">Договор перевозки</div>
          <div class="sub">(основание, по которому Экономический субъект является составителем документа о факте хозяйственной жизни)</div>
        </td>
        <td>
          <div class="val">${contractInfo}</div>
          <div class="sub">(основание, по которому Экономический субъект является составителем документа о факте хозяйственной жизни)</div>
        </td>
      </tr>
      <tr>
        <td colspan="2">
          <div class="val-bold" style="text-align: right; padding-right: 8px;">${data.client.name}</div>
          <div class="sub">(реквизиты, позволяющие идентифицировать лицо, от которого будут поступать денежные средства)</div>
        </td>
      </tr>
      <tr>
        <td style="height: 40px; vertical-align: bottom;">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; padding: 0 4px;">
            <span class="val-bold">${data.carrier.name.replace('Индивидуальный предприниматель', 'ИП')}</span>
            <span>/ &nbsp;___________________</span>
          </div>
          <div class="sub">(подпись, расшифровка подписи лица, ответственного за оформление факта хозяйственной жизни со стороны Перевозчика (уполномоченного лица))</div>
        </td>
        <td style="height: 40px; vertical-align: bottom;">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; padding: 0 4px;">
            <span class="val-bold">Представитель заказчика</span>
            <span>/ &nbsp;___________________</span>
          </div>
          <div class="sub">(подпись, расшифровка подписи лица, ответственного за оформление факта хозяйственной жизни со стороны Грузоотправителя (уполномоченного лица))</div>
        </td>
      </tr>
      <tr>
        <td>
          <div class="val">Индивидуальный предприниматель, ${data.orderDate} г.</div>
          <div class="sub">(должность, основание полномочий физического лица, уполномоченного Перевозчиком (уполномоченным лицом), дата подписания)</div>
        </td>
        <td>
          <div class="val" style="min-height: 12px;"></div>
          <div class="sub">(должность, основание полномочий физического лица, уполномоченного Грузоотправителем (уполномоченным лицом), дата подписания)</div>
        </td>
      </tr>
    </table>
  </div>

</body>
</html>`;
}
