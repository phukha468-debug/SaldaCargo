export interface WaybillData {
  series: string;
  number: string;
  date: string; // YYYY-MM-DD или DD.MM.YYYY

  organization: {
    name: string;
    inn: string;
    ogrnip: string;
    address: string;
    phone: string;
  };

  vehicle: {
    brand: string;
    regNumber: string;
    garageNumber?: string;
    fuelType?: string;
    fuelNorm?: number;
  };

  driver: {
    fio: string;
    tabNumber?: string;
    licenseSeries?: string;
    licenseNumber?: string;
    licenseClass?: string;
  };

  assignment: {
    clientName: string;
    loadingAddress: string;
    unloadingAddress: string;
    cargoName: string;
    weightTons: number;
    tripsCount: number;
    distanceKm?: number;
  };

  // Фаза 1 и Фаза 2: Выезд и возвращение
  execution: {
    phase: 'planned' | 'departed' | 'completed';
    plannedDeparture?: string;
    actualDeparture?: string;
    actualArrival?: string;
    odometerStart?: number;
    odometerEnd?: number;
    fuelStartLiters?: number;
    fuelGivenLiters?: number;
    fuelEndLiters?: number;
  };

  dispatchAndControl: {
    mechanicFio: string;
    dispatcherFio: string;
    medicName?: string;
  };
}

function formatDateRu(dStr?: string): string {
  if (!dStr) return '';
  if (dStr.includes('.')) return dStr;
  const datePart = dStr.split('T')[0] || dStr;
  const parts = datePart.split('-');
  return `${parts[2] || '01'}.${parts[1] || '01'}.${parts[0] || '2026'}`;
}

