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
    @page {
      size: A4 portrait;
      margin: 8mm 10mm;
    }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 10pt;
      line-height: 1.15;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 10px;
    }
    .print-hide {
      margin-bottom: 12px;
      padding: 8px 12px;
      background: #1e293b;
      color: #fff;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: sans-serif;
      font-size: 12px;
    }
    .btn-print {
      background: #2563eb;
      color: #fff;
      border: none;
      padding: 6px 14px;
      font-weight: bold;
      border-radius: 6px;
      cursor: pointer;
    }
    @media print {
      .print-hide { display: none !important; }
      body { padding: 0; }
      .page-break { page-break-before: always; }
    }
    .top-header {
      text-align: right;
      font-size: 7.5pt;
      margin-bottom: 4px;
    }
    .doc-title {
      text-align: center;
      font-size: 11pt;
      font-weight: bold;
      text-transform: uppercase;
      margin: 4px 0 8px 0;
    }
    table.tn-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 6px;
    }
    table.tn-table td, table.tn-table th {
      border: 1px solid #000;
      padding: 3px 5px;
      vertical-align: top;
      font-size: 8.5pt;
    }
    .section-title {
      font-weight: bold;
      background-color: #f1f5f9;
      text-align: center;
      font-size: 8.5pt;
    }
    .label-hint {
      display: block;
      font-size: 6.5pt;
      color: #475569;
      text-align: center;
      line-height: 1;
      margin-top: 2px;
    }
    .bold { font-weight: bold; }
    .sign-row {
      display: flex;
      justify-content: space-between;
      margin-top: 6px;
      font-size: 8pt;
    }
    .sign-box {
      width: 48%;
      border-top: 1px solid #000;
      text-align: center;
      padding-top: 2px;
    }
  </style>
