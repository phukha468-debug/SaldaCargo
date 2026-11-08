export interface WaybillRouteItem {
  clientName?: string;
  arrivalTime?: string;
  loadingAddress?: string;
  unloadingAddress?: string;
  cargoName?: string;
  tripsCount?: number;
  distanceKm?: number;
  weightTons?: number;
}

export interface WaybillData {
  series: string;
  number: string;
  date: string; // YYYY-MM-DD или DD.MM.YYYY

  organization: {
    name: string;
    inn?: string;
    ogrnip?: string;
    okpo?: string;
    address: string;
    phone: string;
  };

  vehicle: {
    brand: string;
    regNumber: string;
    garageNumber?: string;
    trailerBrand?: string;
    trailerRegNumber?: string;
    trailerGarageNumber?: string;
    fuelType?: string;
    fuelCode?: string;
    fuelNorm?: number;
  };

  driver: {
    fio: string;
    tabNumber?: string;
    licenseSeries?: string;
    licenseNumber?: string;
    licenseClass?: string;
    licenseCard?: string;
  };

  assignment: {
    clientName: string;
    loadingAddress: string;
    unloadingAddress: string;
    cargoName: string;
    weightTons: number;
    tripsCount: number;
    distanceKm?: number;
    arrivalPlanned?: string;
    departurePlanned?: string;
  };

  // Поддержка до 3 маршрутов в путевом листе
  routes?: WaybillRouteItem[];

  // Фаза 1 и Фаза 2: Выезд и возвращение
  execution: {
    phase: 'planned' | 'departed' | 'completed';
    plannedDeparture?: string;
    plannedArrival?: string;
    actualDeparture?: string;
    actualArrival?: string;
    odometerStart?: number;
    odometerEnd?: number;
    fuelStartLiters?: number;
    fuelGivenLiters?: number;
    fuelEndLiters?: number;
    fuelConsumedNorm?: number;
    fuelConsumedActual?: number;
    fuelSaved?: number;
    fuelOverrun?: number;
    timeTotal?: string;
    timeInMotion?: string;
    timeIdle?: string;
  };

  dispatchAndControl: {
    mechanicFio: string;
    dispatcherFio: string;
    medicName?: string;
    medicCheckTime?: string;
    techCheckTime?: string;
  };

  salary?: {
    timePay?: string;
    mileagePay?: string;
    forwardingPay?: string;
    dailyPay?: string;
    totalPay?: string;
    calculatorFio?: string;
    accountantFio?: string;
  };

  specialNotes?: string;
}

function parseDateParts(dStr?: string) {
  const ruMonths = [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
  ];
  if (!dStr)
    return {
      day: '02',
      month: 'ноября',
      monthNum: '11',
      year: '26',
      dayMonth: '02.11',
      full: '02.11.2026',
    };

  let day = '02';
  let month = 'ноября';
  let monthNum = '11';
  let year = '26';
  let dayMonth = '02.11';
  let full = '02.11.2026';

  if (dStr.includes('.')) {
    const p = dStr.split('.');
    day = String(p[0] || '02').padStart(2, '0');
    const mNum = parseInt(p[1] || '11', 10);
    monthNum = String(mNum).padStart(2, '0');
    month = ruMonths[mNum - 1] || 'ноября';
    year = (p[2] || '2026').slice(-2);
    dayMonth = `${day}.${monthNum}`;
    full = `${day}.${monthNum}.${p[2] || '2026'}`;
  } else {
    const datePart = dStr.split('T')[0] || dStr;
    const p = datePart.split('-');
    year = (p[0] || '2026').slice(-2);
    const mNum = parseInt(p[1] || '11', 10);
    monthNum = String(mNum).padStart(2, '0');
    month = ruMonths[mNum - 1] || 'ноября';
    day = String(p[2] || '02').padStart(2, '0');
    dayMonth = `${day}.${monthNum}`;
    full = `${day}.${monthNum}.${p[0] || '2026'}`;
  }
  return { day, month, monthNum, year, dayMonth, full };
}

