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

export function generateTransportWaybillHtml(
  data: TransportWaybillData,
  options?: { isEmpty?: boolean },
): string {
  const contractInfo = `${data.client.contractName || 'Договор'} № ${data.client.contractNumber || '10676'} от ${data.client.contractDate || '01.08.2012'}`;
  const totalCost = data.finance.totalPrice || data.finance.priceWithoutVat;
  const isInitiallyEmpty = options?.isEmpty ?? false;

  const initialValues = {
    orderDate: isInitiallyEmpty ? '&nbsp;' : data.orderDate,
    orderNumber: isInitiallyEmpty ? '&nbsp;' : data.orderNumber,
    copyNumber: isInitiallyEmpty ? '&nbsp;' : '1',
    shipperName: isInitiallyEmpty ? '&nbsp;' : data.shipper.name,
    isForwarder: isInitiallyEmpty
      ? '&nbsp;&nbsp;'
      : data.shipper.isForwarder
        ? 'X'
        : '&nbsp;&nbsp;',
    clientName: isInitiallyEmpty ? '&nbsp;' : data.client.name,
    shipperDoc: '&nbsp;',
    contractInfo: isInitiallyEmpty ? '&nbsp;' : contractInfo,
    consigneeName: isInitiallyEmpty
      ? '&nbsp;'
      : `${data.consignee.name}, ИНН ${data.consignee.inn}${data.consignee.phone ? ', тел: ' + data.consignee.phone : ''}`,
    deliveryAddress: isInitiallyEmpty ? '&nbsp;' : data.consignee.deliveryAddress,
    cargoName: isInitiallyEmpty ? '&nbsp;' : data.cargo.name,
    cargoPlaces: isInitiallyEmpty
      ? '&nbsp;'
      : `${data.cargo.placesCount} ${data.cargo.packagingType || 'место'}`,
    cargoWeightAndDims: isInitiallyEmpty
      ? '&nbsp;'
      : `${data.cargo.weightGrossKg} кг ${data.cargo.dimensionsText ? ' ' + data.cargo.dimensionsText : ''}`,
    dangerousCargo: '&nbsp;',
    declaredValue: isInitiallyEmpty
      ? '&nbsp;'
      : data.cargo.declaredValue
        ? data.cargo.declaredValue.toLocaleString('ru-RU') + ' руб.'
        : '&nbsp;',
    docDopog: '&nbsp;',
    docCert: isInitiallyEmpty ? '&nbsp;' : 'Паспорт качества / Сертификат соответствия',
    docWaybillOrder: isInitiallyEmpty
      ? '&nbsp;'
      : `Поручение экспедитору № ${data.orderNumber} от ${data.orderDate}`,
    specialRoute: '&nbsp;',
    specialContacts: '&nbsp;',
    sanitaryReq: '&nbsp;',
    tempReq: '&nbsp;',
    carrierName: isInitiallyEmpty
      ? '&nbsp;'
      : `${data.carrier.name}, ИНН ${data.carrier.inn}${data.carrier.ogrnip ? ', ОГРНИП ' + data.carrier.ogrnip : ''}`,
    driverFio: isInitiallyEmpty ? '&nbsp;' : data.driver.fio,
    vehicleModel: isInitiallyEmpty
      ? '&nbsp;'
      : `${data.vehicle.bodyType || 'Грузовой автомобиль'}, ${data.vehicle.brandName || 'Валдай'}, ${data.vehicle.payloadTons || 3.1} т, ${data.vehicle.capacityM3 || 40} м3`,
    vehicleRegNumber: isInitiallyEmpty ? '&nbsp;' : data.vehicle.regNumber,
    vehicleOwnership: isInitiallyEmpty ? '&nbsp;' : String(data.vehicle.ownershipType || 1),
    vehicleDoc: '&nbsp;',
    vehiclePermit: '&nbsp;',
    loadingOrg: isInitiallyEmpty
      ? '&nbsp;'
      : `${data.loading.orgName}${data.loading.contactFio ? ' ' + data.loading.contactFio : ''}`,
    loadingOwnerInn: isInitiallyEmpty
      ? '&nbsp;'
      : data.loading.orgInn
        ? 'ИНН ' + data.loading.orgInn
        : '&nbsp;',
    loadingAddress: isInitiallyEmpty ? '&nbsp;' : data.loading.address,
    loadingPlannedAt: isInitiallyEmpty ? '&nbsp;' : data.loading.plannedAt || '&nbsp;',
    loadingActualArrival: isInitiallyEmpty ? '&nbsp;' : data.loading.actualArrivalAt || '&nbsp;',
    loadingActualDeparture: isInitiallyEmpty
      ? '&nbsp;'
      : data.loading.actualDepartureAt || '&nbsp;',
    loadingWeight: isInitiallyEmpty
      ? '&nbsp;'
      : `${data.cargo.weightGrossKg} кг расчетная масса груза`,
    loadingPlacesCount: isInitiallyEmpty ? '&nbsp;' : String(data.cargo.placesCount),
    loadingPkg: isInitiallyEmpty ? '&nbsp;' : data.cargo.packagingType || 'место',
    carrierRemarks: '&nbsp;',
    loadingSignFio: isInitiallyEmpty ? '&nbsp;' : data.loading.contactFio || 'Гончарова М.В.',
    driverSignFio: isInitiallyEmpty ? '&nbsp;' : data.driver.fio,
    redirDate: '&nbsp;',
    redirNewAddress: '&nbsp;',
    redirPerson: '&nbsp;',
    redirNewConsignee: '&nbsp;',
    unloadingAddress: isInitiallyEmpty ? '&nbsp;' : data.unloading.address,
    unloadingPlannedAt: isInitiallyEmpty ? '&nbsp;' : data.unloading.plannedAt || '&nbsp;',
    unloadingActualArrival: isInitiallyEmpty
      ? '&nbsp;'
      : data.unloading.actualArrivalAt || data.orderDate,
    unloadingActualDeparture: isInitiallyEmpty
      ? '&nbsp;'
      : data.unloading.actualDepartureAt || '&nbsp;',
    cargoState: isInitiallyEmpty ? '&nbsp;' : 'без повреждений',
    cargoPlacesUnload: isInitiallyEmpty
      ? '&nbsp;'
      : `${data.cargo.placesCount} ${data.cargo.packagingType || 'место'}`,
    unloadingWeight: isInitiallyEmpty ? '&nbsp;' : `${data.cargo.weightGrossKg} кг`,
    unloadingRemarks: '&nbsp;',
    unloadingSignFio: isInitiallyEmpty
      ? '&nbsp;'
      : data.unloading.contactFio || 'КЛАДОВЩИК СКЛ. 813 ЧЕРНИКОВА Н.В.',
    driverUnloadSign: isInitiallyEmpty ? '&nbsp;' : data.driver.fio,
    actsNotes: '&nbsp;',
    penaltyNotes: '&nbsp;',
    signDateNotes: '&nbsp;',
    priceNoVat: isInitiallyEmpty
      ? '&nbsp;'
      : `${data.finance.priceWithoutVat ? data.finance.priceWithoutVat.toLocaleString('ru-RU') + ' рублей' : ''}`,
    vatRate: isInitiallyEmpty ? '&nbsp;' : data.finance.vatRate || 'без НДС',
    vatAmount: isInitiallyEmpty ? '&nbsp;' : '0 руб.',
    priceTotal: isInitiallyEmpty
      ? '&nbsp;'
      : `${totalCost ? totalCost.toLocaleString('ru-RU') + ' рублей' : ''}`,
    calcMechanism: '&nbsp;',
    carrierEcon: isInitiallyEmpty ? '&nbsp;' : `${data.carrier.name}, ИНН ${data.carrier.inn}`,
    shipperEcon: isInitiallyEmpty ? '&nbsp;' : `${data.client.name}, ИНН ${data.client.inn}`,
    carrierBasis: isInitiallyEmpty ? '&nbsp;' : 'Договор перевозки',
    shipperBasis: isInitiallyEmpty ? '&nbsp;' : contractInfo,
    payerEmpty: '&nbsp;',
    payerName: isInitiallyEmpty ? '&nbsp;' : data.client.name,
    carrierSign12: isInitiallyEmpty
      ? '&nbsp;'
      : data.carrier.name.replace('Индивидуальный предприниматель', 'ИП'),
    shipperSign12: isInitiallyEmpty ? '&nbsp;' : 'Представитель заказчика',
    carrierPower: isInitiallyEmpty
      ? '&nbsp;'
      : `Индивидуальный предприниматель, ${data.orderDate} г.`,
    shipperPower: '&nbsp;',
  };

  const defaultDataJson = JSON.stringify({
    orderDate: data.orderDate,
    orderNumber: data.orderNumber,
    copyNumber: '1',
    shipperName: data.shipper.name,
    isForwarder: data.shipper.isForwarder ? 'X' : '&nbsp;&nbsp;',
    clientName: data.client.name,
    shipperDoc: '&nbsp;',
    contractInfo: contractInfo,
    consigneeName: `${data.consignee.name}, ИНН ${data.consignee.inn}${data.consignee.phone ? ', тел: ' + data.consignee.phone : ''}`,
    deliveryAddress: data.consignee.deliveryAddress,
    cargoName: data.cargo.name,
    cargoPlaces: `${data.cargo.placesCount} ${data.cargo.packagingType || 'место'}`,
    cargoWeightAndDims: `${data.cargo.weightGrossKg} кг ${data.cargo.dimensionsText ? ' ' + data.cargo.dimensionsText : ''}`,
    dangerousCargo: '&nbsp;',
    declaredValue: data.cargo.declaredValue
      ? data.cargo.declaredValue.toLocaleString('ru-RU') + ' руб.'
      : '&nbsp;',
    docDopog: '&nbsp;',
    docCert: 'Паспорт качества / Сертификат соответствия',
    docWaybillOrder: `Поручение экспедитору № ${data.orderNumber} от ${data.orderDate}`,
    specialRoute: '&nbsp;',
    specialContacts: '&nbsp;',
    sanitaryReq: '&nbsp;',
    tempReq: '&nbsp;',
    carrierName: `${data.carrier.name}, ИНН ${data.carrier.inn}${data.carrier.ogrnip ? ', ОГРНИП ' + data.carrier.ogrnip : ''}`,
    driverFio: data.driver.fio,
    vehicleModel: `${data.vehicle.bodyType || 'Грузовой автомобиль'}, ${data.vehicle.brandName || 'Валдай'}, ${data.vehicle.payloadTons || 3.1} т, ${data.vehicle.capacityM3 || 40} м3`,
    vehicleRegNumber: data.vehicle.regNumber,
    vehicleOwnership: String(data.vehicle.ownershipType || 1),
    vehicleDoc: '&nbsp;',
    vehiclePermit: '&nbsp;',
    loadingOrg: `${data.loading.orgName}${data.loading.contactFio ? ' ' + data.loading.contactFio : ''}`,
    loadingOwnerInn: data.loading.orgInn ? 'ИНН ' + data.loading.orgInn : '&nbsp;',
    loadingAddress: data.loading.address,
    loadingPlannedAt: data.loading.plannedAt || '&nbsp;',
    loadingActualArrival: data.loading.actualArrivalAt || '&nbsp;',
    loadingActualDeparture: data.loading.actualDepartureAt || '&nbsp;',
    loadingWeight: `${data.cargo.weightGrossKg} кг расчетная масса груза`,
    loadingPlacesCount: String(data.cargo.placesCount),
    loadingPkg: data.cargo.packagingType || 'место',
    carrierRemarks: '&nbsp;',
    loadingSignFio: data.loading.contactFio || 'Гончарова М.В.',
    driverSignFio: data.driver.fio,
    redirDate: '&nbsp;',
    redirNewAddress: '&nbsp;',
    redirPerson: '&nbsp;',
    redirNewConsignee: '&nbsp;',
    unloadingAddress: data.unloading.address,
    unloadingPlannedAt: data.unloading.plannedAt || '&nbsp;',
    unloadingActualArrival: data.unloading.actualArrivalAt || data.orderDate,
    unloadingActualDeparture: data.unloading.actualDepartureAt || '&nbsp;',
    cargoState: 'без повреждений',
    cargoPlacesUnload: `${data.cargo.placesCount} ${data.cargo.packagingType || 'место'}`,
    unloadingWeight: `${data.cargo.weightGrossKg} кг`,
    unloadingRemarks: '&nbsp;',
    unloadingSignFio: data.unloading.contactFio || 'КЛАДОВЩИК СКЛ. 813 ЧЕРНИКОВА Н.В.',
    driverUnloadSign: data.driver.fio,
    actsNotes: '&nbsp;',
    penaltyNotes: '&nbsp;',
    signDateNotes: '&nbsp;',
    priceNoVat: `${data.finance.priceWithoutVat ? data.finance.priceWithoutVat.toLocaleString('ru-RU') + ' рублей' : ''}`,
    vatRate: data.finance.vatRate || 'без НДС',
    vatAmount: '0 руб.',
    priceTotal: `${totalCost ? totalCost.toLocaleString('ru-RU') + ' рублей' : ''}`,
    calcMechanism: '&nbsp;',
    carrierEcon: `${data.carrier.name}, ИНН ${data.carrier.inn}`,
    shipperEcon: `${data.client.name}, ИНН ${data.client.inn}`,
    carrierBasis: 'Договор перевозки',
    shipperBasis: contractInfo,
    payerEmpty: '&nbsp;',
    payerName: data.client.name,
    carrierSign12: data.carrier.name.replace('Индивидуальный предприниматель', 'ИП'),
    shipperSign12: 'Представитель заказчика',
    carrierPower: `Индивидуальный предприниматель, ${data.orderDate} г.`,
    shipperPower: '&nbsp;',
  });

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
      font-size: 7pt;
      line-height: 1.1;
      color: #000;
      background: #334155;
      margin: 0;
      padding: 15px 0;
    }
    .print-hide {
      max-width: 210mm;
      margin: 0 auto 14px auto;
      padding: 10px 16px;
      background: #0f172a;
      color: #fff;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
    }
    .btn-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn {
      color: #fff;
      border: none;
      padding: 7px 14px;
      font-weight: 600;
      font-size: 12px;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: all 0.15s ease;
    }
    .btn-primary { background: #2563eb; }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-secondary { background: #475569; }
    .btn-secondary:hover { background: #64748b; }
    .btn-danger { background: #dc2626; }
    .btn-danger:hover { background: #b91c1c; }
    
    .tn-page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto 20px auto;
      background: #fff;
      padding: 5mm 6mm 5mm 6mm;
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
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
      .editable-field:hover, .editable-field:focus {
        background: transparent !important;
        outline: none !important;
      }
      .tn-page {
        width: 100% !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        page-break-after: always;
        break-after: page;
      }
    }

    .top-annex {
      text-align: right;
      font-size: 6.5pt;
      line-height: 1.15;
      margin-bottom: 2px;
    }

    /* Главная таблица с делением СТРОГО 50% / 50% */
    table.tn-table {
      width: 100%;
      border-collapse: collapse;
      border-top: 1px solid #000;
      border-left: 1px solid #000;
      border-right: 1px solid #000;
      border-bottom: 1px solid #000;
      table-layout: fixed;
    }
    table.tn-table td, table.tn-table th {
      border: 1px solid #000;
      padding: 1px 3px;
      vertical-align: middle;
      font-size: 7.2pt;
    }

    .sec-title {
      font-weight: bold;
      text-align: center;
      font-size: 7.5pt;
      padding: 2px 2px;
      text-transform: uppercase;
      background: #fff;
    }

    .input-cell {
      height: 15px;
      font-size: 7.5pt;
      color: #000;
      font-weight: normal;
      vertical-align: middle;
    }
    .input-cell-bold {
      height: 15px;
      font-size: 7.5pt;
      color: #000;
      font-weight: bold;
      vertical-align: middle;
    }
    .input-sign {
      height: 32px;
      vertical-align: bottom;
      padding-bottom: 2px;
    }

    .sub-prompt {
      font-size: 5.5pt;
      line-height: 1.05;
      text-align: center;
      color: #000;
      padding: 1px 2px;
      background: #fff;
      vertical-align: middle;
    }

    /* Подсветка редактируемых полей */
    .editable-field {
      outline: none;
      min-height: 13px;
      cursor: text;
    }
    .editable-field:hover {
      background: #f0fdf4;
    }
    .editable-field:focus {
      background: #fef08a;
      box-shadow: inset 0 0 0 1px #ca8a04;
    }
  </style>
</head>
<body>

  <div class="print-hide">
    <div>
      <strong>Форма ТН (ПП РФ № 2116)</strong> | Заявка № ${data.orderNumber} &nbsp;|&nbsp; 
      <span style="color: #94a3b8; font-size: 11px;">Кликните в любую ячейку бланка для изменения или очистки</span>
    </div>
    <div class="btn-group">
      <button class="btn btn-secondary" onclick="resetDefaultData()">🔄 Заполнить из заявки</button>
      <button class="btn btn-danger" onclick="clearAllFields()">🧹 Очистить всё (Пустой бланк)</button>
      <button class="btn btn-primary" onclick="window.print()">🖨️ Печать / Сохранить в PDF</button>
    </div>
  </div>

  <!-- =============================== СТРАНИЦА 1 =============================== -->
  <div class="tn-page">
    <div class="top-annex">
      Приложение № 4 к Правилам перевозок грузов автомобильным транспортом<br>
      (в ред. Постановления Правительства РФ от 30.11.2021 № 2116)
    </div>

    <!-- Таблица с колонками СТРОГО 50% и 50% -->
    <table class="tn-table">
      <colgroup>
        <col style="width: 50%;">
        <col style="width: 50%;">
      </colgroup>

      <!-- [Линия 1 = верхняя рамка] -->
      <!-- Шапка документа и раздел 1/1а имеют смещение 58% / 42% через внутреннюю таблицу -->
      <tr>
        <td colspan="2" style="padding: 0; border: none;">
          <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
            <colgroup>
              <col style="width: 58%;">
              <col style="width: 42%;">
            </colgroup>
            <!-- Заголовки шапки -->
            <tr>
              <td class="sec-title" style="border: 1px solid #000; border-top: none; border-left: none;">ТРАНСПОРТНАЯ НАКЛАДНАЯ (ФОРМА)</td>
              <td class="sec-title" style="border: 1px solid #000; border-top: none; border-right: none;">Заказ (заявка)</td>
            </tr>
            <!-- [Линия 2] -->
            <tr>
              <td style="padding: 0; border: 1px solid #000; border-left: none;">
                <table style="width: 100%; border-collapse: collapse; border: none;">
                  <tr>
                    <td style="width: 50%; border: none; border-right: 1px solid #000; height: 16px; padding: 1px 3px;">
                      Дата &nbsp;<b class="editable-field" contenteditable="true" data-field="orderDate">${initialValues.orderDate}</b>
                    </td>
                    <td style="width: 50%; border: none; height: 16px; padding: 1px 3px;">
                      N &nbsp;<b class="editable-field" contenteditable="true" data-field="orderNumber">${initialValues.orderNumber}</b>
                    </td>
                  </tr>
                </table>
              </td>
              <td style="padding: 0; border: 1px solid #000; border-right: none;">
                <table style="width: 100%; border-collapse: collapse; border: none;">
                  <tr>
                    <td style="width: 50%; border: none; border-right: 1px solid #000; height: 16px; padding: 1px 3px;">
                      Дата &nbsp;<b class="editable-field" contenteditable="true" data-field="orderDate">${initialValues.orderDate}</b>
                    </td>
                    <td style="width: 50%; border: none; height: 16px; padding: 1px 3px;">
                      N &nbsp;<b class="editable-field" contenteditable="true" data-field="orderNumber">${initialValues.orderNumber}</b>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- [Линия 3] -->
            <tr>
              <td style="height: 15px; border: 1px solid #000; border-left: none;">Экземпляр N &nbsp;<b class="editable-field" contenteditable="true" data-field="copyNumber">${initialValues.copyNumber}</b></td>
              <td style="height: 15px; border: 1px solid #000; border-right: none;">&nbsp;</td>
            </tr>
            <!-- [Линия 4] -->
            <!-- Раздел 1 и 1а -->
            <tr>
              <td class="input-cell-bold" style="border: 1px solid #000; border-left: none;">
                1. Грузоотправитель &nbsp; <span class="editable-field" contenteditable="true" data-field="shipperName">${initialValues.shipperName}</span>
              </td>
              <td class="input-cell-bold" style="border: 1px solid #000; border-right: none;">
                1а. Заказчик услуг по организации перевозки груза (при наличии)
              </td>
            </tr>
            <!-- [Линия 5] -->
            <tr>
              <td class="input-cell" style="border: 1px solid #000; border-left: none;">
                является экспедитором &nbsp; [ <span class="editable-field" contenteditable="true" data-field="isForwarder">${initialValues.isForwarder}</span> ]
              </td>
              <td class="input-cell-bold" style="text-align: center; border: 1px solid #000; border-right: none;">
                <span class="editable-field" contenteditable="true" data-field="clientName">${initialValues.clientName}</span>
              </td>
            </tr>
            <!-- [Линия 6] -->
            <tr>
              <td class="sub-prompt" style="border: 1px solid #000; border-left: none;">
                (реквизиты, позволяющие идентифицировать Грузоотправителя)
              </td>
              <td class="sub-prompt" style="border: 1px solid #000; border-right: none;">
                (реквизиты, позволяющие идентифицировать Заказчика услуг по организации перевозки груза)
              </td>
            </tr>
            <!-- [Линия 7] -->
            <tr>
              <td class="input-cell" style="border: 1px solid #000; border-left: none;">
                <div class="editable-field" contenteditable="true" data-field="shipperDoc">${initialValues.shipperDoc}</div>
              </td>
              <td class="input-cell" style="text-align: center; border: 1px solid #000; border-right: none;">
                <span class="editable-field" contenteditable="true" data-field="contractInfo">${initialValues.contractInfo}</span>
              </td>
            </tr>
            <!-- [Линия 8] -->
            <tr>
              <td class="sub-prompt" style="border: 1px solid #000; border-left: none;">
                (реквизиты документа, определяющего основания осуществления расчетов по договору перевозки иным лицом, отличным от грузоотправителя (при наличии))
              </td>
              <td class="sub-prompt" style="border: 1px solid #000; border-right: none;">
                (реквизиты договора на выполнение услуг по организации перевозки груза)
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <!-- [Линия 9] -->

      <!-- Раздел 2. Грузополучатель (НА ВСЮ ШИРИНУ, НЕТ вертикальной линии!) -->
      <tr>
        <td colspan="2" class="sec-title" style="text-align: left; padding-left: 4px;">2. Грузополучатель</td>
      </tr>
      <!-- [Линия 10] -->
      <tr>
        <td colspan="2" class="input-cell-bold" style="text-align: center;">
          <span class="editable-field" contenteditable="true" data-field="consigneeName">${initialValues.consigneeName}</span>
        </td>
      </tr>
      <!-- [Линия 11] -->
      <tr>
        <td colspan="2" class="sub-prompt">
          (реквизиты, позволяющие идентифицировать Грузополучателя)
        </td>
      </tr>
      <!-- [Линия 12] -->
      <tr>
        <td colspan="2" class="input-cell-bold" style="text-align: center;">
          <span class="editable-field" contenteditable="true" data-field="deliveryAddress">${initialValues.deliveryAddress}</span>
        </td>
      </tr>
      <!-- [Линия 13] -->
      <tr>
        <td colspan="2" class="sub-prompt">
          (адрес места доставки груза)
        </td>
      </tr>
      <!-- [Линия 14] -->

      <!-- ================= НАЧИНАЯ ОТСЮДА ВСЕ ВЕРТИКАЛЬНЫЕ ЛИНИИ СТРОГО ПО СЕРЕДИНЕ (50% / 50%) ================= -->

      <!-- Раздел 3. Груз -->
      <tr>
        <td colspan="2" class="sec-title">3. Груз</td>
      </tr>
      <!-- [Линия 15] -->
      <tr>
        <td class="input-cell-bold">
          <div class="editable-field" contenteditable="true" data-field="cargoName">${initialValues.cargoName}</div>
        </td>
        <td class="input-cell-bold">
          <div class="editable-field" contenteditable="true" data-field="cargoPlaces">${initialValues.cargoPlaces}</div>
        </td>
      </tr>
      <!-- [Линия 16] -->
      <tr>
        <td class="sub-prompt">
          (отгрузочное наименование груза (для опасных грузов - в соответствии с ДОПОГ), его состояние и другая необходимая информация о грузе)
        </td>
        <td class="sub-prompt">
          (количество грузовых мест, маркировка, вид тары и способ упаковки)
        </td>
      </tr>
      <!-- [Линия 17] -->
      <tr>
        <td colspan="2" class="input-cell-bold" style="text-align: center;">
          <span class="editable-field" contenteditable="true" data-field="cargoWeightAndDims">${initialValues.cargoWeightAndDims}</span>
        </td>
      </tr>
      <!-- [Линия 18] -->
      <tr>
        <td colspan="2" class="sub-prompt">
          (масса груза брутто в килограммах, масса груза нетто в килограммах (при возможности ее определения), размеры (высота, ширина, длина) в метрах (при перевозке крупногабаритного груза), объем груза в кубических метрах и плотность груза в соответствии с документацией на груз (при необходимости), дополнительные характеристики груза, учитывающие отраслевые особенности (при необходимости))
        </td>
      </tr>
      <!-- [Линия 19] -->
      <tr>
        <td class="input-cell"><div class="editable-field" contenteditable="true" data-field="dangerousCargo">${initialValues.dangerousCargo}</div></td>
        <td class="input-cell"><div class="editable-field" contenteditable="true" data-field="declaredValue">${initialValues.declaredValue}</div></td>
      </tr>
      <!-- [Линия 20] -->
      <tr>
        <td class="sub-prompt">
          (в случае перевозки опасного груза - информация по каждому опасному веществу, материалу или изделию в соответствии с пунктом 5.4.1 ДОПОГ)
        </td>
        <td class="sub-prompt">
          (объявленная стоимость (ценность) груза (при необходимости))
        </td>
      </tr>
      <!-- [Линия 21] -->

      <!-- Раздел 4. Сопроводительные документы на груз (при наличии) -->
      <tr>
        <td colspan="2" class="sec-title">4. Сопроводительные документы на груз (при наличии)</td>
      </tr>
      <!-- [Линия 22] -->
      <tr>
        <td colspan="2" class="input-cell"><div class="editable-field" contenteditable="true" data-field="docDopog">${initialValues.docDopog}</div></td>
      </tr>
      <!-- [Линия 23] -->
      <tr>
        <td colspan="2" class="sub-prompt">
          (перечень прилагаемых к транспортной накладной документов, предусмотренных ДОПОГ, санитарными, таможенными (при наличии), карантинными, иными правилами в соответствии с законодательством Российской Федерации, либо регистрационные номера указанных документов, если такие документы (сведения о таких документах) содержатся в государственных информационных системах)
        </td>
      </tr>
      <!-- [Линия 24] -->
      <tr>
        <td colspan="2" class="input-cell" style="text-align: center;">
          <div class="editable-field" contenteditable="true" data-field="docCert">${initialValues.docCert}</div>
        </td>
      </tr>
      <!-- [Линия 25] -->
      <tr>
        <td colspan="2" class="sub-prompt">
          (перечень прилагаемых к грузу сертификатов, паспортов качества, удостоверений и других документов, наличие которых установлено законодательством Российской Федерации, либо регистрационные номера указанных документов, если такие документы (сведения о таких документах) содержатся в государственных информационных системах)
        </td>
      </tr>
      <!-- [Линия 26] -->
      <tr>
        <td colspan="2" class="input-cell" style="text-align: center;">
          <div class="editable-field" contenteditable="true" data-field="docWaybillOrder">${initialValues.docWaybillOrder}</div>
        </td>
      </tr>
      <!-- [Линия 27] -->
      <tr>
        <td colspan="2" class="sub-prompt">
          (реквизиты, позволяющие идентифицировать документ(-ы), подтверждающий(-ие) отгрузку товаров (при наличии), реквизиты сопроводительной ведомости (при перевозке груженых контейнеров или порожних контейнеров))
        </td>
      </tr>
      <!-- [Линия 28] -->

      <!-- Раздел 5. Указания грузоотправителя по особым условиям перевозки (СТРОГО 50% / 50%) -->
      <tr>
        <td colspan="2" class="sec-title">5. Указания грузоотправителя по особым условиям перевозки</td>
      </tr>
      <!-- [Линия 29] -->
      <tr>
        <td class="input-cell"><div class="editable-field" contenteditable="true" data-field="specialRoute">${initialValues.specialRoute}</div></td>
        <td class="input-cell"><div class="editable-field" contenteditable="true" data-field="specialContacts">${initialValues.specialContacts}</div></td>
      </tr>
      <!-- [Линия 30] -->
      <tr>
        <td class="sub-prompt">
          (маршрут перевозки, дата и время/сроки доставки груза (при необходимости))
        </td>
        <td class="sub-prompt">
          (контактная информация о лицах, по указанию которых может осуществляться переадресовка)
        </td>
      </tr>
      <!-- [Линия 31] -->
      <tr>
        <td class="input-cell"><div class="editable-field" contenteditable="true" data-field="sanitaryReq">${initialValues.sanitaryReq}</div></td>
        <td class="input-cell"><div class="editable-field" contenteditable="true" data-field="tempReq">${initialValues.tempReq}</div></td>
      </tr>
      <!-- [Линия 32] -->
      <tr>
        <td class="sub-prompt">
          (указания, необходимые для выполнения фитосанитарных, санитарных, карантинных, таможенных и прочих требований, установленных законодательством Российской Федерации)
        </td>
        <td class="sub-prompt">
          (температурный режим перевозки груза (при необходимости), сведения о запорно-пломбировочных устройствах (в случае их предоставления грузоотправителем), запрещение перегрузки груза)
        </td>
      </tr>
      <!-- [Линия 33] -->

      <!-- Раздел 6. Перевозчик (СТРОГО 50% / 50%) -->
      <tr>
        <td colspan="2" class="sec-title">6. Перевозчик</td>
      </tr>
      <!-- [Линия 34] -->
      <tr>
        <td class="input-cell-bold">
          <div class="editable-field" contenteditable="true" data-field="carrierName">${initialValues.carrierName}</div>
        </td>
        <td style="text-align: center;" class="input-cell-bold">
          <div class="editable-field" contenteditable="true" data-field="driverFio">${initialValues.driverFio}</div>
        </td>
      </tr>
      <!-- [Линия 35] -->
      <tr>
        <td class="sub-prompt">
          (реквизиты, позволяющие идентифицировать Перевозчика)
        </td>
        <td class="sub-prompt">
          (реквизиты, позволяющие идентифицировать водителя(ей))
        </td>
      </tr>
      <!-- [Линия 36] -->

      <!-- Раздел 7. Транспортное средство (СТРОГО 50% / 50%) -->
      <tr>
        <td colspan="2" class="sec-title">7. Транспортное средство</td>
      </tr>
      <!-- [Линия 37] -->
      <tr>
        <td class="input-cell-bold">
          <div class="editable-field" contenteditable="true" data-field="vehicleModel">${initialValues.vehicleModel}</div>
        </td>
        <td style="text-align: center;" class="input-cell-bold">
          <div class="editable-field" contenteditable="true" data-field="vehicleRegNumber">${initialValues.vehicleRegNumber}</div>
        </td>
      </tr>
      <!-- [Линия 38] -->
      <tr>
        <td class="sub-prompt">
          (тип, марка, грузоподъемность (в тоннах), вместимость (в кубических метрах))
        </td>
        <td class="sub-prompt">
          (регистрационный номер транспортного средства)
        </td>
      </tr>
      <!-- [Линия 39] -->
      <tr>
        <td colspan="2" style="font-size: 7.2pt; padding: 2px 4px; height: 16px;">
          Тип владения: 1 - собственность; 2 - совместная собственность супругов; 3 - аренда; 4 - лизинг; 5 - безвозмездное пользование &nbsp; <b>[ <span class="editable-field" contenteditable="true" data-field="vehicleOwnership">${initialValues.vehicleOwnership}</span> ]</b>
        </td>
      </tr>
      <!-- [Линия 40] -->
      <tr>
        <td class="input-cell"><div class="editable-field" contenteditable="true" data-field="vehicleDoc">${initialValues.vehicleDoc}</div></td>
        <td class="input-cell"><div class="editable-field" contenteditable="true" data-field="vehiclePermit">${initialValues.vehiclePermit}</div></td>
      </tr>
      <!-- [Линия 41] -->
      <tr>
        <td class="sub-prompt">
          (реквизиты документа(-ов), подтверждающего(-их) основание владения грузовым автомобилем (тягачом, а также прицепом (полуприцепом) (для типов владения 3, 4, 5))
        </td>
        <td class="sub-prompt">
          (номер, дата и срок действия специального разрешения, установленный маршрут движения тяжеловесного и (или) крупногабаритного транспортного средства или транспортного средства, перевозящего опасный груз) (при наличии))
        </td>
      </tr>
      <!-- [Линия 42] -->

      <!-- Раздел 8. Прием груза -->
      <tr>
        <td colspan="2" class="sec-title">8. Прием груза</td>
      </tr>
      <!-- [Линия 43] -->
      <tr>
        <td colspan="2" class="input-cell-bold" style="text-align: center;">
          <div class="editable-field" contenteditable="true" data-field="loadingOrg">${initialValues.loadingOrg}</div>
        </td>
      </tr>
      <!-- [Линия 44] -->
      <tr>
        <td colspan="2" class="sub-prompt">
          (реквизиты лица, осуществляющего погрузку груза в транспортное средство)
        </td>
      </tr>
      <!-- [Линия 45] -->
      <tr>
        <td colspan="2" class="input-cell"><div class="editable-field" contenteditable="true" data-field="loadingOwnerInn">${initialValues.loadingOwnerInn}</div></td>
      </tr>
      <!-- [Линия 46] -->
      <tr>
        <td colspan="2" class="sub-prompt">
          (наименование (ИНН) владельца объекта инфраструктуры пункта погрузки)
        </td>
      </tr>
      <!-- [Линия 47] -->
      <tr>
        <td colspan="2" class="input-cell-bold" style="text-align: center;">
          <div class="editable-field" contenteditable="true" data-field="loadingAddress">${initialValues.loadingAddress}</div>
        </td>
      </tr>
      <!-- [Линия 48] -->
      <tr>
        <td colspan="2" class="sub-prompt">
          (адрес места погрузки)
        </td>
      </tr>
      <!-- [Линия 49] -->
      <tr>
        <td colspan="2" class="input-cell"><div class="editable-field" contenteditable="true" data-field="loadingPlannedAt">${initialValues.loadingPlannedAt}</div></td>
      </tr>
      <!-- [Линия 50] -->
      <tr>
        <td colspan="2" class="sub-prompt">
          (заявленные дата и время подачи транспортного средства под погрузку)
        </td>
      </tr>
      <!-- [Линия 51] -->
      <tr>
        <td class="input-cell"><div class="editable-field" contenteditable="true" data-field="loadingActualArrival">${initialValues.loadingActualArrival}</div></td>
        <td class="input-cell"><div class="editable-field" contenteditable="true" data-field="loadingActualDeparture">${initialValues.loadingActualDeparture}</div></td>
      </tr>
      <!-- [Линия 52] -->
      <tr>
        <td class="sub-prompt">
          (фактические дата и время прибытия под погрузку)
        </td>
        <td class="sub-prompt">
          (фактические дата и время убытия)
        </td>
      </tr>
      <!-- [Линия 53] -->
      <tr>
        <td colspan="2" class="input-cell-bold" style="text-align: center;">
          <div class="editable-field" contenteditable="true" data-field="loadingWeight">${initialValues.loadingWeight}</div>
        </td>
      </tr>
      <!-- [Линия 54] -->
      <tr>
        <td colspan="2" class="sub-prompt">
          (масса груза брутто в килограммах и метод ее определения (определение разницы между массой транспортного средства после погрузки и перед погрузкой по общей массе или взвешиванием поосно или расчетная масса груза))
        </td>
      </tr>
      <!-- [Линия 55] -->
      <tr>
        <td style="text-align: center;" class="input-cell-bold">
          <div class="editable-field" contenteditable="true" data-field="loadingPlacesCount">${initialValues.loadingPlacesCount}</div>
        </td>
        <td style="text-align: center;" class="input-cell-bold">
          <div class="editable-field" contenteditable="true" data-field="loadingPkg">${initialValues.loadingPkg}</div>
        </td>
      </tr>
      <!-- [Линия 56] -->
      <tr>
        <td class="sub-prompt">
          (количество грузовых мест)
        </td>
        <td class="sub-prompt">
          (тара, упаковка (при наличии))
        </td>
      </tr>
      <!-- [Линия 57] -->
      <tr>
        <td colspan="2" class="input-cell"><div class="editable-field" contenteditable="true" data-field="carrierRemarks">${initialValues.carrierRemarks}</div></td>
      </tr>
      <!-- [Линия 58] -->
      <tr>
        <td colspan="2" class="sub-prompt">
          (оговорки и замечания перевозчика (при наличии) о дате и времени прибытия/убытия, о состоянии, креплении груза, тары, упаковки, маркировки, опломбирования, о массе груза и количестве грузовых мест, о проведении погрузочных работ)
        </td>
      </tr>
      <!-- [Линия 59] -->
      <tr>
        <td class="input-sign">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; padding: 0 4px;">
            <span class="editable-field" contenteditable="true" data-field="loadingSignFio">${initialValues.loadingSignFio}</span>
            <span>/ &nbsp;___________________</span>
          </div>
        </td>
        <td class="input-sign">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; padding: 0 4px;">
            <span style="font-weight: bold;" class="editable-field" contenteditable="true" data-field="driverSignFio">${initialValues.driverSignFio}</span>
            <span>/ &nbsp;___________________</span>
          </div>
        </td>
      </tr>
      <!-- [Линия 60] -->
      <tr>
        <td class="sub-prompt">
          (подпись, расшифровка подписи лица, осуществившего погрузку груза, с указанием реквизитов документа, подтверждающего полномочия лица на погрузку груза)
        </td>
        <td class="sub-prompt">
          (подпись, расшифровка подписи водителя, принявшего груз для перевозки)
        </td>
      </tr>
      <!-- [Линия 61] -->

      <!-- Раздел 9. Переадресовка (при наличии) (СТРОГО 50% / 50%) -->
      <tr>
        <td colspan="2" class="sec-title">9. Переадресовка (при наличии)</td>
      </tr>
      <!-- [Линия 62] -->
      <tr>
        <td class="input-cell"><div class="editable-field" contenteditable="true" data-field="redirDate">${initialValues.redirDate}</div></td>
        <td class="input-cell"><div class="editable-field" contenteditable="true" data-field="redirNewAddress">${initialValues.redirNewAddress}</div></td>
      </tr>
      <!-- [Линия 63] -->
      <tr>
        <td class="sub-prompt">
          (дата, вид переадресовки на бумажном носителе или в электронном виде (с указанием вида доставки документа))
        </td>
        <td class="sub-prompt">
          (адрес нового пункта выгрузки, новые дата и время подачи транспортного средства под выгрузку)
        </td>
      </tr>
      <!-- [Линия 64] -->
      <tr>
        <td class="input-cell"><div class="editable-field" contenteditable="true" data-field="redirPerson">${initialValues.redirPerson}</div></td>
        <td class="input-cell"><div class="editable-field" contenteditable="true" data-field="redirNewConsignee">${initialValues.redirNewConsignee}</div></td>
      </tr>
      <!-- [Линия 65] -->
      <tr>
        <td class="sub-prompt">
          (реквизиты лица, от которого получено указание на переадресовку)
        </td>
        <td class="sub-prompt">
          (при изменении получателя груза - реквизиты нового получателя)
        </td>
      </tr>
      <!-- [Линия 66 = нижняя закрывающая рамка таблицы] -->
    </table>
  </div>


  <!-- =============================== СТРАНИЦА 2 =============================== -->
  <div class="tn-page">
    <div class="top-annex">
      Приложение № 4 к Правилам перевозок грузов автомобильным транспортом<br>
      (в ред. Постановления Правительства РФ от 30.11.2021 № 2116)
    </div>

    <table class="tn-table">
      <colgroup>
        <col style="width: 50%;">
        <col style="width: 50%;">
      </colgroup>

      <!-- Раздел 10. Выдача груза (СТРОГО 50% / 50%) -->
      <tr>
        <td colspan="2" class="sec-title">10. Выдача груза</td>
      </tr>
      <tr>
        <td class="input-cell-bold" style="text-align: center;">
          <div class="editable-field" contenteditable="true" data-field="unloadingAddress">${initialValues.unloadingAddress}</div>
        </td>
        <td class="input-cell"><div class="editable-field" contenteditable="true" data-field="unloadingPlannedAt">${initialValues.unloadingPlannedAt}</div></td>
      </tr>
      <tr>
        <td class="sub-prompt">(адрес места выгрузки)</td>
        <td class="sub-prompt">(заявленные дата и время подачи транспортного средства под выгрузку)</td>
      </tr>
      <tr>
        <td class="input-cell-bold" style="text-align: center;">
          <div class="editable-field" contenteditable="true" data-field="unloadingActualArrival">${initialValues.unloadingActualArrival}</div>
        </td>
        <td class="input-cell"><div class="editable-field" contenteditable="true" data-field="unloadingActualDeparture">${initialValues.unloadingActualDeparture}</div></td>
      </tr>
      <tr>
        <td class="sub-prompt">(фактические дата и время прибытия)</td>
        <td class="sub-prompt">(фактические дата и время убытия)</td>
      </tr>
      <tr>
        <td class="input-cell" style="text-align: center;">
          <div class="editable-field" contenteditable="true" data-field="cargoState">${initialValues.cargoState}</div>
        </td>
        <td class="input-cell-bold" style="text-align: center;">
          <div class="editable-field" contenteditable="true" data-field="cargoPlacesUnload">${initialValues.cargoPlacesUnload}</div>
        </td>
      </tr>
      <tr>
        <td class="sub-prompt">(фактическое состояние груза, тары, упаковки, маркировки, опломбирования)</td>
        <td class="sub-prompt">(количество грузовых мест)</td>
      </tr>
      <tr>
        <td class="input-cell-bold" style="text-align: center;">
          <div class="editable-field" contenteditable="true" data-field="unloadingWeight">${initialValues.unloadingWeight}</div>
        </td>
        <td class="input-cell"><div class="editable-field" contenteditable="true" data-field="unloadingRemarks">${initialValues.unloadingRemarks}</div></td>
      </tr>
      <tr>
        <td class="sub-prompt">(масса груза брутто в килограммах, масса груза нетто в килограммах (при возможности ее определения), плотность груза в соответствии с документацией на груз (при необходимости))</td>
        <td class="sub-prompt">(оговорки и замечания перевозчика (при наличии) о дате и времени прибытия/убытия, о состоянии груза, тары, упаковки, маркировки, опломбирования, о массе груза и количестве грузовых мест)</td>
      </tr>
      <tr>
        <td class="input-sign">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; padding: 0 4px;">
            <span style="font-weight: bold; font-size: 7pt;" class="editable-field" contenteditable="true" data-field="unloadingSignFio">${initialValues.unloadingSignFio}</span>
            <span>/ &nbsp;___________________</span>
          </div>
        </td>
        <td class="input-sign">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; padding: 0 4px;">
            <span style="font-weight: bold;" class="editable-field" contenteditable="true" data-field="driverUnloadSign">${initialValues.driverUnloadSign}</span>
            <span>/ &nbsp;___________________</span>
          </div>
        </td>
      </tr>
      <tr>
        <td class="sub-prompt">(должность, подпись, расшифровка подписи грузополучателя или уполномоченного грузоотправителем лица)</td>
        <td class="sub-prompt">(подпись, расшифровка подписи водителя, сдавшего груз грузополучателю или уполномоченному грузополучателем лицу)</td>
      </tr>

      <!-- Раздел 11. Отметки (3 колонки) -->
      <tr>
        <td colspan="2" class="sec-title" style="text-align: left; padding-left: 4px;">11. Отметки грузоотправителей, грузополучателей, перевозчиков (при необходимости)</td>
      </tr>
      <tr>
        <td colspan="2" style="padding: 0;">
          <table style="width: 100%; border-collapse: collapse; border: none;">
            <tr>
              <td style="width: 68%; border: none; border-right: 1px solid #000; height: 18px; padding: 2px 4px;">
                <div class="editable-field" contenteditable="true" data-field="actsNotes">${initialValues.actsNotes}</div>
              </td>
              <td style="width: 16%; border: none; border-right: 1px solid #000; height: 18px; padding: 2px 4px;">
                <div class="editable-field" contenteditable="true" data-field="penaltyNotes">${initialValues.penaltyNotes}</div>
              </td>
              <td style="width: 16%; border: none; height: 18px; padding: 2px 4px;">
                <div class="editable-field" contenteditable="true" data-field="signDateNotes">${initialValues.signDateNotes}</div>
              </td>
            </tr>
            <tr style="border-top: 1px solid #000;">
              <td style="border: none; border-right: 1px solid #000;" class="sub-prompt">
                (краткое описание обстоятельств, послуживших основанием для отметки, сведения о коммерческих и иных актах, в том числе о погрузке/выгрузке груза)
              </td>
              <td style="border: none; border-right: 1px solid #000;" class="sub-prompt">(расчет и размер штрафа)</td>
              <td style="border: none;" class="sub-prompt">(подпись, дата)</td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Раздел 12. Стоимость перевозки груза -->
      <tr>
        <td colspan="2" class="sec-title">12. Стоимость перевозки груза (установленная плата) в рублях (при необходимости)</td>
      </tr>
      <tr>
        <td colspan="2" style="padding: 0;">
          <table style="width: 100%; border-collapse: collapse; border: none;">
            <tr>
              <td style="width: 25%; border: none; border-right: 1px solid #000; height: 18px; text-align: center; font-weight: bold; font-size: 7.5pt;">
                <div class="editable-field" contenteditable="true" data-field="priceNoVat">${initialValues.priceNoVat}</div>
              </td>
              <td style="width: 25%; border: none; border-right: 1px solid #000; height: 18px; text-align: center; font-size: 7.5pt;">
                <div class="editable-field" contenteditable="true" data-field="vatRate">${initialValues.vatRate}</div>
              </td>
              <td style="width: 25%; border: none; border-right: 1px solid #000; height: 18px; text-align: center; font-size: 7.5pt;">
                <div class="editable-field" contenteditable="true" data-field="vatAmount">${initialValues.vatAmount}</div>
              </td>
              <td style="width: 25%; border: none; height: 18px; text-align: center; font-weight: bold; font-size: 7.5pt;">
                <div class="editable-field" contenteditable="true" data-field="priceTotal">${initialValues.priceTotal}</div>
              </td>
            </tr>
            <tr style="border-top: 1px solid #000;">
              <td style="border: none; border-right: 1px solid #000;" class="sub-prompt">(стоимость перевозки без налога - всего)</td>
              <td style="border: none; border-right: 1px solid #000;" class="sub-prompt">(налоговая ставка)</td>
              <td style="border: none; border-right: 1px solid #000;" class="sub-prompt">(сумма налога, предъявляемая покупателю)</td>
              <td style="border: none;" class="sub-prompt">(стоимость перевозки с налогом - всего)</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td colspan="2" class="input-cell"><div class="editable-field" contenteditable="true" data-field="calcMechanism">${initialValues.calcMechanism}</div></td>
      </tr>
      <tr>
        <td colspan="2" class="sub-prompt">(порядок (механизм) расчета (исчисления) платы) (при наличии порядка (механизма))</td>
      </tr>
      <tr>
        <td class="input-cell-bold">
          <div class="editable-field" contenteditable="true" data-field="carrierEcon">${initialValues.carrierEcon}</div>
        </td>
        <td class="input-cell-bold">
          <div class="editable-field" contenteditable="true" data-field="shipperEcon">${initialValues.shipperEcon}</div>
        </td>
      </tr>
      <tr>
        <td class="sub-prompt">(реквизиты, позволяющие идентифицировать Экономического субъекта, составляющего первичный учетный документ о факте хозяйственной жизни со стороны Перевозчика)</td>
        <td class="sub-prompt">(реквизиты, позволяющие идентифицировать Экономического субъекта, составляющего первичный учетный документ о факте хозяйственной жизни со стороны Грузоотправителя)</td>
      </tr>
      <tr>
        <td class="input-cell"><div class="editable-field" contenteditable="true" data-field="carrierBasis">${initialValues.carrierBasis}</div></td>
        <td class="input-cell"><div class="editable-field" contenteditable="true" data-field="shipperBasis">${initialValues.shipperBasis}</div></td>
      </tr>
      <tr>
        <td class="sub-prompt">(основание, по которому Экономический субъект является составителем документа о факте хозяйственной жизни)</td>
        <td class="sub-prompt">(основание, по которому Экономический субъект является составителем документа о факте хозяйственной жизни)</td>
      </tr>
      <tr>
        <td class="input-cell"><div class="editable-field" contenteditable="true" data-field="payerEmpty">${initialValues.payerEmpty}</div></td>
        <td class="input-cell-bold" style="text-align: right; padding-right: 8px;">
          <div class="editable-field" contenteditable="true" data-field="payerName">${initialValues.payerName}</div>
        </td>
      </tr>
      <tr>
        <td class="sub-prompt">&nbsp;</td>
        <td class="sub-prompt">(реквизиты, позволяющие идентифицировать лицо, от которого будут поступать денежные средства)</td>
      </tr>
      <tr>
        <td class="input-sign">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; padding: 0 4px;">
            <span style="font-weight: bold;" class="editable-field" contenteditable="true" data-field="carrierSign12">${initialValues.carrierSign12}</span>
            <span>/ &nbsp;___________________</span>
          </div>
        </td>
        <td class="input-sign">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; padding: 0 4px;">
            <span style="font-weight: bold;" class="editable-field" contenteditable="true" data-field="shipperSign12">${initialValues.shipperSign12}</span>
            <span>/ &nbsp;___________________</span>
          </div>
        </td>
      </tr>
      <tr>
        <td class="sub-prompt">(подпись, расшифровка подписи лица, ответственного за оформление факта хозяйственной жизни со стороны Перевозчика (уполномоченного лица))</td>
        <td class="sub-prompt">(подпись, расшифровка подписи лица, ответственного за оформление факта хозяйственной жизни со стороны Грузоотправителя (уполномоченного лица))</td>
      </tr>
      <tr>
        <td class="input-cell">
          <div class="editable-field" contenteditable="true" data-field="carrierPower">${initialValues.carrierPower}</div>
        </td>
        <td class="input-cell"><div class="editable-field" contenteditable="true" data-field="shipperPower">${initialValues.shipperPower}</div></td>
      </tr>
      <tr>
        <td class="sub-prompt">(должность, основание полномочий физического лица, уполномоченного Перевозчиком (уполномоченным лицом), дата подписания)</td>
        <td class="sub-prompt">(должность, основание полномочий физического лица, уполномоченного Грузоотправителем (уполномоченным лицом), дата подписания)</td>
      </tr>
    </table>
  </div>

  <script>
    const defaultData = ${defaultDataJson};

    function clearAllFields() {
      if (!confirm('Очистить все заполняемые поля и сделать бланк полностью пустым?')) return;
      document.querySelectorAll('.editable-field').forEach(el => {
        el.innerHTML = '&nbsp;';
      });
    }

    function resetDefaultData() {
      document.querySelectorAll('.editable-field').forEach(el => {
        const field = el.getAttribute('data-field');
        if (field && defaultData[field] !== undefined) {
          el.innerHTML = defaultData[field];
        }
      });
    }
  </script>
</body>
</html>`;
}