</head>
<body>

  <div class="print-hide">
    <div><strong>Транспортная накладная (Форма ПП РФ № 2116)</strong> | Заявка № ${data.orderNumber} от ${data.orderDate}</div>
    <button class="btn-print" onclick="window.print()">🖨️ Печать / Сохранить в PDF</button>
  </div>

  <div class="top-header">
    Приложение № 4 к Правилам перевозок грузов автомобильным транспортом<br>
    (в ред. Постановления Правительства РФ от 30.11.2021 № 2116)
  </div>

  <div class="doc-title">
    ТРАНСПОРТНАЯ НАКЛАДНАЯ (ФОРМА)<br>
    <span style="font-size: 9pt; font-weight: normal;">№ ${data.orderNumber} от ${data.orderDate} г.</span>
  </div>

  <table class="tn-table">
    <tr>
      <td style="width: 50%;">
        <div class="bold">1. Грузоотправитель:</div>
        <div>${data.shipper.name}, ИНН ${data.shipper.inn}${data.shipper.kpp ? ', КПП ' + data.shipper.kpp : ''}</div>
        <div>Адрес: ${data.shipper.address}</div>
        <div>Тел: ${data.shipper.phone || '—'}</div>
        <div style="margin-top: 2px;">Является экспедитором: <b>${data.shipper.isForwarder ? '[X] ДА' : '[ ] НЕТ'}</b></div>
      </td>
      <td style="width: 50%;">
        <div class="bold">1а. Заказчик услуг по организации перевозки груза:</div>
        <div>${data.client.name}, ИНН ${data.client.inn}</div>
        <div>Основание: ${contractInfo}</div>
        <div>Адрес: ${data.client.address}</div>
      </td>
    </tr>

    <tr>
      <td colspan="2">
        <div class="bold">2. Грузополучатель:</div>
        <div>${data.consignee.name}, ИНН ${data.consignee.inn}</div>
        <div>Адрес места доставки груза: <b>${data.consignee.deliveryAddress}</b></div>
        <div>Тел: ${data.consignee.phone || '—'}</div>
      </td>
    </tr>

    <tr>
      <td colspan="2">
        <div class="bold">3. Груз:</div>
        <div>Наименование: <b>${data.cargo.name}</b></div>
        <div>Количество грузовых мест: <b>${data.cargo.placesCount}</b>; Упаковка: <b>${data.cargo.packagingType || 'палетты'}</b></div>
        <div>Масса брутто: <b>${data.cargo.weightGrossKg} кг</b> ${data.cargo.weightNetKg ? `(нетто: ${data.cargo.weightNetKg} кг)` : ''} ${data.cargo.dimensionsText ? `| Размеры: ${data.cargo.dimensionsText}` : ''}</div>
        <div>Объявленная стоимость: ${data.cargo.declaredValue ? data.cargo.declaredValue.toLocaleString('ru-RU') + ' руб.' : 'Без объявления стоимости'}</div>
      </td>
    </tr>

    <tr>
      <td colspan="2">
        <div class="bold">4. Сопроводительные документы на груз (при наличии):</div>
        <div>Сертификат качества / Паспорт изделия, Поручение экспедитору № ${data.orderNumber} от ${data.orderDate}</div>
      </td>
    </tr>

    <tr>
      <td colspan="2">
        <div class="bold">5. Указания грузоотправителя по особым условиям перевозки:</div>
        <div>Соблюдение правил транспортировки металлопроката и фиксации груза ремнями. Запрет несанкционированной перегрузки.</div>
      </td>
    </tr>

    <tr>
      <td style="width: 50%;">
        <div class="bold">6. Перевозчик:</div>
        <div><b>${data.carrier.name}</b></div>
        <div>ИНН: ${data.carrier.inn} ${data.carrier.ogrnip ? '| ОГРНИП: ' + data.carrier.ogrnip : ''}</div>
        <div>Адрес: ${data.carrier.address}</div>
        <div>Тел: ${data.carrier.phone}</div>
      </td>
      <td style="width: 50%;">
        <div class="bold">Водитель:</div>
        <div>ФИО: <b>${data.driver.fio}</b></div>
        <div>ВУ: серия <b>${data.driver.licenseSeries || '—'}</b> № <b>${data.driver.licenseNumber || '—'}</b></div>
        <div>Тел: ${data.driver.phone || '—'}</div>
      </td>
    </tr>

    <tr>
      <td colspan="2">
        <div class="bold">7. Транспортное средство:</div>
        <div>Тип: <b>${data.vehicle.bodyType || 'Грузовой автомобиль'}</b>, Марка: <b>${data.vehicle.brandName || 'Валдай'}</b>, Гос. рег. номер: <b>${data.vehicle.regNumber}</b></div>
        <div>Грузоподъемность: <b>${data.vehicle.payloadTons || '3.1'} т</b>, Вместимость: <b>${data.vehicle.capacityM3 || '40'} м³</b></div>
        <div>Тип владения: <b>[X] 1 - собственность</b>; [ ] 2 - совместная; [ ] 3 - аренда; [ ] 4 - лизинг</div>
      </td>
    </tr>

    <tr>
      <td colspan="2" class="section-title">8. Прием груза</td>
    </tr>
    <tr>
      <td colspan="2">
        <div>Лицо, осуществляющее погрузку: <b>${data.loading.orgName} ${data.loading.orgInn ? '(ИНН ' + data.loading.orgInn + ')' : ''}</b></div>
        <div>Адрес места погрузки: <b>${data.loading.address}</b></div>
        <div style="margin-top: 3px;">Плановое время подачи: <b>${data.loading.plannedAt || '—'}</b> | Фактическое время: <b>${data.loading.actualArrivalAt || '—'} — ${data.loading.actualDepartureAt || '—'}</b></div>
        <div style="margin-top: 3px;">Масса груза брутто: <b>${data.cargo.weightGrossKg} кг</b> | Количество мест: <b>${data.cargo.placesCount}</b></div>
        
        <div class="sign-row" style="margin-top: 15px;">
          <div class="sign-box">
            <div>${data.loading.contactFio || 'Гончарова М.В.'} / ______________________</div>
            <div class="label-hint">(подпись, расшифровка лица, осуществившего погрузку)</div>
          </div>
          <div class="sign-box">
            <div>${data.driver.fio} / ______________________</div>
            <div class="label-hint">(подпись, расшифровка подписи водителя, принявшего груз)</div>
          </div>
        </div>
      </td>
    </tr>
  </table>

  <!-- ВТОРАЯ СТРАНИЦА ТН -->
  <div class="page-break"></div>

  <div class="top-header" style="margin-top: 10px;">
    Транспортная накладная № ${data.orderNumber} (Страница 2)
  </div>

  <table class="tn-table">
    <tr>
      <td colspan="2" class="section-title">9. Переадресовка (при наличии)</td>
    </tr>
    <tr>
      <td colspan="2" style="height: 35px; color: #64748b; font-style: italic;">
        Отметки о переадресовке отсутствуют
      </td>
    </tr>

    <tr>
      <td colspan="2" class="section-title">10. Выдача груза</td>
    </tr>
    <tr>
      <td colspan="2">
        <div>Адрес места выгрузки: <b>${data.unloading.address}</b></div>
        <div style="margin-top: 3px;">Плановое время подачи: <b>${data.unloading.plannedAt || '—'}</b> | Фактическое время: <b>${data.unloading.actualArrivalAt || '—'} — ${data.unloading.actualDepartureAt || '—'}</b></div>
        <div style="margin-top: 3px;">Фактическое состояние груза: <b>без повреждений</b>; Количество мест: <b>${data.cargo.placesCount}</b></div>

        <div class="sign-row" style="margin-top: 25px;">
          <div class="sign-box">
            <div>${data.unloading.contactFio || 'Кладовщик'} / ______________________</div>
            <div class="label-hint">(подпись, расшифровка подписи грузополучателя, принявшего груз)</div>
          </div>
          <div class="sign-box">
            <div>${data.driver.fio} / ______________________</div>
            <div class="label-hint">(подпись, расшифровка подписи водителя, сдавшего груз)</div>
          </div>
        </div>
      </td>
    </tr>

    <tr>
      <td colspan="2" class="section-title">11. Отметки грузоотправителей, грузополучателей, перевозчиков</td>
    </tr>
    <tr>
      <td colspan="2" style="height: 35px; color: #64748b; font-style: italic;">
        Претензии по количеству мест и состоянию груза отсутствуют.
      </td>
    </tr>

    <tr>
      <td colspan="2" class="section-title">12. Стоимость перевозки груза (установленная плата) в рублях</td>
    </tr>
    <tr>
      <td colspan="2">
        <table style="width: 100%; border-collapse: collapse; text-align: center;">
          <tr>
            <th style="border: 1px solid #000; padding: 4px;">Стоимость без налога</th>
            <th style="border: 1px solid #000; padding: 4px;">Налоговая ставка</th>
            <th style="border: 1px solid #000; padding: 4px;">Сумма налога</th>
            <th style="border: 1px solid #000; padding: 4px;">Стоимость с налогом всего</th>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 6px; font-weight: bold;">${data.finance.priceWithoutVat.toLocaleString('ru-RU')} руб.</td>
            <td style="border: 1px solid #000; padding: 6px;">${data.finance.vatRate || 'без НДС'}</td>
            <td style="border: 1px solid #000; padding: 6px;">0 руб.</td>
            <td style="border: 1px solid #000; padding: 6px; font-weight: bold;">${totalCost.toLocaleString('ru-RU')} руб.</td>
          </tr>
        </table>

        <div style="margin-top: 15px; font-size: 8pt;">
          <div><b>Основание составления:</b> Договор-заявка / Поручение экспедитору № ${data.orderNumber} от ${data.orderDate} г.</div>
          <div>Оплата производится по безналичному расчету в соответствии с условиями договора.</div>
        </div>

        <div class="sign-row" style="margin-top: 35px;">
          <div class="sign-box">
            <div>ИП Нигамедьянов А.С. / ______________________</div>
            <div class="label-hint">(подпись лица, ответственного за оформление со стороны Перевозчика)</div>
          </div>
          <div class="sign-box">
            <div>Представитель заказчика / ______________________</div>
            <div class="label-hint">(подпись лица, ответственного со стороны Грузоотправителя / Заказчика)</div>
          </div>
        </div>
      </td>
    </tr>
  </table>

</body>
</html>`;
}