function formatTimeOnly(dtStr?: string, fallback = '08:00'): string {
  if (!dtStr) return fallback;
  if (/^\d{2}:\d{2}$/.test(dtStr)) return dtStr;
  const d = new Date(dtStr);
  if (isNaN(d.getTime())) return fallback;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getSurname(fio?: string, fallback = 'Никифоров'): string {
  if (!fio) return fallback;
  return fio.trim().split(/\s+/)[0] || fallback;
}

export function generateWaybill4cHtml(data: WaybillData, options?: { isEmpty?: boolean }): string {
  const isInitiallyEmpty = options?.isEmpty ?? false;
  const isCompleted = data.execution.phase === 'completed';
  const isDeparted = data.execution.phase === 'departed' || isCompleted;

  const dateParts = parseDateParts(data.date);
  const series = data.series || '26';
  const number = data.number || '10676';

  const plannedDepTime = formatTimeOnly(data.execution.plannedDeparture, '08:00');
  const plannedArrTime = formatTimeOnly(data.execution.plannedArrival, '18:00');
  const depParts = plannedDepTime.split(':');
  const arrParts = plannedArrTime.split(':');

  const actualDepTime = isDeparted ? formatTimeOnly(data.execution.actualDeparture, '08:00') : '';
  const actualArrTime = isCompleted ? formatTimeOnly(data.execution.actualArrival, '17:35') : '';

  const odoStart =
    data.execution.odometerStart !== undefined ? String(data.execution.odometerStart) : '120 500';
  const odoEnd =
    isCompleted && data.execution.odometerEnd !== undefined
      ? String(data.execution.odometerEnd)
      : isCompleted
        ? '120 850'
        : '';

  const distance =
    data.assignment.distanceKm ||
    (isCompleted && data.execution.odometerStart && data.execution.odometerEnd
      ? data.execution.odometerEnd - data.execution.odometerStart
      : 350);

  const fuelGiven = data.execution.fuelGivenLiters ?? 150;
  const fuelStart = data.execution.fuelStartLiters ?? 45;
  const fuelEnd = isCompleted ? (data.execution.fuelEndLiters ?? 65) : '';

  const licenseFull =
    [data.driver.licenseSeries, data.driver.licenseNumber].filter(Boolean).join(' ') ||
    '99 45 273350';

  const driverSurname = getSurname(data.driver.fio, 'Никифоров');
  const dispSurname = getSurname(data.dispatchAndControl.dispatcherFio, 'Шахмаев');
  const mechSurname = getSurname(data.dispatchAndControl.mechanicFio, 'Нигомедьянов');
  const medSurname = getSurname(data.dispatchAndControl.medicName, 'Шахмаева');

  const orgAddressPhone = [
    data.organization.name || 'ИП Нигамедьянов Александр Сергеевич',
    data.organization.address ||
      '624760, Свердловская обл., г. Верхняя Салда, ул. 25 Октября, д. 11, кв. 22',
    data.organization.phone ? `тел. ${data.organization.phone}` : '',
  ]
    .filter(Boolean)
    .join(', ');

  // Маршруты (до 3 строк задания водителю)
  const route1: WaybillRouteItem = data.routes?.[0] || {
    clientName: data.assignment.clientName || 'ПАО «Корпорация ВСМПО-АВИСМА»',
    arrivalTime: data.assignment.arrivalPlanned || '09:30',
    loadingAddress: data.assignment.loadingAddress || 'г. Заречный, промзона БЗСК, д 2',
    unloadingAddress: data.assignment.unloadingAddress || 'г. Верхняя Салда, ул. Парковая, д 1',
    cargoName: data.assignment.cargoName || 'Металлопрокат',
    tripsCount: data.assignment.tripsCount || 1,
    distanceKm: distance,
    weightTons: data.assignment.weightTons || 3.1,
  };

  const route2: WaybillRouteItem = data.routes?.[1] || {};
  const route3: WaybillRouteItem = data.routes?.[2] || {};
  const route4: WaybillRouteItem = data.routes?.[3] || {};
  const route5: WaybillRouteItem = data.routes?.[4] || {};
  const route6: WaybillRouteItem = data.routes?.[5] || {};

  const totalTons =
    (route1.weightTons || 0) +
      (route2.weightTons || 0) +
      (route3.weightTons || 0) +
      (route4.weightTons || 0) +
      (route5.weightTons || 0) +
      (route6.weightTons || 0) ||
    data.assignment.weightTons ||
    3.1;
  const totalTonsFormatted = totalTons ? totalTons.toFixed(2) : '';

  const defaultFields: Record<string, string> = {
    docSeries: series,
    docNumber: number,
    docDay: dateParts.day,
    docMonth: dateParts.month,
    docYear: dateParts.year,

    orgAddressPhone,
    okpo: data.organization.okpo || '32166580',

    // Колонки таблицы Код
    code_workMode: '1',
    code_col: '1',
    code_brig: '1',
    vehGarage: data.vehicle.garageNumber || '096',
    driverTab: data.driver.tabNumber || '096',

    vehBrand: data.vehicle.brand || 'ГАЗ 2834-LM (Валдай)',
    vehReg: data.vehicle.regNumber || 'О 188 ТА 196',

    driverFio: data.driver.fio || 'Никифоров Д.В.',
    driverLic: licenseFull,
    driverClass: data.driver.licenseClass || 'B, C, CE',

    licRegNum: 'СТ-66/096',
    licSeries: 'АА',
    licNumber: '014829',

    pr1_brand: data.vehicle.trailerBrand || '—',
    pr1_reg: data.vehicle.trailerRegNumber || '—',
    code_pr1: data.vehicle.trailerGarageNumber || '—',

    pr2_brand: '—',
    pr2_reg: '—',
    code_pr2: '—',

    pr3_brand: '—',
    pr3_reg: '—',
    code_pr3: '—',

    pr4_brand: '—',
    pr4_reg: '—',
    code_pr4: '—',

    escortPersons: '—',

    // Таблица 1: Работа водителя и автомобиля
    t1_dep_day: dateParts.day,
    t1_dep_month: dateParts.monthNum,
    t1_dep_h: depParts[0] || '08',
    t1_dep_m: depParts[1] || '00',
    t1_dep_zero: '0',
    t1_odo_start: odoStart,
    t1_act_dep: actualDepTime ? `${dateParts.dayMonth} ${actualDepTime}` : '',

    t1_arr_day: dateParts.day,
    t1_arr_month: dateParts.monthNum,
    t1_arr_h: arrParts[0] || '18',
    t1_arr_m: arrParts[1] || '00',
    t1_arr_zero: '0',
    t1_odo_end: odoEnd,
    t1_act_arr: actualArrTime ? `${dateParts.dayMonth} ${actualArrTime}` : '',

    // Таблица 2: Движение горючего
    t2_fuelBrand: data.vehicle.fuelType || 'ДТ',
    t2_fuelCode: data.vehicle.fuelCode || '03',
    t2_fuelGiven: String(fuelGiven),
    t2_fuelStart: String(fuelStart),
    t2_fuelEnd: isCompleted ? String(fuelEnd) : '',
    t2_fuelReturn: '0',
    t2_fuelCoeff: '—',
    t2_specTime: '—',
    t2_engTime: isCompleted ? '08:30' : '—',

    t2_sig_refueler: dispSurname,
    t2_sig_mech_out: mechSurname,
    t2_sig_mech_in: isCompleted ? mechSurname : '',
    t2_sig_refueler_ret: isCompleted ? dispSurname : '',
    t2_sig_disp: dispSurname,

    // Таблица 3: Задание водителю (3 строки)
    t3_client_1: route1.clientName || '',
    t3_arr_time_1: route1.arrivalTime || '',
    t3_load_addr_1: route1.loadingAddress || '',
    t3_unload_addr_1: route1.unloadingAddress || '',
    t3_cargo_1: route1.cargoName || '',
    t3_trips_1: route1.tripsCount ? String(route1.tripsCount) : '',
    t3_dist_1: route1.distanceKm ? String(route1.distanceKm) : '',
    t3_tons_1: route1.weightTons ? route1.weightTons.toFixed(2) : '',

    t3_client_2: route2.clientName || '',
    t3_arr_time_2: route2.arrivalTime || '',
    t3_load_addr_2: route2.loadingAddress || '',
    t3_unload_addr_2: route2.unloadingAddress || '',
    t3_cargo_2: route2.cargoName || '',
    t3_trips_2: route2.tripsCount ? String(route2.tripsCount) : '',
    t3_dist_2: route2.distanceKm ? String(route2.distanceKm) : '',
    t3_tons_2: route2.weightTons ? route2.weightTons.toFixed(2) : '',

    t3_client_3: route3.clientName || '',
    t3_arr_time_3: route3.arrivalTime || '',
    t3_load_addr_3: route3.loadingAddress || '',
    t3_unload_addr_3: route3.unloadingAddress || '',
    t3_cargo_3: route3.cargoName || '',
    t3_trips_3: route3.tripsCount ? String(route3.tripsCount) : '',
    t3_dist_3: route3.distanceKm ? String(route3.distanceKm) : '',
    t3_tons_3: route3.weightTons ? route3.weightTons.toFixed(2) : '',

    t3_client_4: route4.clientName || '',
    t3_arr_time_4: route4.arrivalTime || '',
    t3_load_addr_4: route4.loadingAddress || '',
    t3_unload_addr_4: route4.unloadingAddress || '',
    t3_cargo_4: route4.cargoName || '',
    t3_trips_4: route4.tripsCount ? String(route4.tripsCount) : '',
    t3_dist_4: route4.distanceKm ? String(route4.distanceKm) : '',
    t3_tons_4: route4.weightTons ? route4.weightTons.toFixed(2) : '',

    t3_client_5: route5.clientName || '',
    t3_arr_time_5: route5.arrivalTime || '',
    t3_load_addr_5: route5.loadingAddress || '',
    t3_unload_addr_5: route5.unloadingAddress || '',
    t3_cargo_5: route5.cargoName || '',
    t3_trips_5: route5.tripsCount ? String(route5.tripsCount) : '',
    t3_dist_5: route5.distanceKm ? String(route5.distanceKm) : '',
    t3_tons_5: route5.weightTons ? route5.weightTons.toFixed(2) : '',

    t3_client_6: route6.clientName || '',
    t3_arr_time_6: route6.arrivalTime || '',
    t3_load_addr_6: route6.loadingAddress || '',
    t3_unload_addr_6: route6.unloadingAddress || '',
    t3_cargo_6: route6.cargoName || '',
    t3_trips_6: route6.tripsCount ? String(route6.tripsCount) : '',
    t3_dist_6: route6.distanceKm ? String(route6.distanceKm) : '',
    t3_tons_6: route6.weightTons ? route6.weightTons.toFixed(2) : '',

    t3_total_tons: totalTonsFormatted,

    // Нижний блок: подписи, медосмотр, допуск
    fuelGivenDisp: String(fuelGiven),
    dispSig: dispSurname,
    dispFio: data.dispatchAndControl.dispatcherFio || 'Шахмаев А.О.',

    mechOutSig: mechSurname,
    mechOutFio: data.dispatchAndControl.mechanicFio || 'Нигомедьянов Р.Р.',

    driverAcceptSig: driverSurname,
    driverAcceptFio: data.driver.fio || 'Никифоров Д.В.',

    medRole: 'Медсестра',
    medSig: medSurname,
    medFio: data.dispatchAndControl.medicName || 'Шахмаева О.В.',

    retDriverSig: isCompleted ? driverSurname : '',
    retDriverFio: isCompleted ? data.driver.fio || 'Никифоров Д.В.' : '',
    retMechSig: isCompleted ? mechSurname : '',
    retMechFio: isCompleted ? data.dispatchAndControl.mechanicFio || 'Нигомедьянов Р.Р.' : '',

    techNote: '',

    // Отметки организации
    note1: data.specialNotes || 'Замечаний к ТС и водителю нет.',
    note2: `Груз сдан полностью по ТН № ${number}.`,
    note3: '',
    note4: '',
    note5: '',
  };

  const v = (key: string): string => {
    if (isInitiallyEmpty) return '';
    return defaultFields[key] || '';
  };

  const defaultDataJson = JSON.stringify(defaultFields);

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Путевой лист № ${v('docNumber') || '______'} от ${v('docDay')} ${v('docMonth')} 20${v('docYear')} г. (Форма № 4-С, ОКУД 0345004)</title>
  <style>
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page {
      size: A4 landscape;
      margin: 8mm 8mm 4mm 8mm;
    }
    html, body {
      margin: 0;
      padding: 0;
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      font-size: 7.0pt; font-weight: 600;
      line-height: 1.1;
      color: #000;
      background: #334155;
    }
    body {
      padding: 12px 0;
    }
    .print-hide {
      max-width: 297mm;
      margin: 0 auto 10px auto;
      padding: 8px 16px;
      background: #0f172a;
      color: #fff;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    }
    .btn-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn {
      color: #fff;
      border: none;
      padding: 6px 14px;
      font-weight: 600;
      font-size: 12px;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: all 0.15s ease;
      user-select: none;
    }
    .btn-primary { background: #2563eb; }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-secondary { background: #475569; }
    .btn-secondary:hover { background: #64748b; }
    .btn-danger { background: #dc2626; }
    .btn-danger:hover { background: #b91c1c; }
    .btn-success { background: #16a34a; }
    .btn-success:hover { background: #15803d; }
    .btn-amber { background: #d97706; }
    .btn-amber:hover { background: #b45309; }
    .tpl-select {
      background: #1e293b;
      color: #f8fafc;
      border: 1px solid #475569;
      border-radius: 6px;
      padding: 5px 10px;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      outline: none;
    }
    .tpl-select:hover { border-color: #94a3b8; }
    
    /* СТРАНИЦА А4 АЛЬБОМНАЯ (СТРОГО 1 ЛИСТ) */
    .pl-page {
      width: 297mm;
      height: 190mm;
      max-height: 190mm;
      margin: 0 auto;
      background: #fff;
      padding: 4mm 8mm 4mm 8mm;
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.35);
      position: relative;
      overflow: hidden;
      box-sizing: border-box;
    }

    @media print {
      html, body {
        background: #fff !important;
        padding: 0 !important;
        margin: 0 !important;
        width: 297mm !important;
        height: auto !important;
      }
      .print-hide {
        display: none !important;
      }
      .editable-field:hover, .editable-field:focus {
        background: transparent !important;
        outline: none !important;
      }
      .pl-page {
        width: 100% !important;
        height: auto !important;
        max-height: none !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        page-break-after: avoid !important;
        break-after: avoid !important;
        overflow: visible !important;
      }
    }

    .editable-field {
      outline: none;
      min-height: 10px;
      cursor: text;
      transition: background-color 0.15s ease;
    }
    .editable-field:hover {
      background-color: #fef08a;
    }
    .editable-field:focus {
      background-color: #fef9c3;
      box-shadow: inset 0 0 0 1px #ca8a04;
    }

    /* Таблицы путевого листа 4-С */
    table.pl-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.8px solid #000;
      table-layout: fixed;
    }
    table.pl-table td, table.pl-table th {
      border: 1.2px solid #000;
      padding: 1px 2px;
      vertical-align: middle;
      font-size: 6.5pt;
      line-height: 1.1;
      font-weight: bold;
    }
    th.col-header {
      background-color: #fff;
      font-weight: normal;
      text-align: center;
      font-size: 6.2pt;
    }
    th.col-num {
      text-align: center;
      font-size: 6.0pt;
      font-weight: normal;
      padding: 0.5px !important;
    }
    .sub-prompt {
      font-size: 6.6pt;
      line-height: 1.0;
      text-align: center;
      font-weight: bold;
      color: #000;
      display: block;
      margin-top: 0.5px;
    }
    .line-field {
      border-bottom: 1px solid #000;
      display: inline-block;
      vertical-align: bottom;
      padding: 0 2px;
    }
    .stamp-box {
      border: 1px solid #000;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-size: 6.6pt;
      line-height: 1.15;
    }
    .code-table {
      border-collapse: collapse;
      border: 1.5px solid #000;
      margin-left: auto;
    }
    .code-table td {
      border: 1px solid #000;
      padding: 1px 4px;
      font-size: 6.6pt;
      text-align: center;
    }

    /* Вертикальные таблицы Код (со скриншота пользователя) */
    table.v-code-table {
      border-collapse: collapse;
      border: 1.5px solid #000;
      width: 12.3mm;
      table-layout: fixed;
    }
    table.v-code-table td, table.v-code-table th {
      border: 1px solid #000;
      text-align: center;
      padding: 0;
      font-size: 6.6pt;
      vertical-align: middle;
    }
    table.v-code-table th {
      font-weight: normal;
      background: #fff;
    }
    table.v-code-table td {
      font-weight: bold;
      font-family: Arial, monospace;
    }
  </style>
</head>
<body>

  <!-- Верхняя панель управления (скрыта при печати) -->
  <div class="print-hide" style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
    <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
      <span style="font-size: 15px;">📋</span>
      <div>
        <div style="font-weight: 700; font-size: 12.5px; white-space: nowrap;">
          Путевой лист № ${v('docNumber') || '______'} (${v('vehReg') || 'Авто'})
        </div>
        <div style="font-size: 10px; color: #94a3b8;">
          Типовая форма № 4-С (ОКУД 0345004) • Интерактивный бланк
        </div>
      </div>
    </div>
    <div class="btn-group" style="display: flex; align-items: center; gap: 6px; flex-wrap: nowrap;">
      <!-- 1-клик загрузка шаблона текущего автомобиля -->
      <button id="quickApplyBtn" class="btn btn-amber" style="display: none;" onclick="quickApplyCurrentVehicleTemplate()" title="Загрузить шаблон для ${v('vehReg')} в 1 клик">
        ⚡ Шаблон [${v('vehReg')}]
      </button>

      <!-- Выбор из всех доступных шаблонов автомобилей -->
      <select id="templateSelector" class="tpl-select" onchange="handleSelectTemplate(this.value)">
        <option value="">📋 Шаблоны авто...</option>
      </select>

      <!-- Кнопка + Шаблон: сохранить текущую заполненность -->
      <button class="btn btn-success" onclick="saveCurrentAsTemplate()" title="Сохранить текущую заполненность путевого листа в шаблон по номеру автомобиля">
        💾 + Шаблон
      </button>

      <button class="btn btn-secondary" onclick="resetDefaultData()" title="Восстановить исходные данные из заявки">
        🔄 Из заявки
      </button>
      <button class="btn btn-danger" onclick="clearAllFields()" title="Очистить все поля бланка">
        🧹 Очистить
      </button>
      <button class="btn btn-primary" onclick="window.print()" title="Распечатать или сохранить в PDF">
        🖨️ Печать PDF
      </button>
    </div>
  </div>
  <div id="toastBox" style="position: fixed; top: 12px; right: 16px; z-index: 9999; display: none;"></div>

  <!-- ======================== БЛАНК ФОРМЫ 4-С ======================== -->
  <div class="pl-page" id="waybillPage">
    
    <!-- 1. ВЕРХНЯЯ ШАПКА ДОКУМЕНТА -->
    <div style="margin-bottom: 3mm;">
      
      <!-- Верхний ярус: Штамп организации слева, Путевой лист по центру, Утверждение и Коды справа -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        
        <!-- Слева: Место для штампа организации -->
        <div style="width: 25%;">
          <div class="stamp-box" style="width: 36mm; height: 18mm; font-size: 6.8pt; font-weight: bold;">
            <div>Место для штампа</div>
            <div>организации</div>
          </div>
        </div>

        <!-- По центру: ПУТЕВОЙ ЛИСТ грузового автомобиля ... (Скриншот 1) -->
        <div style="width: 48%; text-align: center; padding-top: 1mm;">
          <div style="font-size: 14pt; font-weight: bold; letter-spacing: 2px; line-height: 1.1;">
            ПУТЕВОЙ ЛИСТ
          </div>
          <!-- Строка: грузового автомобиля (серия) № (Скриншот 1) -->
          <div style="display: flex; justify-content: center; align-items: flex-end; margin-top: 2px; font-size: 9.8pt; font-weight: bold;">
            <span style="white-space: nowrap; margin-right: 6px; padding-bottom: 3.5px;">грузового автомобиля</span>
            <div style="width: 26mm; margin-right: 6px;">
              <span class="editable-field line-field" contenteditable="true" data-field="docSeries" style="width: 100%; text-align: center; font-size: 9.5pt;">${v('docSeries')}</span>
              <span class="sub-prompt" style="font-size: 6.2pt; margin-top: 0.5px;">(серия)</span>
            </div>
            <span style="white-space: nowrap; margin-right: 4px; padding-bottom: 3.5px;">№</span>
            <div style="width: 40mm;">
              <span class="editable-field line-field" contenteditable="true" data-field="docNumber" style="width: 100%; text-align: center; font-size: 11pt; font-weight: bold;">${v('docNumber')}</span>
              <span style="display: block; height: 7px;"></span>
            </div>
          </div>
          <!-- Строка даты -->
          <div style="display: flex; justify-content: center; align-items: baseline; font-size: 8.8pt; font-weight: bold; margin-top: 0.5px;">
            «&nbsp;<span class="editable-field line-field" contenteditable="true" data-field="docDay" style="width: 12mm; text-align: center;">${v('docDay')}</span>&nbsp;»
            &nbsp; &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="docMonth" style="width: 32mm; text-align: center;">${v('docMonth')}</span>&nbsp; &nbsp;
            20&nbsp;<span class="editable-field line-field" contenteditable="true" data-field="docYear" style="width: 12mm; text-align: center;">${v('docYear')}</span>&nbsp; г.
          </div>
        </div>

        <!-- Справа: Утверждение формы и сплошная таблица Коды из 3 прямоугольников без разрывов, шрифт x2 (Скриншот 2) -->
        <div style="width: 27%; text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
          <div style="font-size: 7.2pt; font-weight: bold; line-height: 1.2; color: #000; margin-bottom: 2px;">
            Типовая межотраслевая форма № 4-С<br>
            Утверждена постановлением Госкомстата России<br>
            от 28.11.97 № 78
          </div>
          <table style="border-collapse: collapse; font-size: 8.2pt; font-weight: bold; margin-top: 1px;">
            <tr>
              <td style="border: none; text-align: right; padding-right: 6px;"></td>
              <td style="border: 2px solid #000; text-align: center; width: 30mm; height: 5.5mm; background: #fff;">Коды</td>
            </tr>
            <tr>
              <td style="border: none; text-align: right; padding-right: 6px; white-space: nowrap;">Форма по ОКУД</td>
              <td style="border: 2px solid #000; text-align: center; width: 30mm; height: 5.5mm;">0345004</td>
            </tr>
            <tr>
              <td style="border: none; text-align: right; padding-right: 6px; white-space: nowrap;">по ОКПО</td>
              <td style="border: 2px solid #000; text-align: center; width: 30mm; height: 5.5mm;">
                <span class="editable-field" contenteditable="true" data-field="okpo">${v('okpo')}</span>
              </td>
            </tr>
          </table>
        </div>

      </div>

      <!-- Нижний ярус шапки: Организация крупным шрифтом (Пункт 3) -->
      <div style="margin-top: 1.5mm; display: flex; align-items: flex-end;">
        <div style="font-size: 9.2pt; font-weight: bold; white-space: nowrap; margin-right: 6px; padding-bottom: 3.5px;">Организация</div>
        <div style="flex: 1; margin-right: 6px;">
          <span class="editable-field line-field" contenteditable="true" data-field="orgAddressPhone" style="width: 100%; font-weight: bold; font-size: 8.0pt;">${v('orgAddressPhone')}</span>
          <span class="sub-prompt" style="text-align: center; font-size: 6.2pt; margin-top: 0.5px;">(наименование, адрес и номер телефона)</span>
        </div>
        <!-- Распорка по ширине правого блока кодов (Форма по ОКУД / по ОКПО), чтобы подчеркивание Организации заканчивалось строго перед по ОКПО -->
        <div style="width: 54mm;"></div>
      </div>

    </div>

    <!-- 2. СРЕДНИЙ БЛОК: СЛЕВА (ВОДИТЕЛЬ, ТС, 2 ТАБЛИЦЫ КОД) | СПРАВА (ТАБЛИЦА 1 И ТАБЛИЦА 2) (72 мм) -->
    <div style="display: flex; justify-content: space-between; margin-bottom: 2.0mm; height: 72mm;">
      
      <!-- ЛЕВАЯ КОЛОНКА (Инфо о ТС и водителе + вертикальные таблицы КОД) (52%) -->
      <div style="width: 52%; display: flex; justify-content: space-between; height: 100%;">
        
        <!-- Текстовые поля слева от таблицы Код (ширина calc(100% - 17.5mm)) -->
        <div style="width: calc(100% - 17.5mm); display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
          
          <!-- 1. Верхний блок: Режим, Колонна, Бригада, Марка, Госномер, Водитель (точно 27.5 мм - состыкован с Таблицей Код 1) -->
          <div style="height: 27.5mm; display: flex; flex-direction: column; justify-content: space-between; font-size: 7.6pt; font-weight: bold;">
            <!-- Режим работы -->
            <div style="text-align: right; padding-right: 5px; height: 3.9mm; line-height: 3.9mm;">
              Режим работы
            </div>
            <!-- Колонна -->
            <div style="text-align: right; padding-right: 5px; height: 3.9mm; line-height: 3.9mm;">
              Колонна
            </div>
            <!-- Бригада -->
            <div style="text-align: right; padding-right: 5px; height: 3.9mm; line-height: 3.9mm;">
              Бригада
            </div>
            
            <!-- Горизонтальная линия под Бригадой -->
            <div style="border-bottom: 1.2px solid #000; width: 100%; margin: 0;"></div>
            
            <!-- Марка автомобиля (пустая ячейка в Код напротив нее) -->
            <div style="display: flex; align-items: baseline; height: 3.9mm; line-height: 3.9mm;">
              <span style="white-space: nowrap; margin-right: 5px;">Марка автомобиля</span>
              <span class="editable-field line-field" contenteditable="true" data-field="vehBrand" style="flex: 1; font-size: 7.8pt; font-weight: bold;">${v('vehBrand')}</span>
            </div>
            
            <!-- Государственный номерной знак -->
            <div style="display: flex; align-items: baseline; height: 3.9mm; line-height: 3.9mm;">
              <span style="white-space: nowrap; margin-right: 5px;">Государственный номерной знак</span>
              <span class="editable-field line-field" contenteditable="true" data-field="vehReg" style="flex: 1; font-size: 8.0pt; font-weight: bold; letter-spacing: 0.5px; text-align: center; margin-right: 6px;">${v('vehReg')}</span>
              <span style="white-space: nowrap; padding-right: 3px;">Гаражный номер</span>
            </div>
            
            <!-- Водитель -->
            <div style="height: 4.8mm;">
              <div style="display: flex; align-items: baseline; height: 3.6mm;">
                <span style="white-space: nowrap; margin-right: 5px;">Водитель</span>
                <span class="editable-field line-field" contenteditable="true" data-field="driverFio" style="flex: 1; font-size: 8.0pt; font-weight: bold; margin-right: 6px;">${v('driverFio')}</span>
                <span style="white-space: nowrap; padding-right: 3px;">Табельный номер</span>
              </div>
              <div style="display: flex; height: 1.2mm;">
                <span style="width: 45px;"></span>
                <span class="sub-prompt" style="flex: 1; margin-right: 90px; font-size: 5.6pt; line-height: 1;">(фамилия, имя, отчество)</span>
              </div>
            </div>
          </div>

          <!-- 2. Средний блок: Удостоверение, Класс, Лицензионная карточка, Рег. номер (~13.5 мм) -->
          <div style="font-size: 7.4pt; font-weight: bold; display: flex; flex-direction: column; justify-content: space-around; height: 13.5mm;">
            <!-- Удостоверение № ... Класс ... -->
            <div style="display: flex; align-items: baseline;">
              <span style="white-space: nowrap; margin-right: 4px;">Удостоверение №</span>
              <span class="editable-field line-field" contenteditable="true" data-field="driverLic" style="flex: 1; font-size: 7.8pt; font-weight: bold; margin-right: 8px;">${v('driverLic')}</span>
              <span style="white-space: nowrap; margin-right: 4px;">Класс</span>
              <span class="editable-field line-field" contenteditable="true" data-field="driverClass" style="width: 28mm; font-size: 7.8pt; font-weight: bold; text-align: center;">${v('driverClass')}</span>
            </div>

            <!-- Лицензионная карточка -->
            <div style="display: flex; align-items: flex-end;">
              <span style="white-space: nowrap; margin-right: 6px; padding-bottom: 1.5px;">Лицензионная карточка</span>
              <div style="width: 52mm;">
                <div style="text-align: center; font-size: 7.4pt; border-bottom: 1.2px solid #000; padding-bottom: 0.5px;">
                  <b><u>стандартная</u></b>, <s>ограниченная</s>
                </div>
                <span class="sub-prompt" style="font-size: 5.4pt; margin-top: 0.2px;">(ненужное зачеркнуть)</span>
              </div>
            </div>

            <!-- Регистрационный № ... Серия ... № ... -->
            <div style="display: flex; align-items: baseline;">
              <span style="white-space: nowrap; margin-right: 4px;">Регистрационный №</span>
              <span class="editable-field line-field" contenteditable="true" data-field="licRegNum" style="flex: 1; font-size: 7.4pt; margin-right: 8px;">${v('licRegNum')}</span>
              <span style="white-space: nowrap; margin-right: 4px;">Серия</span>
              <span class="editable-field line-field" contenteditable="true" data-field="licSeries" style="width: 18mm; font-size: 7.4pt; text-align: center; margin-right: 8px;">${v('licSeries')}</span>
              <span style="white-space: nowrap; margin-right: 4px;">№</span>
              <span class="editable-field line-field" contenteditable="true" data-field="licNumber" style="width: 22mm; font-size: 7.4pt; text-align: center;">${v('licNumber')}</span>
            </div>
          </div>

          <!-- 3. Нижний блок: Прицепы 1..4 и Сопровождающие лица (состыкован со 2-й Таблицей Код) -->
          <div style="display: flex; flex-direction: column; justify-content: space-between; height: 26mm; font-size: 7.0pt; font-weight: bold;">
            <!-- Прицеп 1 -->
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <div style="width: 32%;">
                Прицеп 1 &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="pr1_brand" style="width: calc(100% - 48px); font-size: 7.0pt;">${v('pr1_brand')}</span>
              </div>
              <div style="width: 42%;">
                Гос. № &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="pr1_reg" style="width: calc(100% - 48px); text-align: center; font-size: 7.0pt;">${v('pr1_reg')}</span>
              </div>
              <div style="width: 26%; text-align: right; padding-right: 3px;">
                Гаражный номер
              </div>
            </div>
            <!-- Прицеп 2 -->
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <div style="width: 32%;">
                Прицеп 2 &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="pr2_brand" style="width: calc(100% - 48px); font-size: 7.0pt;">${v('pr2_brand')}</span>
              </div>
              <div style="width: 42%;">
                Гос. № &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="pr2_reg" style="width: calc(100% - 48px); text-align: center; font-size: 7.0pt;">${v('pr2_reg')}</span>
              </div>
              <div style="width: 26%; text-align: right; padding-right: 3px;">
                Гаражный номер
              </div>
            </div>
            <!-- Прицеп 3 -->
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <div style="width: 32%;">
                Прицеп 3 &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="pr3_brand" style="width: calc(100% - 48px); font-size: 7.0pt;">${v('pr3_brand')}</span>
              </div>
              <div style="width: 42%;">
                Гос. № &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="pr3_reg" style="width: calc(100% - 48px); text-align: center; font-size: 7.0pt;">${v('pr3_reg')}</span>
              </div>
              <div style="width: 26%; text-align: right; padding-right: 3px;">
                Гаражный номер
              </div>
            </div>
            <!-- Прицеп 4 -->
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <div style="width: 32%;">
                Прицеп 4 &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="pr4_brand" style="width: calc(100% - 48px); font-size: 7.0pt;">${v('pr4_brand')}</span>
              </div>
              <div style="width: 42%;">
                Гос. № &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="pr4_reg" style="width: calc(100% - 48px); text-align: center; font-size: 7.0pt;">${v('pr4_reg')}</span>
              </div>
              <div style="width: 26%; text-align: right; padding-right: 3px;">
                Гаражный номер
              </div>
            </div>
            <!-- Сопровождающие лица -->
            <div style="display: flex; align-items: baseline; height: 3.5mm;">
              <span style="white-space: nowrap; margin-right: 4px;">Сопровождающие лица:</span>
              <span class="editable-field line-field" contenteditable="true" data-field="escortPersons" style="flex: 1; font-size: 7.0pt;">${v('escortPersons')}</span>
            </div>
          </div>

        </div>

        <!-- КОЛОНКА ВЕРТИКАЛЬНЫХ ТАБЛИЦ «КОД» (ширина 16 мм - жирные рамки, высота состыкована) -->
        <div style="width: 16mm; display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
          
          <!-- 1. Верхняя таблица Код: 6 строчек, высота ровно как Таблица 1 (27.5 мм), рамки жирнее, ширина 16 мм - Скриншот пользователя! -->
          <table class="v-code-table" style="width: 100%; border: 2px solid #000; height: 27.5mm;">
            <thead>
              <tr style="height: 4.1mm;">
                <th style="border: 1.2px solid #000; font-size: 7.2pt; font-weight: bold; background: #fff;">Код</th>
              </tr>
            </thead>
            <tbody>
              <!-- 1. Режим работы -->
              <tr style="height: 3.9mm;">
                <td style="border: 1.2px solid #000;"><span class="editable-field" contenteditable="true" data-field="code_workMode">${v('code_workMode')}</span></td>
              </tr>
              <!-- 2. Колонна -->
              <tr style="height: 3.9mm;">
                <td style="border: 1.2px solid #000;"><span class="editable-field" contenteditable="true" data-field="code_col">${v('code_col')}</span></td>
              </tr>
              <!-- 3. Бригада -->
              <tr style="height: 3.9mm;">
                <td style="border: 1.2px solid #000;"><span class="editable-field" contenteditable="true" data-field="code_brig">${v('code_brig')}</span></td>
              </tr>
              <!-- 4. Пустая ячейка под разделительной чертой (Скриншот пользователя!) -->
              <tr style="height: 3.9mm;">
                <td style="border: 1.2px solid #000;">&nbsp;</td>
              </tr>
              <!-- 5. Гаражный номер авто -->
              <tr style="height: 3.9mm;">
                <td style="border: 1.2px solid #000;"><span class="editable-field" contenteditable="true" data-field="vehGarage">${v('vehGarage')}</span></td>
              </tr>
              <!-- 6. Табельный номер водителя -->
              <tr style="height: 3.9mm;">
                <td style="border: 1.2px solid #000;"><span class="editable-field" contenteditable="true" data-field="driverTab">${v('driverTab')}</span></td>
              </tr>
            </tbody>
          </table>

          <!-- Промежуток между верхней и нижней таблицей Код -->
          <div style="flex: 1;"></div>

          <!-- 2. Нижняя таблица Код (Прицепы 1..4) (высота ~21 мм, жирные рамки 2px) -->
          <table class="v-code-table" style="width: 100%; border: 2px solid #000; height: 21mm; margin-bottom: 3.5mm;">
            <tbody>
              <!-- Прицеп 1 -->
              <tr style="height: 5.25mm;">
                <td style="border: 1.2px solid #000;"><span class="editable-field" contenteditable="true" data-field="code_pr1">${v('code_pr1')}</span></td>
              </tr>
              <!-- Прицеп 2 -->
              <tr style="height: 5.25mm;">
                <td style="border: 1.2px solid #000;"><span class="editable-field" contenteditable="true" data-field="code_pr2">${v('code_pr2')}</span></td>
              </tr>
              <!-- Прицеп 3 -->
              <tr style="height: 5.25mm;">
                <td style="border: 1.2px solid #000;"><span class="editable-field" contenteditable="true" data-field="code_pr3">${v('code_pr3')}</span></td>
              </tr>
              <!-- Прицеп 4 -->
              <tr style="height: 5.25mm;">
                <td style="border: 1.2px solid #000;"><span class="editable-field" contenteditable="true" data-field="code_pr4">${v('code_pr4')}</span></td>
              </tr>
            </tbody>
          </table>

        </div>

      </div>

      <!-- РАЗДЕЛИТЕЛЬНЫЙ ПРОМЕЖУТОК МЕЖДУ КОЛОНКАМИ (1.2%) -->
      <div style="width: 1.2%;"></div>

      <!-- ПРАВАЯ КОЛОНКА (ТАБЛИЦА 1 И ТАБЛИЦА 2) (46.8%) -->
      <div style="width: 46.8%; display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
        
        <!-- ================= Таблица 1: Работа водителя и автомобиля ================= -->
        <div>
          <div style="text-align: center; font-weight: bold; font-size: 7.0pt; font-weight: 600; letter-spacing: 1px; margin-bottom: 0.5px;">
            Р а б о т а &nbsp; в о д и т е л я &nbsp; и &nbsp; а в т о м о б и л я
          </div>
          <table class="pl-table" style="width: 100%;">
            <colgroup>
              <col style="width: 16.5%;">
              <col style="width: 6.8%;">
              <col style="width: 6.8%;">
              <col style="width: 6.8%;">
              <col style="width: 6.8%;">
              <col style="width: 9.3%;">
              <col style="width: 14.5%;">
              <col style="width: 32.5%;">
            </colgroup>
            <thead>
              <tr style="height: 6.4mm;">
                <th rowspan="2" class="col-header">операция</th>
                <th colspan="4" class="col-header">время по графику</th>
                <th rowspan="2" class="col-header" style="font-size: 5.4pt; line-height: 1.05; padding: 0.5px;">нулевой<br>пробег,<br>км</th>
                <th rowspan="2" class="col-header">показание<br>спидометра,<br>км</th>
                <th rowspan="2" class="col-header">время фактическое,<br>число, месяц, ч. мин.</th>
              </tr>
              <tr style="height: 3.2mm;">
                <th class="col-header" style="font-size: 6.6pt;">число</th>
                <th class="col-header" style="font-size: 6.6pt;">месяц</th>
                <th class="col-header" style="font-size: 6.6pt;">ч.</th>
                <th class="col-header" style="font-size: 6.6pt;">мин.</th>
              </tr>
              <tr style="height: 3.2mm;">
                <th class="col-num">1</th>
                <th class="col-num">2</th>
                <th class="col-num">3</th>
                <th class="col-num">4</th>
                <th class="col-num">5</th>
                <th class="col-num">6</th>
                <th class="col-num">7</th>
                <th class="col-num">8</th>
              </tr>
            </thead>
            <tbody>
              <tr style="height: 5.0mm;">
                <td style="font-weight: bold;">выезд из гаража</td>
                <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t1_dep_day">${v('t1_dep_day')}</span></td>
                <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t1_dep_month">${v('t1_dep_month')}</span></td>
                <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t1_dep_h">${v('t1_dep_h')}</span></td>
                <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t1_dep_m">${v('t1_dep_m')}</span></td>
                <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t1_dep_zero">${v('t1_dep_zero')}</span></td>
                <td style="text-align: center; font-weight: bold;"><span class="editable-field" contenteditable="true" data-field="t1_odo_start">${v('t1_odo_start')}</span></td>
                <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t1_act_dep">${v('t1_act_dep')}</span></td>
              </tr>
              <tr style="height: 5.0mm;">
                <td style="font-weight: bold;">возвращение в гараж</td>
                <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t1_arr_day">${v('t1_arr_day')}</span></td>
                <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t1_arr_month">${v('t1_arr_month')}</span></td>
                <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t1_arr_h">${v('t1_arr_h')}</span></td>
                <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t1_arr_m">${v('t1_arr_m')}</span></td>
                <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t1_arr_zero">${v('t1_arr_zero')}</span></td>
                <td style="text-align: center; font-weight: bold;"><span class="editable-field" contenteditable="true" data-field="t1_odo_end">${v('t1_odo_end')}</span></td>
                <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t1_act_arr">${v('t1_act_arr')}</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- ================= Таблица 2: Движение горючего ================= -->
        <div>
          <div style="text-align: center; font-weight: bold; font-size: 7.0pt; font-weight: 600; letter-spacing: 1px; margin-bottom: 0.5px;">
            Д в и ж е н и е &nbsp; г о р ю ч е г о
          </div>
          <table class="pl-table" style="height: 38.4mm;">
            <colgroup>
              <col style="width: 9.0%;">
              <col style="width: 8.0%;">
              <col style="width: 9.5%;">
              <col style="width: 9.5%;">
              <col style="width: 11.5%;">
              <col style="width: 8.5%;">
              <col style="width: 14.0%;">
              <col style="width: 15.0%;">
              <col style="width: 15.0%;">
            </colgroup>
            <thead>
              <tr style="height: 5.8mm;">
                <th colspan="2" class="col-header">горючее</th>
                <th rowspan="2" class="col-header">выдано,<br>л</th>
                <th colspan="2" class="col-header">остаток при</th>
                <th rowspan="2" class="col-header">сдано,<br>л</th>
                <th rowspan="2" class="col-header">коэффициент<br>изменения<br>нормы</th>
                <th colspan="2" class="col-header">Время работы, ч. мин.</th>
              </tr>
              <tr style="height: 5.8mm;">
                <th class="col-header" style="font-size: 6.6pt;">марка</th>
                <th class="col-header" style="font-size: 6.6pt;">код марки</th>
                <th class="col-header" style="font-size: 6.6pt;">выезде, л</th>
                <th class="col-header" style="font-size: 5.4pt; line-height: 1.05; padding: 0.5px;">возвра-<br>щении,<br>л</th>
                <th class="col-header" style="font-size: 5.2pt; line-height: 1.05; padding: 0.5px;">спец-<br>оборудо-<br>вания</th>
                <th class="col-header" style="font-size: 5.4pt; line-height: 1.05; padding: 0.5px;">двига-<br>теля</th>
              </tr>
              <tr style="height: 4.0mm;">
                <th class="col-num">9</th>
                <th class="col-num">10</th>
                <th class="col-num">11</th>
                <th class="col-num">12</th>
                <th class="col-num">13</th>
                <th class="col-num">14</th>
                <th class="col-num">15</th>
                <th class="col-num">16</th>
                <th class="col-num">17</th>
              </tr>
            </thead>
            <tbody>
              <!-- Строка 1: Данные по топливу -->
              <tr style="height: 5.3mm;">
                <td style="text-align: center; font-weight: bold;"><span class="editable-field" contenteditable="true" data-field="t2_fuelBrand">${v('t2_fuelBrand')}</span></td>
                <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t2_fuelCode">${v('t2_fuelCode')}</span></td>
                <td style="text-align: center; font-weight: bold;"><span class="editable-field" contenteditable="true" data-field="t2_fuelGiven">${v('t2_fuelGiven')}</span></td>
                <td style="text-align: center; font-weight: bold;"><span class="editable-field" contenteditable="true" data-field="t2_fuelStart">${v('t2_fuelStart')}</span></td>
                <td style="text-align: center; font-weight: bold;"><span class="editable-field" contenteditable="true" data-field="t2_fuelEnd">${v('t2_fuelEnd')}</span></td>
                <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t2_fuelReturn">${v('t2_fuelReturn')}</span></td>
                <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t2_fuelCoeff">${v('t2_fuelCoeff')}</span></td>
                <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t2_specTime">${v('t2_specTime')}</span></td>
                <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t2_engTime">${v('t2_engTime')}</span></td>
              </tr>
              <!-- Строка 2: Пустая строка -->
              <tr style="height: 5.3mm;">
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
              </tr>
              <!-- Строка 3: п о д п и с ь (по центру длинной строки на всю ширину таблицы - Скриншот пользователя!) -->
              <tr style="height: 3.5mm;">
                <td colspan="9" style="text-align: center; font-weight: bold; font-size: 6.8pt; letter-spacing: 3px; background: #fafafa;">
                  п о д п и с ь
                </td>
              </tr>
              <!-- Строка 4: наименования должностей (заправщика, механика, механика, заправщика, диспетчера) -->
              <tr style="height: 3.5mm; font-size: 6.2pt;">
                <td colspan="3" style="text-align: center; font-weight: bold;">заправщика</td>
                <td style="text-align: center; font-weight: bold;">механика</td>
                <td style="text-align: center; font-weight: bold;">механика</td>
                <td colspan="2" style="text-align: center; font-weight: bold;">заправщика</td>
                <td colspan="2" style="text-align: center; font-weight: bold;">диспетчера</td>
              </tr>
              <!-- Строка 5: места где они должны подписываться -->
              <tr style="height: 5.0mm; font-size: 6.2pt;">
                <td colspan="3" style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t2_sig_refueler">${v('t2_sig_refueler')}</span></td>
                <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t2_sig_mech_out">${v('t2_sig_mech_out')}</span></td>
                <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t2_sig_mech_in">${v('t2_sig_mech_in')}</span></td>
                <td colspan="2" style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t2_sig_refueler_ret">${v('t2_sig_refueler_ret')}</span></td>
                <td colspan="2" style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t2_sig_disp">${v('t2_sig_disp')}</span></td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

    </div>

    <!-- 3. ТАБЛИЦА 3: ЗАДАНИЕ ВОДИТЕЛЮ (6 СТРОК МАРШРУТА + ИТОГО - Пункт 1!) -->
    <div style="margin-bottom: 2.0mm;">
      <div style="text-align: center; font-weight: bold; font-size: 7.8pt; letter-spacing: 2px; margin-bottom: 1px;">
        З А Д А Н И Е &nbsp; &nbsp; В О Д И Т Е Л Ю
      </div>
      <table class="pl-table" style="width: 100%;">
        <colgroup>
          <col style="width: 22.5%;"> <!-- в чье распоряжение (широкая колонка - имя заказчика строго в 1 строку!) -->
          <col style="width: 8.5%;">  <!-- время прибытия -->
          <col style="width: 16.0%;"> <!-- погрузки -->
          <col style="width: 16.0%;"> <!-- разгрузки -->
          <col style="width: 17.0%;"> <!-- наименование груза -->
          <col style="width: 6.0%;">  <!-- количество ездок -->
          <col style="width: 7.0%;">  <!-- расстояние -->
          <col style="width: 7.0%;">  <!-- перевезти тонн -->
        </colgroup>
        <thead>
          <tr style="height: 5.2mm;">
            <th rowspan="2" class="col-header">в чье распоряжение (наиме-<br>нование и адрес заказчика)</th>
            <th rowspan="2" class="col-header">время прибытия,<br>ч. мин.</th>
            <th colspan="2" class="col-header">адрес пункта</th>
            <th rowspan="2" class="col-header">наименование груза</th>
            <th rowspan="2" class="col-header">количество<br>ездок</th>
            <th rowspan="2" class="col-header">расстояние,<br>км</th>
            <th rowspan="2" class="col-header">перевезти<br>тонн</th>
          </tr>
          <tr style="height: 3.0mm;">
            <th class="col-header" style="font-size: 5.4pt;">погрузки</th>
            <th class="col-header" style="font-size: 5.4pt;">разгрузки</th>
          </tr>
          <tr style="height: 2.6mm;">
            <th class="col-num">18</th>
            <th class="col-num">19</th>
            <th class="col-num">20</th>
            <th class="col-num">21</th>
            <th class="col-num">22</th>
            <th class="col-num">23</th>
            <th class="col-num">24</th>
            <th class="col-num">25</th>
          </tr>
        </thead>
        <tbody>
          <!-- Маршрут 1 (1 строка заказчика) -->
          <tr style="height: 3.6mm;">
            <td><span class="editable-field" contenteditable="true" data-field="t3_client_1" style="font-weight: bold; white-space: nowrap;">${v('t3_client_1')}</span></td>
            <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t3_arr_time_1">${v('t3_arr_time_1')}</span></td>
            <td><span class="editable-field" contenteditable="true" data-field="t3_load_addr_1">${v('t3_load_addr_1')}</span></td>
            <td><span class="editable-field" contenteditable="true" data-field="t3_unload_addr_1">${v('t3_unload_addr_1')}</span></td>
            <td><span class="editable-field" contenteditable="true" data-field="t3_cargo_1" style="font-weight: bold;">${v('t3_cargo_1')}</span></td>
            <td style="text-align: center; font-weight: bold;"><span class="editable-field" contenteditable="true" data-field="t3_trips_1">${v('t3_trips_1')}</span></td>
            <td style="text-align: center; font-weight: bold;"><span class="editable-field" contenteditable="true" data-field="t3_dist_1">${v('t3_dist_1')}</span></td>
            <td style="text-align: center; font-weight: bold;"><span class="editable-field" contenteditable="true" data-field="t3_tons_1">${v('t3_tons_1')}</span></td>
          </tr>
          <!-- Маршрут 2 -->
          <tr style="height: 3.6mm;">
            <td><span class="editable-field" contenteditable="true" data-field="t3_client_2">${v('t3_client_2')}</span></td>
            <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t3_arr_time_2">${v('t3_arr_time_2')}</span></td>
            <td><span class="editable-field" contenteditable="true" data-field="t3_load_addr_2">${v('t3_load_addr_2')}</span></td>
            <td><span class="editable-field" contenteditable="true" data-field="t3_unload_addr_2">${v('t3_unload_addr_2')}</span></td>
            <td><span class="editable-field" contenteditable="true" data-field="t3_cargo_2">${v('t3_cargo_2')}</span></td>
            <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t3_trips_2">${v('t3_trips_2')}</span></td>
            <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t3_dist_2">${v('t3_dist_2')}</span></td>
            <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t3_tons_2">${v('t3_tons_2')}</span></td>
          </tr>
          <!-- Маршрут 3 -->
          <tr style="height: 3.6mm;">
            <td><span class="editable-field" contenteditable="true" data-field="t3_client_3">${v('t3_client_3')}</span></td>
            <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t3_arr_time_3">${v('t3_arr_time_3')}</span></td>
            <td><span class="editable-field" contenteditable="true" data-field="t3_load_addr_3">${v('t3_load_addr_3')}</span></td>
            <td><span class="editable-field" contenteditable="true" data-field="t3_unload_addr_3">${v('t3_unload_addr_3')}</span></td>
            <td><span class="editable-field" contenteditable="true" data-field="t3_cargo_3">${v('t3_cargo_3')}</span></td>
            <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t3_trips_3">${v('t3_trips_3')}</span></td>
            <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t3_dist_3">${v('t3_dist_3')}</span></td>
            <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t3_tons_3">${v('t3_tons_3')}</span></td>
          </tr>
          <!-- Маршрут 4 -->
          <tr style="height: 3.6mm;">
            <td><span class="editable-field" contenteditable="true" data-field="t3_client_4">${v('t3_client_4')}</span></td>
            <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t3_arr_time_4">${v('t3_arr_time_4')}</span></td>
            <td><span class="editable-field" contenteditable="true" data-field="t3_load_addr_4">${v('t3_load_addr_4')}</span></td>
            <td><span class="editable-field" contenteditable="true" data-field="t3_unload_addr_4">${v('t3_unload_addr_4')}</span></td>
            <td><span class="editable-field" contenteditable="true" data-field="t3_cargo_4">${v('t3_cargo_4')}</span></td>
            <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t3_trips_4">${v('t3_trips_4')}</span></td>
            <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t3_dist_4">${v('t3_dist_4')}</span></td>
            <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t3_tons_4">${v('t3_tons_4')}</span></td>
          </tr>
          <!-- Маршрут 5 -->
          <tr style="height: 3.6mm;">
            <td><span class="editable-field" contenteditable="true" data-field="t3_client_5">${v('t3_client_5')}</span></td>
            <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t3_arr_time_5">${v('t3_arr_time_5')}</span></td>
            <td><span class="editable-field" contenteditable="true" data-field="t3_load_addr_5">${v('t3_load_addr_5')}</span></td>
            <td><span class="editable-field" contenteditable="true" data-field="t3_unload_addr_5">${v('t3_unload_addr_5')}</span></td>
            <td><span class="editable-field" contenteditable="true" data-field="t3_cargo_5">${v('t3_cargo_5')}</span></td>
            <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t3_trips_5">${v('t3_trips_5')}</span></td>
            <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t3_dist_5">${v('t3_dist_5')}</span></td>
            <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t3_tons_5">${v('t3_tons_5')}</span></td>
          </tr>
          <!-- Маршрут 6 -->
          <tr style="height: 3.6mm;">
            <td><span class="editable-field" contenteditable="true" data-field="t3_client_6">${v('t3_client_6')}</span></td>
            <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t3_arr_time_6">${v('t3_arr_time_6')}</span></td>
            <td><span class="editable-field" contenteditable="true" data-field="t3_load_addr_6">${v('t3_load_addr_6')}</span></td>
            <td><span class="editable-field" contenteditable="true" data-field="t3_unload_addr_6">${v('t3_unload_addr_6')}</span></td>
            <td><span class="editable-field" contenteditable="true" data-field="t3_cargo_6">${v('t3_cargo_6')}</span></td>
            <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t3_trips_6">${v('t3_trips_6')}</span></td>
            <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t3_dist_6">${v('t3_dist_6')}</span></td>
            <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t3_tons_6">${v('t3_tons_6')}</span></td>
          </tr>
          <!-- Строка Итого -->
          <tr style="height: 3.6mm; font-weight: bold;">
            <td colspan="5" style="border: none; border-left: 1.8px solid #000; border-bottom: 1.8px solid #000;"></td>
            <td colspan="2" style="text-align: right; border: 1.8px solid #000; padding-right: 6px;">Итого</td>
            <td style="text-align: center; border: 1.8px solid #000;"><span class="editable-field" contenteditable="true" data-field="t3_total_tons">${v('t3_total_tons')}</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 4. НИЖНИЙ БЛОК: 3 ОСМЫСЛЕННЫХ БЛОКА С ОТСТУПАМИ СО ВСЕХ СТОРОН (ЛЕВЫЙ: ДИСПЕТЧЕР/МЕДИК | ЦЕНТРАЛЬНЫЙ: МЕХАНИК/ВОЗВРАЩЕНИЕ | ПРАВЫЙ: ОТМЕТКИ ОРГАНИЗАЦИИ) -->
    <div style="display: flex; justify-content: space-between; gap: 7mm; height: 38mm; font-size: 6.5pt; line-height: 1.2; margin-top: 2.5mm; padding: 0 1mm;">
      
      <!-- ================= БЛОК 1: ДИСПЕТЧЕР И МЕДИК (Скриншот 1) (~31% ~ 85 мм) ================= -->
      <div style="width: 31%; display: flex; flex-direction: column; justify-content: space-between;">
        
        <!-- Строка 1 и 2: Водительское удостоверение проверил, задание выдал, / выдать горючего ___ литров -->
        <div>
          <div>Водительское удостоверение проверил, задание выдал,</div>
          <div style="display: flex; align-items: baseline; margin-top: 1.5px;">
            <span style="white-space: nowrap; margin-right: 3px;">выдать горючего</span>
            <span class="editable-field line-field" contenteditable="true" data-field="fuelGivenDisp" style="flex: 1; text-align: center; font-weight: bold;">${v('fuelGivenDisp')}</span>
            <span style="white-space: nowrap; margin-left: 3px;">литров</span>
          </div>
        </div>

        <!-- Строка 3: Диспетчер (подпись, расшифровка подписи) -->
        <div style="display: flex; align-items: flex-end; margin-top: 1.5px;">
          <span style="font-weight: bold; margin-right: 4px; padding-bottom: 3px;">Диспетчер</span>
          <div style="width: 20mm; margin-right: 4px;">
            <span class="editable-field line-field" contenteditable="true" data-field="dispSig" style="width: 100%; text-align: center;">${v('dispSig')}</span>
            <span class="sub-prompt">(подпись)</span>
          </div>
          <div style="flex: 1;">
            <span class="editable-field line-field" contenteditable="true" data-field="dispFio" style="width: 100%; text-align: center; font-weight: bold;">${v('dispFio')}</span>
            <span class="sub-prompt">(расшифровка подписи)</span>
          </div>
        </div>

        <!-- Строка 4 и 5: Медицинский допуск (Водитель по состоянию здоровья к управлению допущен) -->
        <div style="margin-top: 1.5px;">
          <div style="display: flex; align-items: flex-end;">
            <div style="font-size: 6.2pt; line-height: 1.1; margin-right: 4px; white-space: nowrap; padding-bottom: 3px;">
              Водитель по состоянию<br>
              здоровья к управлению<br>
              допущен
            </div>
            <div style="flex: 1;">
              <div style="display: flex; gap: 3px;">
                <div style="width: 18mm;">
                  <span class="editable-field line-field" contenteditable="true" data-field="medRole" style="width: 100%; text-align: center; font-size: 5.1pt;">${v('medRole')}</span>
                  <span class="sub-prompt">(должность)</span>
                </div>
                <div style="width: 14mm;">
                  <span class="editable-field line-field" contenteditable="true" data-field="medSig" style="width: 100%; text-align: center; font-size: 5.1pt;">${v('medSig')}</span>
                  <span class="sub-prompt">(подпись)</span>
                </div>
                <div style="flex: 1;">
                  <span class="editable-field line-field" contenteditable="true" data-field="medFio" style="width: 100%; text-align: center; font-weight: bold; font-size: 5.1pt;">${v('medFio')}</span>
                  <span class="sub-prompt">(расшифровка подписи)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Строка 6: Место для штампа (без рамки - Скриншот 1) -->
        <div style="font-size: 6.2pt; line-height: 1.15; padding-left: 1mm; margin-bottom: 0.5mm;">
          Место для<br>
          штампа
        </div>

      </div>

      <!-- ================= БЛОК 2: МЕХАНИК И ВОЗВРАЩЕНИЕ (Скриншот 2) (~39% ~ 106 мм) ================= -->
      <div style="width: 39%; display: flex; flex-direction: column; justify-content: space-between;">
        
        <!-- Линия 1: Автомобиль технически исправен. + длинное подчеркивание -->
        <div style="display: flex; align-items: baseline;">
          <span style="white-space: nowrap; margin-right: 4px;">Автомобиль технически исправен.</span>
          <span class="editable-field line-field" contenteditable="true" data-field="techNote" style="flex: 1;">${v('techNote')}</span>
        </div>

        <!-- Линия 2: Выезд разрешен. Механик (подпись, расшифровка подписи) -->
        <div style="display: flex; align-items: flex-end;">
          <span style="white-space: nowrap; margin-right: 4px; padding-bottom: 3px;">Выезд разрешен. &nbsp;<b>Механик</b></span>
          <div style="width: 22mm; margin-right: 4px;">
            <span class="editable-field line-field" contenteditable="true" data-field="mechOutSig" style="width: 100%; text-align: center;">${v('mechOutSig')}</span>
            <span class="sub-prompt">(подпись)</span>
          </div>
          <div style="flex: 1;">
            <span class="editable-field line-field" contenteditable="true" data-field="mechOutFio" style="width: 100%; text-align: center; font-weight: bold;">${v('mechOutFio')}</span>
            <span class="sub-prompt">(расшифровка подписи)</span>
          </div>
        </div>

        <!-- Линия 3: Автомобиль принял Водитель (подпись, расшифровка подписи) -->
        <div style="display: flex; align-items: flex-end;">
          <span style="white-space: nowrap; margin-right: 4px; padding-bottom: 3px;">Автомобиль принял <b>Водитель</b></span>
          <div style="width: 22mm; margin-right: 4px;">
            <span class="editable-field line-field" contenteditable="true" data-field="driverAcceptSig" style="width: 100%; text-align: center;">${v('driverAcceptSig')}</span>
            <span class="sub-prompt">(подпись)</span>
          </div>
          <div style="flex: 1;">
            <span class="editable-field line-field" contenteditable="true" data-field="driverAcceptFio" style="width: 100%; text-align: center; font-weight: bold;">${v('driverAcceptFio')}</span>
            <span class="sub-prompt">(расшифровка подписи)</span>
          </div>
        </div>

        <!-- Линия 4: При возвращении автомобиль исправен / неисправен -->
        <div style="display: flex; align-items: center; margin-top: 1px;">
          <span style="margin-right: 8px;">При возвращении автомобиль</span>
          <div style="text-align: center; font-size: 6.2pt; line-height: 1.05;">
            <div><b>исправен</b></div>
            <div style="border-top: 1px solid #000; width: 22mm; margin: 0 auto;"></div>
            <div style="color: #666;">неисправен</div>
          </div>
        </div>

        <!-- Линия 5: Сдал водитель (подпись, расшифровка подписи) -->
        <div style="display: flex; align-items: flex-end;">
          <span style="white-space: nowrap; margin-right: 4px; padding-bottom: 3px;">Сдал &nbsp;<b>водитель</b></span>
          <div style="width: 22mm; margin-right: 4px;">
            <span class="editable-field line-field" contenteditable="true" data-field="retDriverSig" style="width: 100%; text-align: center;">${v('retDriverSig')}</span>
            <span class="sub-prompt">(подпись)</span>
          </div>
          <div style="flex: 1;">
            <span class="editable-field line-field" contenteditable="true" data-field="retDriverFio" style="width: 100%; text-align: center; font-weight: bold;">${v('retDriverFio')}</span>
            <span class="sub-prompt">(расшифровка подписи)</span>
          </div>
        </div>

        <!-- Линия 6: Принял механик (подпись, расшифровка подписи) -->
        <div style="display: flex; align-items: flex-end;">
          <span style="white-space: nowrap; margin-right: 4px; padding-bottom: 3px;">Принял &nbsp;<b>механик</b></span>
          <div style="width: 22mm; margin-right: 4px;">
            <span class="editable-field line-field" contenteditable="true" data-field="retMechSig" style="width: 100%; text-align: center;">${v('retMechSig')}</span>
            <span class="sub-prompt">(подпись)</span>
          </div>
          <div style="flex: 1;">
            <span class="editable-field line-field" contenteditable="true" data-field="retMechFio" style="width: 100%; text-align: center; font-weight: bold;">${v('retMechFio')}</span>
            <span class="sub-prompt">(расшифровка подписи)</span>
          </div>
        </div>

      </div>

      <!-- ================= БЛОК 3: ОТМЕТКИ ОРГАНИЗАЦИИ (Скриншот 3) (~27% ~ 74 мм) ================= -->
      <div style="width: 27%; display: flex; flex-direction: column; justify-content: space-between;">
        
        <!-- Заголовок: 2 строчки (Отметки организации-владельца / автотранспорта: ___ ) -->
        <div>
          <div style="font-size: 6.5pt; line-height: 1.15;">Отметки организации-владельца</div>
          <div style="display: flex; align-items: baseline; margin-top: 1px;">
            <span style="font-size: 6.5pt; white-space: nowrap; margin-right: 3px;">автотранспорта:</span>
            <!-- Подчеркивание 1 -->
            <span class="editable-field line-field" contenteditable="true" data-field="note1" style="flex: 1; font-size: 6.2pt;">${v('note1')}</span>
          </div>
        </div>

        <!-- Подчеркивание 2 -->
        <div style="margin-top: 2px;">
          <span class="editable-field line-field" contenteditable="true" data-field="note2" style="width: 100%; font-size: 6.2pt;">${v('note2')}</span>
        </div>

        <!-- Подчеркивание 3 -->
        <div style="margin-top: 2px;">
          <span class="editable-field line-field" contenteditable="true" data-field="note3" style="width: 100%; font-size: 6.2pt;">${v('note3')}</span>
        </div>

        <!-- Подчеркивание 4 -->
        <div style="margin-top: 2px;">
          <span class="editable-field line-field" contenteditable="true" data-field="note4" style="width: 100%; font-size: 6.2pt;">${v('note4')}</span>
        </div>

        <!-- Подчеркивание 5 -->
        <div style="margin-top: 2px; margin-bottom: 0.5mm;">
          <span class="editable-field line-field" contenteditable="true" data-field="note5" style="width: 100%; font-size: 6.2pt;">${v('note5')}</span>
        </div>

      </div>

    </div>
</div>

  <script>
    const initialValues = ${defaultDataJson};
    const currentVehReg = '${v('vehReg')}';

    // Встроенные стандартные шаблоны автопарка
    let vehicleTemplates = {
      'О 188 ТА 196': {
        vehBrand: 'ГАЗ 2834-LM (Валдай 6м)',
        vehReg: 'О 188 ТА 196',
        vehGarage: '096',
        driverTab: '096',
        driverFio: 'Никифоров Д.В.',
        driverLic: '99 45 273350',
        driverClass: 'B, C, CE',
        licRegNum: 'СТ-66/096',
        licSeries: 'АА',
        licNumber: '014829',
        code_workMode: '1',
        code_col: '1',
        code_brig: '1',
        t2_fuelBrand: 'ДТ',
        t2_fuelCode: '03',
        t2_fuelGiven: '150',
        t2_fuelStart: '45',
        dispFio: 'Шахмаев А.О.',
        dispSig: 'Шахмаев',
        mechOutFio: 'Нигомедьянов Р.Р.',
        mechOutSig: 'Нигомедьянов',
        driverAcceptFio: 'Никифоров Д.В.',
        driverAcceptSig: 'Никифоров',
        medRole: 'Медсестра',
        medSig: 'Шахмаева',
        medFio: 'Шахмаева О.В.',
        note1: 'Замечаний к ТС и водителю нет.'
      },
      'А 096 МВ 196': {
        vehBrand: 'ГАЗ 3010 FD (Валдай 6м)',
        vehReg: 'А 096 МВ 196',
        vehGarage: '095',
        driverTab: '095',
        driverFio: 'Насртдинов В.А.',
        driverLic: '66 12 841920',
        driverClass: 'B, C',
        licRegNum: 'СТ-66/095',
        licSeries: 'АА',
        licNumber: '014830',
        code_workMode: '1',
        code_col: '1',
        code_brig: '1',
        t2_fuelBrand: 'ДТ',
        t2_fuelCode: '03',
        t2_fuelGiven: '150',
        t2_fuelStart: '50',
        dispFio: 'Шахмаев А.О.',
        dispSig: 'Шахмаев',
        mechOutFio: 'Нигомедьянов Р.Р.',
        mechOutSig: 'Нигомедьянов',
        driverAcceptFio: 'Насртдинов В.А.',
        driverAcceptSig: 'Насртдинов',
        medRole: 'Медсестра',
        medSig: 'Шахмаева',
        medFio: 'Шахмаева О.В.',
        note1: 'Замечаний к ТС и водителю нет.'
      },
      'А 661 ТМ 196': {
        vehBrand: 'FUSO CANTER FE85DJ (5т)',
        vehReg: 'А 661 ТМ 196',
        vehGarage: '085',
        driverTab: '085',
        driverFio: 'Никифоров Д.В.',
        driverLic: '99 45 273350',
        driverClass: 'B, C, CE',
        licRegNum: 'СТ-66/085',
        licSeries: 'АА',
        licNumber: '014831',
        code_workMode: '1',
        code_col: '1',
        code_brig: '1',
        t2_fuelBrand: 'ДТ',
        t2_fuelCode: '03',
        t2_fuelGiven: '180',
        t2_fuelStart: '60',
        dispFio: 'Шахмаев А.О.',
        dispSig: 'Шахмаев',
        mechOutFio: 'Нигомедьянов Р.Р.',
        mechOutSig: 'Нигомедьянов',
        driverAcceptFio: 'Никифоров Д.В.',
        driverAcceptSig: 'Никифоров',
        medRole: 'Медсестра',
        medSig: 'Шахмаева',
        medFio: 'Шахмаева О.В.',
        note1: 'Замечаний к ТС и водителю нет.'
      },
      'У 883 АР 96': {
        vehBrand: 'ГАЗ 331061 (Валдай 5м)',
        vehReg: 'У 883 АР 96',
        vehGarage: '083',
        driverTab: '083',
        driverFio: 'Насртдинов В.А.',
        driverLic: '66 12 841920',
        driverClass: 'B, C',
        licRegNum: 'СТ-66/083',
        licSeries: 'АА',
        licNumber: '014832',
        code_workMode: '1',
        code_col: '1',
        code_brig: '1',
        t2_fuelBrand: 'ДТ',
        t2_fuelCode: '03',
        t2_fuelGiven: '140',
        t2_fuelStart: '40',
        dispFio: 'Шахмаев А.О.',
        dispSig: 'Шахмаев',
        mechOutFio: 'Нигомедьянов Р.Р.',
        mechOutSig: 'Нигомедьянов',
        driverAcceptFio: 'Насртдинов В.А.',
        driverAcceptSig: 'Насртдинов',
        medRole: 'Медсестра',
        medSig: 'Шахмаева',
        medFio: 'Шахмаева О.В.',
        note1: 'Замечаний к ТС и водителю нет.'
      }
    };

    function showToast(msg, isSuccess = true) {
      const box = document.getElementById('toastBox');
      if (!box) return;
      box.style.display = 'block';
      box.innerHTML = '<div style="background: ' + (isSuccess ? '#059669' : '#dc2626') + '; color: #fff; padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.25);">' + msg + '</div>';
      setTimeout(() => { box.style.display = 'none'; }, 3000);
    }

    function normalizeReg(str) {
      if (!str) return '';
      return str.trim().toUpperCase().replace(/\s+/g, ' ');
    }

    function initTemplates() {
      try {
        const local = localStorage.getItem('salda_waybill_templates');
        if (local) {
          const parsed = JSON.parse(local);
          Object.keys(parsed).forEach(k => {
            vehicleTemplates[normalizeReg(k)] = parsed[k];
          });
        }
      } catch (e) {
        console.warn('LocalStorage templates error:', e);
      }

      fetch('/api/waybill-templates')
        .then(r => r.json())
        .then(data => {
          if (data?.templates) {
            Object.keys(data.templates).forEach(k => {
              vehicleTemplates[normalizeReg(k)] = data.templates[k];
            });
          }
          renderTemplateSelector();
        })
        .catch(() => renderTemplateSelector());
    }

    function renderTemplateSelector() {
      const sel = document.getElementById('templateSelector');
      if (!sel) return;
      sel.innerHTML = '<option value="">📋 Шаблоны авто...</option>';
      const keys = Object.keys(vehicleTemplates).sort();
      keys.forEach(k => {
        const opt = document.createElement('option');
        opt.value = k;
        const brand = vehicleTemplates[k].vehBrand ? ' (' + vehicleTemplates[k].vehBrand.split('(')[0].trim() + ')' : '';
        opt.textContent = '🚚 ' + k + brand;
        sel.appendChild(opt);
      });

      // Если есть шаблон под текущий номер машины в бланке — показываем кнопку 1-клик
      const curVeh = normalizeReg(document.querySelector('[data-field="vehReg"]')?.innerText || currentVehReg);
      const quickBtn = document.getElementById('quickApplyBtn');
      if (quickBtn) {
        if (curVeh && vehicleTemplates[curVeh]) {
          quickBtn.style.display = 'inline-flex';
          quickBtn.innerHTML = '⚡ Шаблон [' + curVeh + ']';
        } else {
          quickBtn.style.display = 'none';
        }
      }
    }

    function handleSelectTemplate(val) {
      if (!val) return;
      applyTemplate(val);
      document.getElementById('templateSelector').value = '';
    }

    function quickApplyCurrentVehicleTemplate() {
      const curVeh = normalizeReg(document.querySelector('[data-field="vehReg"]')?.innerText || currentVehReg);
      if (curVeh && vehicleTemplates[curVeh]) {
        applyTemplate(curVeh);
      } else {
        alert('Шаблон для автомобиля ' + curVeh + ' еще не сохранен. Нажмите «💾 + Шаблон», чтобы сохранить текущие данные!');
      }
    }

    function applyTemplate(vehicleReg) {
      const norm = normalizeReg(vehicleReg);
      const tpl = vehicleTemplates[norm];
      if (!tpl) {
        alert('Шаблон для ' + vehicleReg + ' не найден!');
        return;
      }

      const fields = tpl.fields || tpl;

      // Применяем все поля шаблона, кроме уникальных реквизитов документа (№ и дата)
      Object.keys(fields).forEach(field => {
        if (field === 'docNumber' || field === 'docDay' || field === 'docMonth' || field === 'docYear') return;
        const el = document.querySelector('[data-field="' + field + '"]');
        if (el) {
          el.innerText = fields[field] || '';
        }
      });

      renderTemplateSelector();
      showToast('✅ Шаблон авто "' + norm + '" успешно применен в 1 клик!');
    }

    function saveCurrentAsTemplate() {
      const curVehEl = document.querySelector('[data-field="vehReg"]');
      const suggestedReg = normalizeReg(curVehEl?.innerText || currentVehReg || 'О 188 ТА 196');

      const vehicleRegInput = prompt('Название шаблона (гос. номер автомобиля):', suggestedReg);
      if (!vehicleRegInput) return;
      const vehicleReg = normalizeReg(vehicleRegInput);

      const templateFields = {};
      document.querySelectorAll('.editable-field').forEach(el => {
        const field = el.getAttribute('data-field');
        if (field) {
          templateFields[field] = el.innerText.trim();
        }
      });

      // Сохраняем в память и LocalStorage
      vehicleTemplates[vehicleReg] = {
        name: vehicleReg,
        vehBrand: templateFields.vehBrand || '',
        updatedAt: new Date().toISOString(),
        fields: templateFields
      };

      try {
        localStorage.setItem('salda_waybill_templates', JSON.stringify(vehicleTemplates));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }

      // Сохраняем в Supabase базу через API
      fetch('/api/waybill-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicle_reg: vehicleReg, fields: templateFields })
      }).catch(err => console.warn('Sync server error:', err));

      renderTemplateSelector();
      showToast('✅ Шаблон для автомобиля "' + vehicleReg + '" сохранен!');
    }

    function clearAllFields() {
      if (!confirm('Очистить все поля бланка? Документ станет абсолютно пустым для ручного заполнения.')) return;
      document.querySelectorAll('.editable-field').forEach(el => {
        el.innerText = '';
      });
    }

    function resetDefaultData() {
      document.querySelectorAll('.editable-field').forEach(el => {
        const field = el.getAttribute('data-field');
        if (field && initialValues[field] !== undefined) {
          el.innerText = initialValues[field];
        }
      });
      renderTemplateSelector();
      showToast('🔄 Исходные данные из заявки восстановлены');
    }

    // Инициализация при открытии страницы
    initTemplates();
  </script>
</body>
</html>
`;
}