function formatTimeOnly(dtStr?: string): string {
  if (!dtStr) return '';
  const d = new Date(dtStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function generateWaybill4cHtml(data: WaybillData): string {
  const isCompleted = data.execution.phase === 'completed';
  const isDeparted = data.execution.phase === 'departed' || isCompleted;

  const dateRu = formatDateRu(data.date);
  const departTime = isDeparted ? formatTimeOnly(data.execution.actualDeparture) : '08:00';
  const returnTime = isCompleted ? formatTimeOnly(data.execution.actualArrival) : '';

  const distance =
    data.assignment.distanceKm ||
    (isCompleted && data.execution.odometerStart && data.execution.odometerEnd
      ? data.execution.odometerEnd - data.execution.odometerStart
      : 0);

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Путевой лист № ${data.number}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 8mm;
    }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 8.5pt;
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
      background: #059669;
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
    }
    .top-legend {
      display: flex;
      justify-content: space-between;
      font-size: 7.5pt;
      margin-bottom: 4px;
    }
    .title-block {
      text-align: center;
      margin: 4px 0 10px 0;
    }
    .title-main {
      font-size: 12pt;
      font-weight: bold;
      text-transform: uppercase;
    }
    .stamp-box {
      border: 1px dashed #334155;
      padding: 6px;
      text-align: center;
      width: 140px;
      font-size: 7pt;
      border-radius: 4px;
    }
    table.grid {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 6px;
    }
    table.grid td, table.grid th {
      border: 1px solid #000;
      padding: 2.5px 4px;
      font-size: 8pt;
      vertical-align: middle;
    }
    th.center, td.center { text-align: center; }
    .bg-gray { background-color: #f8fafc; font-weight: bold; }
    .sub-hint { font-size: 6pt; color: #475569; text-align: center; display: block; line-height: 1; }
    .border-b { border-bottom: 1px solid #000; display: inline-block; min-width: 80px; text-align: center; font-weight: bold; }
  </style>
</head>
<body>

  <div class="print-hide">
    <div><strong>Путевой лист грузового автомобиля № 4-С (ОКУД 0345004)</strong> | Статус рейса: <b>${data.execution.phase.toUpperCase()}</b></div>
    <button class="btn-print" onclick="window.print()">🖨️ Печать / Сохранить в PDF</button>
  </div>

  <div class="top-legend">
    <div class="stamp-box">
      Место для штампа<br>организации
    </div>
    <div style="text-align: right;">
      Типовая межотраслевая форма № 4-С<br>
      Утверждена постановлением Госкомстата России от 28.11.97 № 78<br>
      <b>Форма по ОКУД 0345004</b>
    </div>
  </div>

  <div class="title-block">
    <div class="title-main">ПУТЕВОЙ ЛИСТ № ${data.number}</div>
    <div style="font-size: 10pt; font-weight: bold;">грузового автомобиля серия ${data.series} «${dateRu}» г.</div>
  </div>

  <table class="grid">
    <tr>
      <td style="width: 20%;" class="bg-gray">Организация:</td>
      <td colspan="3"><b>${data.organization.name}</b>, ИНН: ${data.organization.inn}, ОГРНИП: ${data.organization.ogrnip}, Адрес: ${data.organization.address}, Тел: ${data.organization.phone}</td>
    </tr>
    <tr>
      <td class="bg-gray">Автомобиль:</td>
      <td style="width: 30%;">Марка: <b>${data.vehicle.brand}</b>, рег. знак: <b>${data.vehicle.regNumber}</b></td>
      <td style="width: 20%;" class="bg-gray">Гаражный номер:</td>
      <td style="width: 30%;"><b>${data.vehicle.garageNumber || '096'}</b></td>
    </tr>
    <tr>
      <td class="bg-gray">Водитель:</td>
      <td><b>${data.driver.fio}</b> (Таб. № ${data.driver.tabNumber || '—'})</td>
      <td class="bg-gray">Удостоверение (ВУ):</td>
      <td>Серия <b>${data.driver.licenseSeries || '—'}</b> № <b>${data.driver.licenseNumber || '—'}</b>, Класс <b>${data.driver.licenseClass || 'C'}</b></td>
    </tr>
  </table>

  <!-- РАБОТА ВОДИТЕЛЯ И АВТОМОБИЛЯ -->
  <table class="grid">
    <tr class="bg-gray center">
      <th rowspan="2" style="width: 25%;">Операция</th>
      <th colspan="2">Время по графику</th>
      <th colspan="2">Время фактическое</th>
      <th rowspan="2">Нулевой пробег, км</th>
      <th rowspan="2">Показания спидометра (одометр)</th>
    </tr>
    <tr class="bg-gray center">
      <th>число, месяц</th>
      <th>ч, мин</th>
      <th>число, месяц</th>
      <th>ч, мин</th>
    </tr>
    <tr>
      <td><b>выезд из гаража</b></td>
      <td class="center">${dateRu}</td>
      <td class="center">08:00</td>
      <td class="center">${isDeparted ? dateRu : ''}</td>
      <td class="center"><b>${departTime}</b></td>
      <td class="center">0</td>
      <td class="center"><b>${data.execution.odometerStart || '—'}</b> км</td>
    </tr>
    <tr>
      <td><b>возвращение в гараж</b></td>
      <td class="center">${dateRu}</td>
      <td class="center">18:00</td>
      <td class="center">${isCompleted ? dateRu : ''}</td>
      <td class="center"><b>${returnTime}</b></td>
      <td class="center">0</td>
      <td class="center"><b>${data.execution.odometerEnd ? data.execution.odometerEnd + ' км' : isCompleted ? '—' : ''}</b></td>
    </tr>
  </table>

  <!-- ДВИЖЕНИЕ ГОРЮЧЕГО -->
  <table class="grid">
    <tr class="bg-gray center">
      <th>Марка горючего</th>
      <th>Выдано, л</th>
      <th>Остаток при выезде, л</th>
      <th>Остаток при возвращении, л</th>
      <th>Сдано, л</th>
      <th>Подпись заправщика / механика</th>
    </tr>
    <tr class="center">
      <td><b>${data.vehicle.fuelType || 'ДТ'}</b></td>
      <td><b>${data.execution.fuelGivenLiters || 150}</b></td>
      <td><b>${data.execution.fuelStartLiters || 150}</b></td>
      <td><b>${isCompleted ? (data.execution.fuelEndLiters ?? 10) : ''}</b></td>
      <td>0</td>
      <td>Шахмаев А.О. / ____________</td>
    </tr>
  </table>

  <!-- ЗАДАНИЕ ВОДИТЕЛЮ -->
  <div style="font-weight: bold; margin: 6px 0 2px 0; text-transform: uppercase; font-size: 8.5pt;">Задание водителю:</div>
  <table class="grid">
    <tr class="bg-gray center">
      <th>В чье распоряжение (Заказчик)</th>
      <th>Адрес пункта погрузки</th>
      <th>Адрес пункта разгрузки</th>
      <th>Наименование груза</th>
      <th>Кол-во ездок</th>
      <th>Расстояние, км</th>
      <th>Перевезти тонн</th>
    </tr>
    <tr>
      <td><b>${data.assignment.clientName}</b></td>
      <td>${data.assignment.loadingAddress}</td>
      <td>${data.assignment.unloadingAddress}</td>
      <td><b>${data.assignment.cargoName}</b></td>
      <td class="center"><b>${data.assignment.tripsCount || 1}</b></td>
      <td class="center"><b>${distance ? distance + ' км' : '—'}</b></td>
      <td class="center"><b>${data.assignment.weightTons ? data.assignment.weightTons.toFixed(2) + ' т' : '—'}</b></td>
    </tr>
  </table>

  <!-- МЕДОСМОТР И ТЕХКОНТРОЛЬ -->
  <table class="grid" style="margin-top: 8px;">
    <tr>
      <td style="width: 50%; padding: 6px;">
        <div style="border: 1px solid #000; padding: 4px; text-align: center; margin-bottom: 4px;">
          <b>МЕДИЦИНСКИЙ ОСМОТР</b><br>
          Прошел предрейсовый медицинский осмотр,<br>к исполнению трудовых обязанностей допущен.<br>
          Дата: <b>${dateRu}</b> Время: <b>${isDeparted ? departTime : '07:45'}</b><br>
          Медработник: _________________ / Шахмаев А.О. /
        </div>
        <div>Водительское удостоверение проверил, задание выдал:</div>
        <div>Диспетчер: <b>${data.dispatchAndControl.dispatcherFio}</b> / _________________</div>
      </td>
      <td style="width: 50%; padding: 6px;">
        <div style="border: 1px solid #000; padding: 4px; text-align: center; margin-bottom: 4px;">
          <b>КОНТРОЛЬ ТЕХНИЧЕСКОГО СОСТОЯНИЯ</b><br>
          Предрейсовый контроль технического состояния транспортного средства пройден, выезд разрешен.<br>
          Дата: <b>${dateRu}</b> Время: <b>${isDeparted ? departTime : '07:50'}</b><br>
          Контролер (механик): _________________ / ${data.dispatchAndControl.mechanicFio} /
        </div>
        <div>Автомобиль в технически исправном состоянии принял:</div>
        <div>Водитель: <b>${data.driver.fio}</b> / _________________</div>
      </td>
    </tr>
    ${
      isCompleted
        ? `
    <tr>
      <td colspan="2" style="padding: 6px; background-color: #f8fafc;">
        <div style="display: flex; justify-content: space-between;">
          <div>При возвращении автомобиль сдал водитель: <b>${data.driver.fio}</b> / ______________</div>
          <div>Принял механик: <b>${data.dispatchAndControl.mechanicFio}</b> / ______________</div>
        </div>
      </td>
    </tr>`
        : ''
    }
  </table>

</body>
</html>`;
}
