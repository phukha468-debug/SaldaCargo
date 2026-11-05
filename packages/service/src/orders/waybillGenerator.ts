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

  const weightTonsFormatted = (data.assignment.weightTons || 3.1).toFixed(2);

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
    data.organization.address ||
      '624760, Свердловская обл., г. Верхняя Салда, ул. 25 Октября, д. 11, кв. 22',
    data.organization.phone ? `тел. ${data.organization.phone}` : '',
  ]
    .filter(Boolean)
    .join(', ');

  const defaultFields: Record<string, string> = {
    docSeries: series,
    docNumber: number,
    docDay: dateParts.day,
    docMonth: dateParts.month,
    docYear: dateParts.year,

    orgName: data.organization.name || 'ИП Нигамедьянов Александр Сергеевич',
    orgAddressPhone,
    okpo: data.organization.okpo || '32166580',

    workMode: 'Основной',
    columnNum: '1',
    brigadeNum: '1',

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

    // Таблица 3: Задание водителю
    t3_client: data.assignment.clientName || 'ПАО «Корпорация ВСМПО-АВИСМА»',
    t3_arr_time: data.assignment.arrivalPlanned || '09:30',
    t3_load_addr: data.assignment.loadingAddress || 'г. Заречный, промзона БЗСК, д 2',
    t3_unload_addr: data.assignment.unloadingAddress || 'г. Верхняя Салда, ул. Парковая, д 1',
    t3_cargo: data.assignment.cargoName || 'Металлопрокат',
    t3_trips: String(data.assignment.tripsCount || 1),
    t3_dist: String(distance),
    t3_tons: weightTonsFormatted,
    t3_total_tons: weightTonsFormatted,

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
      margin: 4mm 8mm 4mm 8mm;
    }
    html, body {
      margin: 0;
      padding: 0;
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      font-size: 6.2pt;
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
        height: 210mm !important;
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
        height: 100% !important;
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
      border: 1px solid #000;
      table-layout: fixed;
    }
    table.pl-table td, table.pl-table th {
      border: 1px solid #000;
      padding: 0.5px 1.5px;
      vertical-align: middle;
      font-size: 5.5pt;
      line-height: 1.05;
    }
    th.col-header {
      background-color: #fff;
      font-weight: normal;
      text-align: center;
      font-size: 5.2pt;
    }
    th.col-num {
      text-align: center;
      font-size: 5.0pt;
      font-weight: normal;
      padding: 0.5px !important;
    }
    .sub-prompt {
      font-size: 4.8pt;
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
      font-size: 5.8pt;
      line-height: 1.15;
    }
    .code-table {
      border-collapse: collapse;
      border: 1px solid #000;
      margin-left: auto;
    }
    .code-table td {
      border: 1px solid #000;
      padding: 1px 4px;
      font-size: 5.8pt;
      text-align: center;
    }

    /* Вертикальные таблицы Код (со скриншота оригинала) */
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
      font-size: 5.8pt;
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
  <div class="print-hide">
    <div style="display: flex; align-items: center; gap: 10px;">
      <span style="font-size: 16px;">📋</span>
      <div>
        <div style="font-weight: 700; font-size: 13px;">Путевой лист грузового автомобиля (Типовая форма № 4-С, ОКУД 0345004)</div>
        <div style="font-size: 11px; color: #94a3b8;">
          100% точное соответствие оригиналу Госкомстата РФ (с таблицами кодов и точными пропорциями) • Строго 1 лист A4
        </div>
      </div>
    </div>
    <div class="btn-group">
      <button class="btn btn-secondary" onclick="resetDefaultData()">🔄 Загрузить из заявки</button>
      <button class="btn btn-danger" onclick="clearAllFields()">🧹 Чистый бланк</button>
      <button class="btn btn-primary" onclick="window.print()">🖨️ Печать PDF</button>
    </div>
  </div>

  <!-- ======================== БЛАНК ФОРМЫ 4-С ======================== -->
  <div class="pl-page" id="waybillPage">
    
    <!-- 1. ВЕРХНЯЯ ШАПКА ДОКУМЕНТА (33 мм) -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; height: 33mm; margin-bottom: 1.5mm;">
      
      <!-- Левая часть: Штамп организации и Наименование -->
      <div style="width: 44%;">
        <div style="display: flex; gap: 8px; align-items: flex-start;">
          <div class="stamp-box" style="width: 32mm; height: 16.5mm; flex-shrink: 0;">
            <div>Место для штампа</div>
            <div>организации</div>
          </div>
          <div style="flex: 1; padding-top: 1px;">
            <div style="font-size: 6.8pt;">
              Организация &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="orgName" style="width: calc(100% - 68px); font-weight: bold;">${v('orgName')}</span>
            </div>
            <div style="margin-top: 2px;">
              <span class="editable-field line-field" contenteditable="true" data-field="orgAddressPhone" style="width: 100%;">${v('orgAddressPhone')}</span>
              <span class="sub-prompt">(наименование, адрес и номер телефона)</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Центральная часть: ПУТЕВОЙ ЛИСТ № ... -->
      <div style="width: 32%; text-align: center; padding-top: 0.5mm;">
        <div style="font-size: 11.5pt; font-weight: bold; letter-spacing: 0.5px; line-height: 1.0;">
          ПУТЕВОЙ ЛИСТ
        </div>
        <div style="font-size: 8.5pt; margin-top: 2px; line-height: 1.1;">
          грузового автомобиля &nbsp;№ <span class="editable-field line-field" contenteditable="true" data-field="docNumber" style="min-width: 60px; font-weight: bold; font-size: 9.5pt;">${v('docNumber')}</span>
        </div>
        <div style="font-size: 6.2pt; line-height: 1.0; margin-top: 1px;">
          (серия &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="docSeries" style="min-width: 30px; font-weight: bold;">${v('docSeries')}</span>)
        </div>
        <div style="font-size: 7.2pt; margin-top: 2.5px;">
          «<span class="editable-field line-field" contenteditable="true" data-field="docDay" style="min-width: 18px; font-weight: bold; text-align: center;">${v('docDay')}</span>»
          &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="docMonth" style="min-width: 70px; font-weight: bold; text-align: center;">${v('docMonth')}</span>
          &nbsp;20<span class="editable-field line-field" contenteditable="true" data-field="docYear" style="min-width: 18px; font-weight: bold; text-align: center;">${v('docYear')}</span> г.
        </div>
      </div>

      <!-- Правая часть: Утверждение формы и Таблица кодов -->
      <div style="width: 24%; text-align: right;">
        <div style="font-size: 5.6pt; line-height: 1.15; color: #000;">
          Типовая межотраслевая форма № 4-С<br>
          Утверждена постановлением Госкомстата России<br>
          от 28.11.97 № 78
        </div>
        <div style="margin-top: 2.5px; display: flex; justify-content: flex-end;">
          <table class="code-table">
            <tr>
              <td style="font-weight: bold; background: #fff;" colspan="2">Коды</td>
            </tr>
            <tr>
              <td style="text-align: left; padding: 1px 4px;">Форма по ОКУД</td>
              <td style="font-weight: bold; padding: 1px 6px;">0345004</td>
            </tr>
            <tr>
              <td style="text-align: left; padding: 1px 4px;">по ОКПО</td>
              <td style="font-weight: bold; padding: 1px 6px;"><span class="editable-field" contenteditable="true" data-field="okpo">${v('okpo')}</span></td>
            </tr>
          </table>
        </div>
      </div>

    </div>

    <!-- 2. СРЕДНИЙ БЛОК: СЛЕВА (ТС, ВОДИТЕЛЬ, ТАБЛИЦЫ КОДОВ) | СПРАВА (ТАБЛИЦА 1 И ТАБЛИЦА 2) (73 мм) -->
    <div style="display: flex; justify-content: space-between; height: 73mm; margin-bottom: 2mm;">
      
      <!-- ЛЕВЫЙ БЛОК (С ЛИНИЯМИ И ДВУМЯ ТАБЛИЦАМИ КОДОВ) (51.5% ~ 142.2 мм) -->
      <div style="width: 51.5%; display: flex; justify-content: space-between; font-size: 6.0pt;">
        
        <!-- Линии реквизитов слева от таблиц кодов (ширина 129.9 мм) -->
        <div style="width: calc(100% - 13.5mm); display: flex; flex-direction: column; justify-content: space-between;">
          
          <!-- Верхняя группа (Режим работы, Колонна, Бригада, Марка, Госномер, Водитель) -->
          <div style="height: 27.5mm; display: flex; flex-direction: column; justify-content: space-between;">
            <!-- Режим работы -->
            <div style="text-align: right; padding-right: 3px;">
              Режим работы &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="workMode" style="width: 38mm; text-align: left;">${v('workMode')}</span>
            </div>
            <!-- Колонна -->
            <div style="text-align: right; padding-right: 3px;">
              Колонна &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="columnNum" style="width: 38mm; text-align: left;">${v('columnNum')}</span>
            </div>
            <!-- Бригада -->
            <div style="text-align: right; padding-right: 3px;">
              Бригада &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="brigadeNum" style="width: 38mm; text-align: left;">${v('brigadeNum')}</span>
            </div>
            <!-- Разделительная линия под Бригадой -->
            <div style="border-bottom: 1px solid #000; width: 100%; margin: 0.5px 0;"></div>
            <!-- Марка автомобиля -->
            <div style="display: flex; justify-content: space-between;">
              <div style="width: 100%;">
                Марка автомобиля &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="vehBrand" style="width: calc(100% - 75px); font-weight: bold;">${v('vehBrand')}</span>
              </div>
            </div>
            <!-- Государственный номерной знак / Гаражный номер -->
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <div style="width: 62%;">
                Государственный номерной знак &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="vehReg" style="width: calc(100% - 130px); font-weight: bold; letter-spacing: 0.5px;">${v('vehReg')}</span>
              </div>
              <div style="width: 38%; text-align: right; padding-right: 3px;">
                Гаражный номер
              </div>
            </div>
            <!-- Водитель / Табельный номер -->
            <div>
              <div style="display: flex; justify-content: space-between; align-items: baseline;">
                <div style="width: 62%;">
                  Водитель &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="driverFio" style="width: calc(100% - 42px); font-weight: bold;">${v('driverFio')}</span>
                </div>
                <div style="width: 38%; text-align: right; padding-right: 3px;">
                  Табельный номер
                </div>
              </div>
              <span class="sub-prompt" style="width: 62%; text-align: center;">(фамилия, имя, отчество)</span>
            </div>
          </div>

          <!-- Средняя полоса (Удостоверение, Класс, Лицензионная карточка) -->
          <div style="margin: 1.5px 0;">
            <div style="display: flex; justify-content: space-between;">
              <div style="width: 65%;">
                Удостоверение № &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="driverLic" style="width: calc(100% - 75px); font-weight: bold;">${v('driverLic')}</span>
              </div>
              <div style="width: 35%;">
                Класс &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="driverClass" style="width: calc(100% - 30px); font-weight: bold; text-align: center;">${v('driverClass')}</span>
              </div>
            </div>
            <div style="margin-top: 1px;">
              <div style="display: flex; justify-content: space-between; align-items: baseline;">
                <div>Лицензионная карточка &nbsp;<b><u>стандартная</u></b>, <s>ограниченная</s></div>
                <div style="font-size: 4.8pt; color: #444;">(ненужное зачеркнуть)</div>
              </div>
              <div style="display: flex; justify-content: space-between; margin-top: 1px;">
                <div style="width: 48%;">
                  Регистрационный № &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="licRegNum" style="width: calc(100% - 82px);">${v('licRegNum')}</span>
                </div>
                <div style="width: 22%;">
                  Серия &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="licSeries" style="width: calc(100% - 28px); text-align: center;">${v('licSeries')}</span>
                </div>
                <div style="width: 30%;">
                  № &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="licNumber" style="width: calc(100% - 15px); text-align: center;">${v('licNumber')}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Нижняя группа: Прицепы 1..4 и Гаражный номер -->
          <div style="height: 25.5mm; display: flex; flex-direction: column; justify-content: space-between;">
            <!-- Прицеп 1 -->
            <div>
              <div style="display: flex; justify-content: space-between; align-items: baseline;">
                <div style="width: 30%;">
                  Прицеп 1 &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="pr1_brand" style="width: calc(100% - 40px);">${v('pr1_brand')}</span>
                </div>
                <div style="width: 44%;">
                  Гос. номер &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="pr1_reg" style="width: calc(100% - 48px); text-align: center;">${v('pr1_reg')}</span>
                </div>
                <div style="width: 26%; text-align: right; padding-right: 3px;">
                  Гаражный номер
                </div>
              </div>
              <span class="sub-prompt" style="width: 30%; text-align: left; padding-left: 40px;">(марка)</span>
            </div>
            <!-- Прицеп 2 -->
            <div>
              <div style="display: flex; justify-content: space-between; align-items: baseline;">
                <div style="width: 30%;">
                  Прицеп 2 &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="pr2_brand" style="width: calc(100% - 40px);">${v('pr2_brand')}</span>
                </div>
                <div style="width: 44%;">
                  Гос. номер &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="pr2_reg" style="width: calc(100% - 48px); text-align: center;">${v('pr2_reg')}</span>
                </div>
                <div style="width: 26%; text-align: right; padding-right: 3px;">
                  Гаражный номер
                </div>
              </div>
              <span class="sub-prompt" style="width: 30%; text-align: left; padding-left: 40px;">(марка)</span>
            </div>
            <!-- Прицеп 3 -->
            <div>
              <div style="display: flex; justify-content: space-between; align-items: baseline;">
                <div style="width: 30%;">
                  Прицеп 3 &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="pr3_brand" style="width: calc(100% - 40px);">${v('pr3_brand')}</span>
                </div>
                <div style="width: 44%;">
                  Гос. номер &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="pr3_reg" style="width: calc(100% - 48px); text-align: center;">${v('pr3_reg')}</span>
                </div>
                <div style="width: 26%; text-align: right; padding-right: 3px;">
                  Гаражный номер
                </div>
              </div>
              <span class="sub-prompt" style="width: 30%; text-align: left; padding-left: 40px;">(марка)</span>
            </div>
            <!-- Прицеп 4 -->
            <div>
              <div style="display: flex; justify-content: space-between; align-items: baseline;">
                <div style="width: 30%;">
                  Прицеп 4 &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="pr4_brand" style="width: calc(100% - 40px);">${v('pr4_brand')}</span>
                </div>
                <div style="width: 44%;">
                  Гос. номер &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="pr4_reg" style="width: calc(100% - 48px); text-align: center;">${v('pr4_reg')}</span>
                </div>
                <div style="width: 26%; text-align: right; padding-right: 3px;">
                  Гаражный номер
                </div>
              </div>
              <span class="sub-prompt" style="width: 30%; text-align: left; padding-left: 40px;">(марка)</span>
            </div>
          </div>

          <!-- Сопровождающие лица -->
          <div style="margin-top: 1px;">
            Сопровождающие лица: &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="escortPersons" style="width: calc(100% - 95px);">${v('escortPersons')}</span>
          </div>

        </div>

        <!-- КОЛОНКА ВЕРТИКАЛЬНЫХ ТАБЛИЦ «КОД» (ширина 12.3 мм) -->
        <div style="width: 12.3mm; display: flex; flex-direction: column; justify-content: space-between;">
          
          <!-- 1. Верхняя таблица Код (Режим, Колонна, Бригада, Гар. номер, Таб. номер) -->
          <table class="v-code-table" style="height: 27.5mm;">
            <thead>
              <tr style="height: 4.5mm;">
                <th>Код</th>
              </tr>
            </thead>
            <tbody>
              <!-- Режим работы -->
              <tr style="height: 4.2mm;">
                <td><span class="editable-field" contenteditable="true" data-field="code_workMode">${v('code_workMode')}</span></td>
              </tr>
              <!-- Колонна -->
              <tr style="height: 4.2mm;">
                <td><span class="editable-field" contenteditable="true" data-field="code_col">${v('code_col')}</span></td>
              </tr>
              <!-- Бригада -->
              <tr style="height: 4.2mm;">
                <td><span class="editable-field" contenteditable="true" data-field="code_brig">${v('code_brig')}</span></td>
              </tr>
              <!-- Гаражный номер авто -->
              <tr style="height: 5.2mm;">
                <td><span class="editable-field" contenteditable="true" data-field="vehGarage">${v('vehGarage')}</span></td>
              </tr>
              <!-- Табельный номер водителя -->
              <tr style="height: 5.2mm;">
                <td><span class="editable-field" contenteditable="true" data-field="driverTab">${v('driverTab')}</span></td>
              </tr>
            </tbody>
          </table>

          <!-- Промежуток между верхней и нижней таблицами Код (соответствует удостоверению и лицензии) -->
          <div style="height: 14mm;"></div>

          <!-- 2. Нижняя таблица Код (Гаражные номера 4-х прицепов) -->
          <table class="v-code-table" style="height: 25.5mm;">
            <tbody>
              <!-- Прицеп 1 -->
              <tr style="height: 6.3mm;">
                <td><span class="editable-field" contenteditable="true" data-field="code_pr1">${v('code_pr1')}</span></td>
              </tr>
              <!-- Прицеп 2 -->
              <tr style="height: 6.3mm;">
                <td><span class="editable-field" contenteditable="true" data-field="code_pr2">${v('code_pr2')}</span></td>
              </tr>
              <!-- Прицеп 3 -->
              <tr style="height: 6.3mm;">
                <td><span class="editable-field" contenteditable="true" data-field="code_pr3">${v('code_pr3')}</span></td>
              </tr>
              <!-- Прицеп 4 -->
              <tr style="height: 6.3mm;">
                <td><span class="editable-field" contenteditable="true" data-field="code_pr4">${v('code_pr4')}</span></td>
              </tr>
            </tbody>
          </table>

          <!-- Отступ под сопровождающие лица -->
          <div style="height: 4mm;"></div>

        </div>

      </div>

      <!-- РАЗДЕЛИТЕЛЬНЫЙ ПРОМЕЖУТОК МЕЖДУ КОЛОНКАМИ (2.9% ~ 7.9 мм) -->
      <div style="width: 2.9%;"></div>

      <!-- ПРАВЫЙ БЛОК: ТАБЛИЦА 1 И ТАБЛИЦА 2 (СТРОГО 45.6% ~ 125.6 мм) -->
      <div style="width: 45.6%; display: flex; flex-direction: column; justify-content: space-between;">
        
        <!-- ================= Таблица 1: Работа водителя и автомобиля ================= -->
        <div>
          <div style="text-align: center; font-weight: bold; font-size: 6.2pt; letter-spacing: 1px; margin-bottom: 0.5px;">
            Р а б о т а &nbsp; в о д и т е л я &nbsp; и &nbsp; а в т о м о б и л я
          </div>
          <table class="pl-table" style="height: 27.5mm;">
            <colgroup>
              <col style="width: 16.7%;">
              <col style="width: 7.4%;">
              <col style="width: 7.6%;">
              <col style="width: 7.6%;">
              <col style="width: 7.4%;">
              <col style="width: 7.1%;">
              <col style="width: 14.3%;">
              <col style="width: 31.9%;">
            </colgroup>
            <thead>
              <tr style="height: 6.4mm;">
                <th rowspan="2" class="col-header">операция</th>
                <th colspan="4" class="col-header">время по графику</th>
                <th rowspan="2" class="col-header">нулевой<br>пробег,<br>км</th>
                <th rowspan="2" class="col-header">показание<br>спидометра,<br>км</th>
                <th rowspan="2" class="col-header">время фактическое,<br>число, месяц, ч. мин.</th>
              </tr>
              <tr style="height: 3.2mm;">
                <th class="col-header" style="font-size: 4.8pt;">число</th>
                <th class="col-header" style="font-size: 4.8pt;">месяц</th>
                <th class="col-header" style="font-size: 4.8pt;">ч.</th>
                <th class="col-header" style="font-size: 4.8pt;">мин.</th>
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
          <div style="text-align: center; font-weight: bold; font-size: 6.2pt; letter-spacing: 1px; margin-bottom: 0.5px;">
            Д в и ж е н и е &nbsp; г о р ю ч е г о
          </div>
          <table class="pl-table" style="height: 38.4mm;">
            <colgroup>
              <col style="width: 9.6%;">
              <col style="width: 9.4%;">
              <col style="width: 9.2%;">
              <col style="width: 9.6%;">
              <col style="width: 10.6%;">
              <col style="width: 9.3%;">
              <col style="width: 13.2%;">
              <col style="width: 14.8%;">
              <col style="width: 10.5%;">
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
                <th class="col-header" style="font-size: 4.8pt;">марка</th>
                <th class="col-header" style="font-size: 4.8pt;">код марки</th>
                <th class="col-header" style="font-size: 4.8pt;">выезде, л</th>
                <th class="col-header" style="font-size: 4.8pt;">возвращении, л</th>
                <th class="col-header" style="font-size: 4.8pt;">спецоборудования</th>
                <th class="col-header" style="font-size: 4.8pt;">двигателя</th>
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
              <!-- Строка 3: Подписи лиц -->
              <tr style="height: 6.8mm; font-size: 5.0pt;">
                <td colspan="2" style="text-align: center; font-weight: bold; letter-spacing: 1px;">п о д п и с ь</td>
                <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t2_sig_refueler" style="font-size: 4.8pt;">${v('t2_sig_refueler') || 'заправщика'}</span></td>
                <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t2_sig_mech_out" style="font-size: 4.8pt;">${v('t2_sig_mech_out') || 'механика'}</span></td>
                <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t2_sig_mech_in" style="font-size: 4.8pt;">${v('t2_sig_mech_in') || 'механика'}</span></td>
                <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t2_sig_refueler_ret" style="font-size: 4.8pt;">${v('t2_sig_refueler_ret') || 'заправщика'}</span></td>
                <td colspan="3" style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t2_sig_disp" style="font-size: 4.8pt;">${v('t2_sig_disp') || 'диспетчера'}</span></td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

    </div>

    <!-- 3. ТАБЛИЦА 3: ЗАДАНИЕ ВОДИТЕЛЮ (НА ВСЮ ШИРИНУ ЛИСТА) (31 мм) -->
    <div style="height: 31mm; margin-bottom: 2mm;">
      <div style="text-align: center; font-weight: bold; font-size: 7.2pt; letter-spacing: 2px; margin-bottom: 1px;">
        З А Д А Н И Е &nbsp; &nbsp; В О Д И Т Е Л Ю
      </div>
      <table class="pl-table" style="height: 27mm;">
        <colgroup>
          <col style="width: 12.7%;">
          <col style="width: 12.1%;">
          <col style="width: 20.3%;">
          <col style="width: 18.8%;">
          <col style="width: 18.9%;">
          <col style="width: 5.8%;">
          <col style="width: 5.9%;">
          <col style="width: 5.5%;">
        </colgroup>
        <thead>
          <tr style="height: 7.5mm;">
            <th rowspan="2" class="col-header">в чье распоряжение (наиме-<br>нование и адрес заказчика)</th>
            <th rowspan="2" class="col-header">время прибытия,<br>ч. мин.</th>
            <th colspan="2" class="col-header">адрес пункта</th>
            <th rowspan="2" class="col-header">наименование груза</th>
            <th rowspan="2" class="col-header">количество<br>ездок</th>
            <th rowspan="2" class="col-header">расстояние,<br>км</th>
            <th rowspan="2" class="col-header">перевезти<br>тонн</th>
          </tr>
          <tr style="height: 3.5mm;">
            <th class="col-header" style="font-size: 4.8pt;">погрузки</th>
            <th class="col-header" style="font-size: 4.8pt;">разгрузки</th>
          </tr>
          <tr style="height: 3.2mm;">
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
          <!-- Строка 1: Основное задание рейса -->
          <tr style="height: 4.2mm;">
            <td><span class="editable-field" contenteditable="true" data-field="t3_client" style="font-weight: bold;">${v('t3_client')}</span></td>
            <td style="text-align: center;"><span class="editable-field" contenteditable="true" data-field="t3_arr_time">${v('t3_arr_time')}</span></td>
            <td><span class="editable-field" contenteditable="true" data-field="t3_load_addr">${v('t3_load_addr')}</span></td>
            <td><span class="editable-field" contenteditable="true" data-field="t3_unload_addr">${v('t3_unload_addr')}</span></td>
            <td><span class="editable-field" contenteditable="true" data-field="t3_cargo" style="font-weight: bold;">${v('t3_cargo')}</span></td>
            <td style="text-align: center; font-weight: bold;"><span class="editable-field" contenteditable="true" data-field="t3_trips">${v('t3_trips')}</span></td>
            <td style="text-align: center; font-weight: bold;"><span class="editable-field" contenteditable="true" data-field="t3_dist">${v('t3_dist')}</span></td>
            <td style="text-align: center; font-weight: bold;"><span class="editable-field" contenteditable="true" data-field="t3_tons">${v('t3_tons')}</span></td>
          </tr>
          <!-- Строка 2: Пустая строка -->
          <tr style="height: 3.8mm;">
            <td><span class="editable-field" contenteditable="true"></span></td>
            <td style="text-align: center;"><span class="editable-field" contenteditable="true"></span></td>
            <td><span class="editable-field" contenteditable="true"></span></td>
            <td><span class="editable-field" contenteditable="true"></span></td>
            <td><span class="editable-field" contenteditable="true"></span></td>
            <td style="text-align: center;"><span class="editable-field" contenteditable="true"></span></td>
            <td style="text-align: center;"><span class="editable-field" contenteditable="true"></span></td>
            <td style="text-align: center;"><span class="editable-field" contenteditable="true"></span></td>
          </tr>
          <!-- Строка 3: Пустая строка -->
          <tr style="height: 3.8mm;">
            <td><span class="editable-field" contenteditable="true"></span></td>
            <td style="text-align: center;"><span class="editable-field" contenteditable="true"></span></td>
            <td><span class="editable-field" contenteditable="true"></span></td>
            <td><span class="editable-field" contenteditable="true"></span></td>
            <td><span class="editable-field" contenteditable="true"></span></td>
            <td style="text-align: center;"><span class="editable-field" contenteditable="true"></span></td>
            <td style="text-align: center;"><span class="editable-field" contenteditable="true"></span></td>
            <td style="text-align: center;"><span class="editable-field" contenteditable="true"></span></td>
          </tr>
          <!-- Строка 4: Итого -->
          <tr style="height: 4.2mm; font-weight: bold;">
            <td colspan="5" style="border: none; border-left: 1px solid #000; border-bottom: 1px solid #000;"></td>
            <td colspan="2" style="text-align: right; border: 1px solid #000; padding-right: 6px;">Итого</td>
            <td style="text-align: center; border: 1px solid #000;"><span class="editable-field" contenteditable="true" data-field="t3_total_tons">${v('t3_total_tons')}</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 4. НИЖНИЙ БЛОК: СЛЕВА (ПОДПИСИ, ДОПУСК, МЕДОСМОТР) | СПРАВА (ОТМЕТКИ ОРГАНИЗАЦИИ) (42 мм) -->
    <div style="display: flex; justify-content: space-between; gap: 8px; height: 42mm;">
      
      <!-- Левая часть: Подписи и штампы допуска/осмотра (70.1% ~ 193.2 мм) -->
      <div style="width: 70.1%; font-size: 5.8pt; line-height: 1.25; display: flex; flex-direction: column; justify-content: space-between;">
        
        <!-- Линия 1: Проверка удостоверения и задание на горючее -->
        <div>
          Водительское удостоверение проверил, задание выдал, выдать горючего &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="fuelGivenDisp" style="min-width: 45px; font-weight: bold; text-align: center;">${v('fuelGivenDisp')}</span>&nbsp; литров
        </div>

        <!-- Линия 2: Диспетчер и Механик (допуск на выезд) -->
        <div style="display: flex; justify-content: space-between;">
          <div style="width: 48%;">
            Диспетчер &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="dispSig" style="width: 50px; text-align: center;">${v('dispSig')}</span>&nbsp; / <span class="editable-field line-field" contenteditable="true" data-field="dispFio" style="width: 90px; font-weight: bold; text-align: center;">${v('dispFio')}</span> /
            <div style="display: flex; justify-content: flex-end; gap: 15px; padding-right: 15px;">
              <span class="sub-prompt" style="width: 50px;">(подпись)</span>
              <span class="sub-prompt" style="width: 90px;">(расшифровка подписи)</span>
            </div>
          </div>
          <div style="width: 52%;">
            Автомобиль технически исправен. Выезд разрешен.<br>
            Механик &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="mechOutSig" style="width: 50px; text-align: center;">${v('mechOutSig')}</span>&nbsp; / <span class="editable-field line-field" contenteditable="true" data-field="mechOutFio" style="width: 100px; font-weight: bold; text-align: center;">${v('mechOutFio')}</span> /
            <div style="display: flex; justify-content: flex-end; gap: 15px; padding-right: 15px;">
              <span class="sub-prompt" style="width: 50px;">(подпись)</span>
              <span class="sub-prompt" style="width: 100px;">(расшифровка подписи)</span>
            </div>
          </div>
        </div>

        <!-- Линия 3: Автомобиль принял Водитель -->
        <div style="display: flex; justify-content: flex-end;">
          <div style="width: 52%;">
            Автомобиль принял Водитель &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="driverAcceptSig" style="width: 50px; text-align: center;">${v('driverAcceptSig')}</span>&nbsp; / <span class="editable-field line-field" contenteditable="true" data-field="driverAcceptFio" style="width: 100px; font-weight: bold; text-align: center;">${v('driverAcceptFio')}</span> /
            <div style="display: flex; justify-content: flex-end; gap: 15px; padding-right: 15px;">
              <span class="sub-prompt" style="width: 50px;">(подпись)</span>
              <span class="sub-prompt" style="width: 100px;">(расшифровка подписи)</span>
            </div>
          </div>
        </div>

        <!-- Линия 4: Медицинский допуск (Водитель по состоянию здоровья к управлению допущен) -->
        <div style="display: flex; align-items: flex-end; gap: 6px;">
          <div class="stamp-box" style="width: 25mm; height: 10.5mm; flex-shrink: 0; font-size: 5.0pt;">
            <div>Место для</div>
            <div>штампа</div>
          </div>
          <div style="flex: 1;">
            <div>Водитель по состоянию здоровья к управлению допущен</div>
            <div style="display: flex; gap: 8px; margin-top: 1px;">
              <div style="width: 32%;">
                <span class="editable-field line-field" contenteditable="true" data-field="medRole" style="width: 100%; text-align: center;">${v('medRole')}</span>
                <span class="sub-prompt">(должность)</span>
              </div>
              <div style="width: 30%;">
                <span class="editable-field line-field" contenteditable="true" data-field="medSig" style="width: 100%; text-align: center;">${v('medSig')}</span>
                <span class="sub-prompt">(подпись)</span>
              </div>
              <div style="width: 38%;">
                <span class="editable-field line-field" contenteditable="true" data-field="medFio" style="width: 100%; font-weight: bold; text-align: center;">${v('medFio')}</span>
                <span class="sub-prompt">(расшифровка подписи)</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Линия 5: Возвращение в гараж (Сдал водитель / Принял механик) -->
        <div>
          <div>
            При возвращении автомобиль <b>исправен</b> / <s>неисправен</s>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 1px;">
            <div style="width: 48%;">
              Сдал водитель &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="retDriverSig" style="width: 48px; text-align: center;">${v('retDriverSig')}</span>&nbsp; / <span class="editable-field line-field" contenteditable="true" data-field="retDriverFio" style="width: 90px; font-weight: bold; text-align: center;">${v('retDriverFio')}</span> /
              <div style="display: flex; justify-content: flex-end; gap: 15px; padding-right: 15px;">
                <span class="sub-prompt" style="width: 48px;">(подпись)</span>
                <span class="sub-prompt" style="width: 90px;">(расшифровка подписи)</span>
              </div>
            </div>
            <div style="width: 50%;">
              Принял механик &nbsp;<span class="editable-field line-field" contenteditable="true" data-field="retMechSig" style="width: 48px; text-align: center;">${v('retMechSig')}</span>&nbsp; / <span class="editable-field line-field" contenteditable="true" data-field="retMechFio" style="width: 95px; font-weight: bold; text-align: center;">${v('retMechFio')}</span> /
              <div style="display: flex; justify-content: flex-end; gap: 15px; padding-right: 15px;">
                <span class="sub-prompt" style="width: 48px;">(подпись)</span>
                <span class="sub-prompt" style="width: 95px;">(расшифровка подписи)</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Правая часть: Отметки организации-владельца автотранспорта (29.8% ~ 82.1 мм) -->
      <div style="width: 29.8%; border: 1px solid #000; padding: 2px 4px; display: flex; flex-direction: column;">
        <div style="font-weight: bold; font-size: 5.8pt; text-align: center; margin-bottom: 2px;">
          Отметки организации-владельца автотранспорта:
        </div>
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-around;">
          <div style="border-bottom: 1px solid #000; height: 5.5mm; font-size: 5.5pt; padding: 0 2px;">
            <span class="editable-field" contenteditable="true" data-field="note1">${v('note1')}</span>
          </div>
          <div style="border-bottom: 1px solid #000; height: 5.5mm; font-size: 5.5pt; padding: 0 2px;">
            <span class="editable-field" contenteditable="true" data-field="note2">${v('note2')}</span>
          </div>
          <div style="border-bottom: 1px solid #000; height: 5.5mm; font-size: 5.5pt; padding: 0 2px;">
            <span class="editable-field" contenteditable="true" data-field="note3">${v('note3')}</span>
          </div>
          <div style="border-bottom: 1px solid #000; height: 5.5mm; font-size: 5.5pt; padding: 0 2px;">
            <span class="editable-field" contenteditable="true" data-field="note4">${v('note4')}</span>
          </div>
          <div style="border-bottom: 1px solid #000; height: 5.5mm; font-size: 5.5pt; padding: 0 2px;">
            <span class="editable-field" contenteditable="true" data-field="note5">${v('note5')}</span>
          </div>
        </div>
      </div>

    </div>

  </div>

  <script>
    const defaultData = ${defaultDataJson};

    function clearAllFields() {
      if (!confirm('Очистить все поля бланка? Документ станет абсолютно чистым для ручного заполнения.')) return;
      document.querySelectorAll('.editable-field').forEach(el => {
        el.innerText = '';
      });
    }

    function resetDefaultData() {
      document.querySelectorAll('.editable-field').forEach(el => {
        const field = el.getAttribute('data-field');
        if (field && defaultData[field] !== undefined) {
          el.innerText = defaultData[field];
        }
      });
    }
  </script>
</body>
</html>`;
}
