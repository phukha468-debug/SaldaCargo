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
    return { day: '04', month: 'ноября', year: '26', dayMonth: '04.11', full: '04.11.2026' };

  let day = '01';
  let month = 'ноября';
  let year = '26';
  let dayMonth = '01.11';
  let full = '01.11.2026';

  if (dStr.includes('.')) {
    const p = dStr.split('.');
    day = p[0] || '01';
    const mNum = parseInt(p[1] || '1', 10);
    month = ruMonths[mNum - 1] || 'ноября';
    year = (p[2] || '2026').slice(-2);
    dayMonth = `${day}.${String(mNum).padStart(2, '0')}`;
    full = `${day}.${String(mNum).padStart(2, '0')}.${p[2] || '2026'}`;
  } else {
    const datePart = dStr.split('T')[0] || dStr;
    const p = datePart.split('-');
    year = (p[0] || '2026').slice(-2);
    const mNum = parseInt(p[1] || '1', 10);
    month = ruMonths[mNum - 1] || 'ноября';
    day = p[2] || '01';
    dayMonth = `${day}.${String(mNum).padStart(2, '0')}`;
    full = `${day}.${String(mNum).padStart(2, '0')}.${p[0] || '2026'}`;
  }
  return { day, month, year, dayMonth, full };
}

function formatTimeOnly(dtStr?: string, fallback = '08:00'): string {
  if (!dtStr) return fallback;
  if (/^\d{2}:\d{2}$/.test(dtStr)) return dtStr;
  const d = new Date(dtStr);
  if (isNaN(d.getTime())) return fallback;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function generateWaybill4cHtml(data: WaybillData, options?: { isEmpty?: boolean }): string {
  const isInitiallyEmpty = options?.isEmpty ?? false;
  const isCompleted = data.execution.phase === 'completed';
  const isDeparted = data.execution.phase === 'departed' || isCompleted;

  const dateParts = parseDateParts(data.date);
  const series = data.series || '26';
  const number = data.number || '9937/01';

  const plannedDepTime = formatTimeOnly(data.execution.plannedDeparture, '08:00');
  const plannedArrTime = formatTimeOnly(data.execution.plannedArrival, '18:00');
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
  const tkmFormatted = ((data.assignment.weightTons || 3.1) * distance).toFixed(1);

  const fuelGiven = data.execution.fuelGivenLiters ?? 150;
  const fuelStart = data.execution.fuelStartLiters ?? 45;
  const fuelEnd = isCompleted ? (data.execution.fuelEndLiters ?? 65) : '';
  const fuelNorm = data.execution.fuelConsumedNorm ?? 135;
  const fuelActual = data.execution.fuelConsumedActual ?? 130;
  const fuelSaved = isCompleted ? (data.execution.fuelSaved ?? 5) : '';

  const licenseFull =
    [data.driver.licenseSeries, data.driver.licenseNumber].filter(Boolean).join(' ') ||
    '99 31 051064';

  const defaultFields: Record<string, string> = {
    okpo: data.organization.okpo || '32166580',
    number,
    series,
    day: dateParts.day,
    month: dateParts.month,
    year: dateParts.year,
    orgName:
      data.organization.name || 'Индивидуальный предприниматель Нигамедьянов Александр Сергеевич',
    orgAddress: `${data.organization.address}${data.organization.phone ? ', тел. ' + data.organization.phone : ''}`,
    transType: 'Коммерческая перевозка грузов',
    transComm: 'Междугородное / Пригородное',
    vehBrand: data.vehicle.brand || 'ГАЗ 2834-LM (Валдай)',
    vehReg: data.vehicle.regNumber || 'О 188 ТА 196',
    vehGarage: data.vehicle.garageNumber || '096',
    trailBrand: data.vehicle.trailerBrand || '—',
    trailReg: data.vehicle.trailerRegNumber || '—',
    trailGarage: data.vehicle.trailerGarageNumber || '—',
    driverFio: data.driver.fio || 'Насртдинов Вячеслав Аксанович',
    driverTab: data.driver.tabNumber || '096',
    driverLic: licenseFull,
    driverClass: data.driver.licenseClass || 'C, CE',

    // Таблица 1
    t1_date1: dateParts.dayMonth,
    t1_time1: plannedDepTime,
    t1_date2: actualDepTime ? dateParts.dayMonth : '',
    t1_time2: actualDepTime,
    t1_odo1: odoStart,
    t1_zero1: '0',
    t1_date3: dateParts.dayMonth,
    t1_time3: plannedArrTime,
    t1_date4: actualArrTime ? dateParts.dayMonth : '',
    t1_time4: actualArrTime,
    t1_odo2: odoEnd,
    t1_zero2: '0',

    // Таблица 2 (Горючее)
    t2_fuelBrand: data.vehicle.fuelType || 'ДТ',
    t2_fuelCode: data.vehicle.fuelCode || '03',
    t2_fuelGiven: String(fuelGiven),
    t2_fuelStart: String(fuelStart),
    t2_fuelEnd: isCompleted ? String(fuelEnd) : '',
    t2_fuelReturn: '0',
    t2_fuelCoeff: '—',
    t2_specTime: '—',
    t2_engTime: isCompleted ? '08 ч 30 мин' : '—',

    // Контроль
    medDate: dateParts.full,
    medTime: data.dispatchAndControl.medicCheckTime || '07:45',
    medFio:
      data.dispatchAndControl.medicName || data.dispatchAndControl.dispatcherFio || 'Шахмаев А.О.',
    techDate: dateParts.full,
    techTime: data.dispatchAndControl.techCheckTime || '07:50',
    techFio: data.dispatchAndControl.mechanicFio || 'Нигомедьянов Р.Р.',
    fuelDispVal: String(fuelGiven),
    fuelDispFio: data.dispatchAndControl.dispatcherFio || 'Шахмаев А.О.',
    driverAcceptFio: data.driver.fio || 'Насртдинов В.А.',

    // Таблица 3 (Задание водителю)
    t3_client: data.assignment.clientName || 'ПАО «Корпорация ВСМПО-АВИСМА»',
    t3_arrPlanned: data.assignment.arrivalPlanned || '09:30',
    t3_depPlanned: data.assignment.departurePlanned || '16:30',
    t3_loadAddr: data.assignment.loadingAddress || 'г. Заречный, промзона БЗСК, д 2',
    t3_unloadAddr: data.assignment.unloadingAddress || 'г. В. Салда, ул. Парковая, д 1',
    t3_cargo: data.assignment.cargoName || 'Металлопрокат',
    t3_trips: String(data.assignment.tripsCount || 1),
    t3_dist: String(distance),
    t3_tons: weightTonsFormatted,
    t3_dispSig: data.dispatchAndControl.dispatcherFio || 'Шахмаев А.О.',
    retDriverSig: data.driver.fio || 'Насртдинов В.А.',
    retMechSig: data.dispatchAndControl.mechanicFio || 'Нигомедьянов Р.Р.',

    // Оборотная сторона (Таблица 4 - выполнение)
    t4_tnDoc: `ТН № ${data.number}`,
    t4_from: data.assignment.loadingAddress || 'г. Заречный, промзона БЗСК',
    t4_to: data.assignment.unloadingAddress || 'г. В. Салда, ул. Парковая, 1',
    t4_arr: data.assignment.arrivalPlanned || '09:30',
    t4_dep: data.assignment.departurePlanned || '16:30',
    t4_cargo: data.assignment.cargoName || 'Металлопрокат',
    t4_tons: weightTonsFormatted,
    t4_kmTot: String(distance),
    t4_kmCargo: String(distance),

    // Итого выполнение
    t4_totTons: weightTonsFormatted,
    t4_totKm: String(distance),
    t4_totKmCargo: String(distance),

    // Таблица 5 (Результаты)
    t5_normFuel: String(fuelNorm),
    t5_actFuel: String(fuelActual),
    t5_savedFuel: String(fuelSaved),
    t5_overFuel: '—',
    t5_timeTotal: data.execution.timeTotal || '9 ч 35 мин',
    t5_timeMotion: data.execution.timeInMotion || '7 ч 00 мин',
    t5_timeIdle: data.execution.timeIdle || '2 ч 35 мин',
    t5_trips: String(data.assignment.tripsCount || 1),
    t5_tons: weightTonsFormatted,
    t5_tkm: tkmFormatted,

    // Таблица 6 (Зарплата)
    t6_timePay: data.salary?.timePay || '1 500 ₽',
    t6_mileagePay: data.salary?.mileagePay || '4 200 ₽',
    t6_forwardPay: data.salary?.forwardingPay || '800 ₽',
    t6_dailyPay: data.salary?.dailyPay || '1 000 ₽',
    t6_totalPay: data.salary?.totalPay || '7 500 ₽',
    t6_taxFio:
      data.salary?.calculatorFio || data.dispatchAndControl.dispatcherFio || 'Шахмаев А.О.',
    t6_buhFio: data.salary?.accountantFio || 'Нигамедьянов А.С.',
    specialNotes:
      data.specialNotes ||
      `Маршрут: ${data.assignment.loadingAddress} → ${data.assignment.unloadingAddress} без происшествий. Замечаний к ТС нет. Груз сдан в полном объеме по ТН № ${data.number}.`,
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
  <title>Путевой лист № ${v('number') || '______'} от ${v('day')} ${v('month')} 20${v('year')} г. (Альбомный A4)</title>
  <style>
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page {
      size: A4 landscape;
      margin: 5mm 6mm 5mm 6mm;
    }
    body {
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      font-size: 7.2pt;
      line-height: 1.15;
      color: #000;
      background: #1e293b;
      margin: 0;
      padding: 15px 0;
    }
    .print-hide {
      max-width: 297mm;
      margin: 0 auto 12px auto;
      padding: 10px 18px;
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
    .btn-primary { background: #059669; }
    .btn-primary:hover { background: #047857; }
    .btn-secondary { background: #475569; }
    .btn-secondary:hover { background: #64748b; }
    .btn-danger { background: #dc2626; }
    .btn-danger:hover { background: #b91c1c; }
    
    .pl-page {
      width: 297mm;
      height: 210mm;
      min-height: 210mm;
      max-height: 210mm;
      margin: 0 auto 20px auto;
      background: #fff;
      padding: 5mm 7mm 5mm 7mm;
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.35);
      position: relative;
      overflow: hidden;
    }

    @media print {
      body {
        background: #fff !important;
        padding: 0 !important;
        margin: 0 !important;
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
        min-height: 0 !important;
        max-height: none !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        page-break-after: always;
        break-after: page;
        overflow: visible !important;
      }
    }

    /* Интерактивные редактируемые поля */
    .editable-field {
      display: inline-block;
      min-width: 14px;
      min-height: 1.15em;
      padding: 0 2px;
      border-radius: 2px;
      transition: background-color 0.15s ease;
      cursor: text;
    }
    .editable-field:hover {
      background-color: #fef08a;
    }
    .editable-field:focus {
      background-color: #fef9c3;
      outline: 1px solid #ca8a04;
    }
    .editable-field:empty::before {
      content: "";
      display: inline-block;
    }

    /* Таблицы формы 4-С (Альбомный вид) */
    table.pl-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #000;
      table-layout: fixed;
      margin-bottom: 2.5px;
    }
    table.pl-table td, table.pl-table th {
      border: 1px solid #000;
      padding: 1.5px 3px;
      vertical-align: middle;
      font-size: 6.9pt;
      line-height: 1.1;
    }
    th.center, td.center {
      text-align: center;
    }
    .col-header {
      background-color: #fff;
      font-weight: bold;
      text-align: center;
      font-size: 6.7pt;
    }
    .col-num {
      text-align: center;
      font-size: 5.9pt;
      font-weight: normal;
      background-color: #f8fafc;
      padding: 0.5px !important;
    }

    .sub-hint {
      display: block;
      font-size: 5.2pt;
      color: #334155;
      text-align: center;
      line-height: 1;
      margin-top: 0.5px;
    }
    .dotted-box {
      border: 1px dashed #475569;
      text-align: center;
      font-size: 6.2pt;
      color: #334155;
      padding: 3px;
      line-height: 1.15;
    }
    .code-grid {
      border-collapse: collapse;
      border: 1px solid #000;
      margin-left: auto;
    }
    .code-grid td, .code-grid th {
      border: 1px solid #000;
      padding: 1px 4px;
      font-size: 6.2pt;
      text-align: center;
    }
  </style>
</head>
<body>

  <!-- Верхняя плашка управления (скрывается при печати) -->
  <div class="print-hide">
    <div style="display: flex; align-items: center; gap: 10px;">
      <span style="font-size: 18px;">📋</span>
      <div>
        <div style="font-weight: 700; font-size: 14px;">Путевой лист грузового автомобиля № 4-С (ОКУД 0345004) — Альбомный формат (Landscape)</div>
        <div style="font-size: 11px; color: #94a3b8;">
          Фотографическая копия формы Госкомстата № 78 с предрейсовым контролем Минтранса РФ № 390. Любая графа редактируема.
        </div>
      </div>
    </div>
    <div class="btn-group">
      <button class="btn btn-secondary" onclick="resetDefaultData()" title="Восстановить исходные данные по заявке">
        <span>📄 Заполненный образец</span>
      </button>
      <button class="btn btn-danger" onclick="clearAllFields()" title="Очистить все поля для печати чистого бланка">
        <span>⬜ Очистить (Пустой бланк)</span>
      </button>
      <button class="btn btn-primary" onclick="window.print()" title="Распечатать или сохранить в PDF (Альбомная ориентация)">
        <span>🖨️ Печать / PDF</span>
      </button>
    </div>
  </div>

  <!-- ========================================================================= -->
  <!-- СТРАНИЦА 1: ЛИЦЕВАЯ СТОРОНА ПУТЕВОГО ЛИСТА № 4-С (АЛЬБОМНАЯ ОРИЕНТАЦИЯ)      -->
  <!-- ========================================================================= -->
  <div class="pl-page" id="page1">
    
    <!-- ВЕРХНЯЯ ШАПКА: 3 КОЛОНКИ (Штамп и организация / Заголовок документа / Коды формы) -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2px;">
      
      <!-- Левая колонка: Штамп организации -->
      <div style="width: 30%;">
        <div class="dotted-box" style="width: 65mm; height: 16mm; display: flex; align-items: center; justify-content: center;">
          Место для штампа<br>организации
        </div>
        <div style="font-size: 6.8pt; line-height: 1.2; margin-top: 2px;">
          Организация: <span class="editable-field" contenteditable="true" data-field="orgName" style="border-bottom: 1px solid #000; font-weight: bold; width: 75%;">${v('orgName')}</span>
          <span class="sub-hint">(наименование, адрес, номер телефона)</span>
        </div>
        <div style="font-size: 6.5pt; margin-top: 1px;">
          Адрес, тел.: <span class="editable-field" contenteditable="true" data-field="orgAddress" style="border-bottom: 1px solid #000; width: 80%;">${v('orgAddress')}</span>
        </div>
      </div>

      <!-- Центральная колонка: Название документа и даты -->
      <div style="width: 44%; text-align: center; padding-top: 1px;">
        <div style="font-size: 11pt; font-weight: 900; letter-spacing: 0.5px;">
          ПУТЕВОЙ ЛИСТ № <span class="editable-field" contenteditable="true" data-field="number" style="border-bottom: 1.5px solid #000; min-width: 60px; font-size: 11pt;">${v('number')}</span>
        </div>
        <div style="font-size: 8.5pt; font-weight: bold; margin-top: 1px;">
          грузового автомобиля серия <span class="editable-field" contenteditable="true" data-field="series" style="border-bottom: 1px solid #000; min-width: 35px;">${v('series')}</span>
          &nbsp;&nbsp;«<span class="editable-field" contenteditable="true" data-field="day" style="min-width: 20px;">${v('day')}</span>»
          <span class="editable-field" contenteditable="true" data-field="month" style="border-bottom: 1px solid #000; min-width: 80px;">${v('month')}</span>
          20<span class="editable-field" contenteditable="true" data-field="year" style="min-width: 18px;">${v('year')}</span> г.
        </div>
        <div style="display: flex; justify-content: space-around; font-size: 7pt; margin-top: 4px;">
          <div>
            Вид перевозки: <span class="editable-field" contenteditable="true" data-field="transType" style="border-bottom: 1px solid #000; font-weight: bold; min-width: 110px;">${v('transType')}</span>
          </div>
          <div>
            Вид сообщения: <span class="editable-field" contenteditable="true" data-field="transComm" style="border-bottom: 1px solid #000; font-weight: bold; min-width: 110px;">${v('transComm')}</span>
          </div>
        </div>
      </div>

      <!-- Правая колонка: Легенда Госкомстата и ОКУД/ОКПО -->
      <div style="width: 25%; text-align: right;">
        <div style="font-size: 5.8pt; line-height: 1.15; margin-bottom: 2px;">
          Типовая межотраслевая форма № 4-С<br>
          Утверждена постановлением Госкомстата РФ от 28.11.97 № 78
        </div>
        <table class="code-grid">
          <tr>
            <td style="width: 44mm; text-align: right; padding-right: 4px;"></td>
            <td style="width: 24mm; font-weight: bold; background: #f8fafc;">Коды</td>
          </tr>
          <tr>
            <td style="text-align: right; padding-right: 4px;">Форма по ОКУД</td>
            <td style="font-weight: bold; font-family: monospace; font-size: 7.5pt;">0345004</td>
          </tr>
          <tr>
            <td style="text-align: right; padding-right: 4px;">Организация по ОКПО</td>
            <td style="font-weight: bold; font-family: monospace;"><span class="editable-field" contenteditable="true" data-field="okpo">${v('okpo')}</span></td>
          </tr>
        </table>
      </div>

    </div>

    <!-- БЛОК СВЕДЕНИЙ ОБ АВТОМОБИЛЕ, ПРИЦЕПЕ И ВОДИТЕЛЕ (ШИРОКИЙ 1-РЯДНЫЙ СЕТОЧНЫЙ ВИД) -->
    <div style="border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 2px 0; margin-bottom: 3px; font-size: 6.9pt; line-height: 1.2;">
      <div style="display: flex; justify-content: space-between; align-items: baseline;">
        <div style="width: 42%;">
          Автомобиль <span class="editable-field" contenteditable="true" data-field="vehBrand" style="border-bottom: 1px solid #000; width: 75%; font-weight: bold;">${v('vehBrand')}</span>
          <span class="sub-hint">(марка, модель)</span>
        </div>
        <div style="width: 32%;">
          гос. номерной знак <span class="editable-field" contenteditable="true" data-field="vehReg" style="border-bottom: 1px solid #000; width: 55%; font-weight: bold; font-family: monospace;">${v('vehReg')}</span>
        </div>
        <div style="width: 24%; text-align: right;">
          Гаражный № <span class="editable-field" contenteditable="true" data-field="vehGarage" style="border-bottom: 1px solid #000; width: 50%; font-weight: bold;">${v('vehGarage')}</span>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 0.5px;">
        <div style="width: 42%;">
          Прицеп <span class="editable-field" contenteditable="true" data-field="trailBrand" style="border-bottom: 1px solid #000; width: 82%;">${v('trailBrand')}</span>
          <span class="sub-hint">(марка, модель)</span>
        </div>
        <div style="width: 32%;">
          гос. номерной знак <span class="editable-field" contenteditable="true" data-field="trailReg" style="border-bottom: 1px solid #000; width: 55%;">—</span>
        </div>
        <div style="width: 24%; text-align: right;">
          Гаражный № <span class="editable-field" contenteditable="true" data-field="trailGarage" style="border-bottom: 1px solid #000; width: 50%;">—</span>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 0.5px;">
        <div style="width: 42%;">
          Водитель <span class="editable-field" contenteditable="true" data-field="driverFio" style="border-bottom: 1px solid #000; width: 80%; font-weight: bold;">${v('driverFio')}</span>
          <span class="sub-hint">(фамилия, имя, отчество)</span>
        </div>
        <div style="width: 18%;">
          Табельный № <span class="editable-field" contenteditable="true" data-field="driverTab" style="border-bottom: 1px solid #000; width: 45%; font-weight: bold;">${v('driverTab')}</span>
        </div>
        <div style="width: 24%;">
          Удостоверение № <span class="editable-field" contenteditable="true" data-field="driverLic" style="border-bottom: 1px solid #000; width: 55%; font-weight: bold; font-family: monospace;">${v('driverLic')}</span>
        </div>
        <div style="width: 14%; text-align: right;">
          Класс <span class="editable-field" contenteditable="true" data-field="driverClass" style="border-bottom: 1px solid #000; width: 50%; font-weight: bold;">${v('driverClass')}</span>
        </div>
      </div>
    </div>

    <!-- ТАБЛИЦА 1 И ТАБЛИЦА 2: РЯДОМ ДРУГ С ДРУГОМ В АЛЬБОМНОМ ВИДЕ (ШТАТНЫЙ БАЛАНС ГОСКОМСТАТА 78) -->
    <div style="display: flex; justify-content: space-between; gap: 5px; margin-bottom: 2.5px;">
      
      <!-- ТАБЛИЦА 1: РАБОТА ВОДИТЕЛЯ И АВТОМОБИЛЯ (ГРАФЫ 1-7) -->
      <div style="width: 48%;">
        <div style="font-weight: bold; font-size: 6.8pt; text-transform: uppercase; margin-bottom: 1px;">
          1. Работа водителя и автомобиля
        </div>
        <table class="pl-table">
          <thead>
            <tr>
              <th rowspan="2" style="width: 27%;" class="col-header">Операция</th>
              <th colspan="2" style="width: 24%;" class="col-header">По графику</th>
              <th colspan="2" style="width: 24%;" class="col-header">Фактически</th>
              <th rowspan="2" style="width: 15%;" class="col-header">Спидометр, км</th>
              <th rowspan="2" style="width: 10%;" class="col-header">Нулевой, км</th>
            </tr>
            <tr>
              <th class="col-header" style="font-size: 5.8pt;">число, мес.</th>
              <th class="col-header" style="font-size: 5.8pt;">ч, мин</th>
              <th class="col-header" style="font-size: 5.8pt;">число, мес.</th>
              <th class="col-header" style="font-size: 5.8pt;">ч, мин</th>
            </tr>
            <tr>
              <th class="col-num">1</th>
              <th class="col-num">2</th>
              <th class="col-num">3</th>
              <th class="col-num">4</th>
              <th class="col-num">5</th>
              <th class="col-num">6</th>
              <th class="col-num">7</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><b>Выезд из гаража</b></td>
              <td class="center"><span class="editable-field" contenteditable="true" data-field="t1_date1">${v('t1_date1')}</span></td>
              <td class="center"><span class="editable-field" contenteditable="true" data-field="t1_time1">${v('t1_time1')}</span></td>
              <td class="center"><span class="editable-field" contenteditable="true" data-field="t1_date2">${v('t1_date2')}</span></td>
              <td class="center"><span class="editable-field" contenteditable="true" data-field="t1_time2" style="font-weight: bold;">${v('t1_time2')}</span></td>
              <td class="center"><span class="editable-field" contenteditable="true" data-field="t1_odo1" style="font-weight: bold; font-family: monospace;">${v('t1_odo1')}</span></td>
              <td class="center"><span class="editable-field" contenteditable="true" data-field="t1_zero1">${v('t1_zero1')}</span></td>
            </tr>
            <tr>
              <td><b>Возвращение</b></td>
              <td class="center"><span class="editable-field" contenteditable="true" data-field="t1_date3">${v('t1_date3')}</span></td>
              <td class="center"><span class="editable-field" contenteditable="true" data-field="t1_time3">${v('t1_time3')}</span></td>
              <td class="center"><span class="editable-field" contenteditable="true" data-field="t1_date4">${v('t1_date4')}</span></td>
              <td class="center"><span class="editable-field" contenteditable="true" data-field="t1_time4" style="font-weight: bold;">${v('t1_time4')}</span></td>
              <td class="center"><span class="editable-field" contenteditable="true" data-field="t1_odo2" style="font-weight: bold; font-family: monospace;">${v('t1_odo2')}</span></td>
              <td class="center"><span class="editable-field" contenteditable="true" data-field="t1_zero2">${v('t1_zero2')}</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ТАБЛИЦА 2: ДВИЖЕНИЕ ГОРЮЧЕГО (ГРАФЫ 8-16) -->
      <div style="width: 51.5%;">
        <div style="font-weight: bold; font-size: 6.8pt; text-transform: uppercase; margin-bottom: 1px;">
          2. Движение горючего (горюче-смазочных материалов)
        </div>
        <table class="pl-table">
          <thead>
            <tr>
              <th rowspan="2" style="width: 12%;" class="col-header">Горючее (марка)</th>
              <th rowspan="2" style="width: 8%;" class="col-header">Код марки</th>
              <th rowspan="2" style="width: 10%;" class="col-header">Выдано, л</th>
              <th colspan="2" style="width: 22%;" class="col-header">Остаток, л</th>
              <th rowspan="2" style="width: 8%;" class="col-header">Сдано, л</th>
              <th rowspan="2" style="width: 12%;" class="col-header">Коэфф. нормы</th>
              <th colspan="2" style="width: 28%;" class="col-header">Время работы, ч, мин</th>
            </tr>
            <tr>
              <th class="col-header" style="font-size: 5.8pt;">выезд</th>
              <th class="col-header" style="font-size: 5.8pt;">возвр.</th>
              <th class="col-header" style="font-size: 5.8pt;">спецоборуд.</th>
              <th class="col-header" style="font-size: 5.8pt;">двигателя</th>
            </tr>
            <tr>
              <th class="col-num">8</th>
              <th class="col-num">9</th>
              <th class="col-num">10</th>
              <th class="col-num">11</th>
              <th class="col-num">12</th>
              <th class="col-num">13</th>
              <th class="col-num">14</th>
              <th class="col-num">15</th>
              <th class="col-num">16</th>
            </tr>
          </thead>
          <tbody>
            <tr class="center">
              <td><span class="editable-field" contenteditable="true" data-field="t2_fuelBrand" style="font-weight: bold;">${v('t2_fuelBrand')}</span></td>
              <td><span class="editable-field" contenteditable="true" data-field="t2_fuelCode">${v('t2_fuelCode')}</span></td>
              <td><span class="editable-field" contenteditable="true" data-field="t2_fuelGiven" style="font-weight: bold;">${v('t2_fuelGiven')}</span></td>
              <td><span class="editable-field" contenteditable="true" data-field="t2_fuelStart" style="font-weight: bold;">${v('t2_fuelStart')}</span></td>
              <td><span class="editable-field" contenteditable="true" data-field="t2_fuelEnd" style="font-weight: bold;">${v('t2_fuelEnd')}</span></td>
              <td><span class="editable-field" contenteditable="true" data-field="t2_fuelReturn">${v('t2_fuelReturn')}</span></td>
              <td><span class="editable-field" contenteditable="true" data-field="t2_fuelCoeff">${v('t2_fuelCoeff')}</span></td>
              <td><span class="editable-field" contenteditable="true" data-field="t2_specTime">${v('t2_specTime')}</span></td>
              <td><span class="editable-field" contenteditable="true" data-field="t2_engTime">${v('t2_engTime')}</span></td>
            </tr>
            <tr class="center">
              <td><span class="editable-field" contenteditable="true"></span></td>
              <td><span class="editable-field" contenteditable="true"></span></td>
              <td><span class="editable-field" contenteditable="true"></span></td>
              <td><span class="editable-field" contenteditable="true"></span></td>
              <td><span class="editable-field" contenteditable="true"></span></td>
              <td><span class="editable-field" contenteditable="true"></span></td>
              <td><span class="editable-field" contenteditable="true"></span></td>
              <td><span class="editable-field" contenteditable="true"></span></td>
              <td><span class="editable-field" contenteditable="true"></span></td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>

    <!-- БЛОК 3: ПРЕДРЕЙСОВЫЙ КОНТРОЛЬ МИНТРАНСА РФ № 390 И ВЫДАЧА ЗАДАНИЯ -->
    <div style="border: 1px solid #000; padding: 2px 6px; margin-bottom: 2.5px; font-size: 6.8pt; line-height: 1.2;">
      <div style="display: flex; justify-content: space-between; gap: 10px;">
        <!-- Медосмотр -->
        <div style="width: 50%; border-right: 1px solid #000; padding-right: 8px;">
          <div style="font-weight: bold; text-align: center; text-transform: uppercase; font-size: 6.8pt; margin-bottom: 1px;">
            Медицинский осмотр (Приказ Минтранса РФ № 390)
          </div>
          <div>
            Водитель по состоянию здоровья к управлению допущен.&nbsp;&nbsp;
            Дата: <span class="editable-field" contenteditable="true" data-field="medDate" style="font-weight: bold;">${v('medDate')}</span>&nbsp;&nbsp;
            Время: <span class="editable-field" contenteditable="true" data-field="medTime" style="font-weight: bold;">${v('medTime')}</span>
          </div>
          <div style="margin-top: 1px;">
            Медработник: _________________ / <span class="editable-field" contenteditable="true" data-field="medFio" style="font-weight: bold;">${v('medFio')}</span> /
          </div>
        </div>

        <!-- Техосмотр -->
        <div style="width: 50%; padding-left: 2px;">
          <div style="font-weight: bold; text-align: center; text-transform: uppercase; font-size: 6.8pt; margin-bottom: 1px;">
            Контроль технического состояния ТС (Приказ Минтранса РФ № 390)
          </div>
          <div>
            Выпуск на линию разрешен. Автомобиль технически исправен.&nbsp;&nbsp;
            Дата: <span class="editable-field" contenteditable="true" data-field="techDate" style="font-weight: bold;">${v('techDate')}</span>&nbsp;&nbsp;
            Время: <span class="editable-field" contenteditable="true" data-field="techTime" style="font-weight: bold;">${v('techTime')}</span>
          </div>
          <div style="margin-top: 1px;">
            Контролер (механик): _________________ / <span class="editable-field" contenteditable="true" data-field="techFio" style="font-weight: bold;">${v('techFio')}</span> /
          </div>
        </div>
      </div>

      <div style="border-top: 1px dashed #000; margin-top: 2px; padding-top: 1.5px; display: flex; justify-content: space-between;">
        <div>
          Выдать горючего: <span class="editable-field" contenteditable="true" data-field="fuelDispVal" style="font-weight: bold; border-bottom: 1px solid #000; min-width: 40px;">${v('fuelDispVal')}</span> л.
          Диспетчер: _________________ / <span class="editable-field" contenteditable="true" data-field="fuelDispFio">${v('fuelDispFio')}</span> /
        </div>
        <div>
          Автомобиль в исправном состоянии принял. Водитель: _________________ / <span class="editable-field" contenteditable="true" data-field="driverAcceptFio">${v('driverAcceptFio')}</span> /
        </div>
      </div>
    </div>

    <!-- ТАБЛИЦА 3: ЗАДАНИЕ ВОДИТЕЛЮ (ГРАФЫ 17-26 В ЕДИНОЙ СТРОКЕ НА ВСЮ ШИРИНУ АЛЬБОМНОГО ЛИСТА!) -->
    <div style="font-weight: bold; font-size: 6.9pt; text-transform: uppercase; margin-bottom: 1px;">
      3. Задание водителю:
    </div>
    <table class="pl-table">
      <thead>
        <tr>
          <th rowspan="2" style="width: 22%;" class="col-header">В чье распоряжение (Заказчик)</th>
          <th colspan="2" style="width: 11%;" class="col-header">Время, ч, мин</th>
          <th rowspan="2" style="width: 17%;" class="col-header">Пункт погрузки (адрес)</th>
          <th rowspan="2" style="width: 17%;" class="col-header">Пункт разгрузки (адрес)</th>
          <th rowspan="2" style="width: 13%;" class="col-header">Наименование груза</th>
          <th rowspan="2" style="width: 5%;" class="col-header">Ездок</th>
          <th rowspan="2" style="width: 5%;" class="col-header">Расст., км</th>
          <th rowspan="2" style="width: 5%;" class="col-header">Тонн</th>
          <th rowspan="2" style="width: 5%;" class="col-header">Задание выдал</th>
        </tr>
        <tr>
          <th class="col-header" style="font-size: 5.8pt;">прибытия</th>
          <th class="col-header" style="font-size: 5.8pt;">убытия</th>
        </tr>
        <tr>
          <th class="col-num">17</th>
          <th class="col-num">18</th>
          <th class="col-num">19</th>
          <th class="col-num">20</th>
          <th class="col-num">21</th>
          <th class="col-num">22</th>
          <th class="col-num">23</th>
          <th class="col-num">24</th>
          <th class="col-num">25</th>
          <th class="col-num">26</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><span class="editable-field" contenteditable="true" data-field="t3_client" style="font-weight: bold;">${v('t3_client')}</span></td>
          <td class="center"><span class="editable-field" contenteditable="true" data-field="t3_arrPlanned">${v('t3_arrPlanned')}</span></td>
          <td class="center"><span class="editable-field" contenteditable="true" data-field="t3_depPlanned">${v('t3_depPlanned')}</span></td>
          <td><span class="editable-field" contenteditable="true" data-field="t3_loadAddr">${v('t3_loadAddr')}</span></td>
          <td><span class="editable-field" contenteditable="true" data-field="t3_unloadAddr">${v('t3_unloadAddr')}</span></td>
          <td><span class="editable-field" contenteditable="true" data-field="t3_cargo" style="font-weight: bold;">${v('t3_cargo')}</span></td>
          <td class="center"><span class="editable-field" contenteditable="true" data-field="t3_trips" style="font-weight: bold;">${v('t3_trips')}</span></td>
          <td class="center"><span class="editable-field" contenteditable="true" data-field="t3_dist" style="font-weight: bold;">${v('t3_dist')}</span></td>
          <td class="center"><span class="editable-field" contenteditable="true" data-field="t3_tons" style="font-weight: bold;">${v('t3_tons')}</span></td>
          <td class="center"><span class="editable-field" contenteditable="true" data-field="t3_dispSig">${v('t3_dispSig')}</span></td>
        </tr>
        <tr>
          <td><span class="editable-field" contenteditable="true"></span></td>
          <td class="center"><span class="editable-field" contenteditable="true"></span></td>
          <td class="center"><span class="editable-field" contenteditable="true"></span></td>
          <td><span class="editable-field" contenteditable="true"></span></td>
          <td><span class="editable-field" contenteditable="true"></span></td>
          <td><span class="editable-field" contenteditable="true"></span></td>
          <td class="center"><span class="editable-field" contenteditable="true"></span></td>
          <td class="center"><span class="editable-field" contenteditable="true"></span></td>
          <td class="center"><span class="editable-field" contenteditable="true"></span></td>
          <td class="center"><span class="editable-field" contenteditable="true"></span></td>
        </tr>
      </tbody>
    </table>

    <!-- ПОДПИСИ ПРИ ВОЗВРАЩЕНИИ АВТОМОБИЛЯ -->
    <div style="border: 1px solid #000; padding: 2px 6px; margin-top: 2.5px; font-size: 6.8pt; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <b>При возвращении:</b> Автомобиль сдал водитель: _________________ / <span class="editable-field" contenteditable="true" data-field="retDriverSig">${v('retDriverSig')}</span> /
      </div>
      <div>
        Принял механик: _________________ / <span class="editable-field" contenteditable="true" data-field="retMechSig">${v('retMechSig')}</span> /
      </div>
    </div>

  </div>

  <!-- ========================================================================= -->
  <!-- СТРАНИЦА 2: ОБОРОТНАЯ СТОРОНА ПУТЕВОГО ЛИСТА № 4-С (АЛЬБОМНАЯ ОРИЕНТАЦИЯ)     -->
  <!-- ========================================================================= -->
  <div class="pl-page" id="page2">
    
    <div style="text-align: center; font-weight: bold; font-size: 8.5pt; text-transform: uppercase; margin-bottom: 2px;">
      ВЫПОЛНЕНИЕ ЗАДАНИЯ
    </div>

    <!-- ТАБЛИЦА 4: ПОСЛЕДОВАТЕЛЬНОСТЬ ВЫПОЛНЕНИЯ ЗАДАНИЯ (ГРАФЫ 27-36) -->
    <table class="pl-table">
      <thead>
        <tr>
          <th rowspan="2" style="width: 4%;" class="col-header">№ ездки</th>
          <th rowspan="2" style="width: 14%;" class="col-header">Номера прилож. товарных док.</th>
          <th rowspan="2" style="width: 16%;" class="col-header">Откуда (пункт погрузки)</th>
          <th rowspan="2" style="width: 16%;" class="col-header">Куда (пункт разгрузки)</th>
          <th colspan="2" style="width: 12%;" class="col-header">Время, ч, мин</th>
          <th rowspan="2" style="width: 14%;" class="col-header">Наименование груза</th>
          <th rowspan="2" style="width: 8%;" class="col-header">Масса груза, т</th>
          <th colspan="2" style="width: 16%;" class="col-header">Пробег, км</th>
        </tr>
        <tr>
          <th class="col-header" style="font-size: 5.8pt;">прибытия</th>
          <th class="col-header" style="font-size: 5.8pt;">убытия</th>
          <th class="col-header" style="font-size: 5.8pt;">всего</th>
          <th class="col-header" style="font-size: 5.8pt;">с грузом</th>
        </tr>
        <tr>
          <th class="col-num">27</th>
          <th class="col-num">28</th>
          <th class="col-num">29</th>
          <th class="col-num">30</th>
          <th class="col-num">31</th>
          <th class="col-num">32</th>
          <th class="col-num">33</th>
          <th class="col-num">34</th>
          <th class="col-num">35</th>
          <th class="col-num">36</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="center"><span class="editable-field" contenteditable="true">1</span></td>
          <td class="center"><span class="editable-field" contenteditable="true" data-field="t4_tnDoc" style="font-weight: bold;">${v('t4_tnDoc')}</span></td>
          <td><span class="editable-field" contenteditable="true" data-field="t4_from">${v('t4_from')}</span></td>
          <td><span class="editable-field" contenteditable="true" data-field="t4_to">${v('t4_to')}</span></td>
          <td class="center"><span class="editable-field" contenteditable="true" data-field="t4_arr">${v('t4_arr')}</span></td>
          <td class="center"><span class="editable-field" contenteditable="true" data-field="t4_dep">${v('t4_dep')}</span></td>
          <td><span class="editable-field" contenteditable="true" data-field="t4_cargo">${v('t4_cargo')}</span></td>
          <td class="center"><span class="editable-field" contenteditable="true" data-field="t4_tons" style="font-weight: bold;">${v('t4_tons')}</span></td>
          <td class="center"><span class="editable-field" contenteditable="true" data-field="t4_kmTot" style="font-weight: bold;">${v('t4_kmTot')}</span></td>
          <td class="center"><span class="editable-field" contenteditable="true" data-field="t4_kmCargo" style="font-weight: bold;">${v('t4_kmCargo')}</span></td>
        </tr>
        <tr>
          <td class="center"><span class="editable-field" contenteditable="true">2</span></td>
          <td class="center"><span class="editable-field" contenteditable="true"></span></td>
          <td><span class="editable-field" contenteditable="true"></span></td>
          <td><span class="editable-field" contenteditable="true"></span></td>
          <td class="center"><span class="editable-field" contenteditable="true"></span></td>
          <td class="center"><span class="editable-field" contenteditable="true"></span></td>
          <td><span class="editable-field" contenteditable="true"></span></td>
          <td class="center"><span class="editable-field" contenteditable="true"></span></td>
          <td class="center"><span class="editable-field" contenteditable="true"></span></td>
          <td class="center"><span class="editable-field" contenteditable="true"></span></td>
        </tr>
        <tr>
          <td class="center"><span class="editable-field" contenteditable="true">3</span></td>
          <td class="center"><span class="editable-field" contenteditable="true"></span></td>
          <td><span class="editable-field" contenteditable="true"></span></td>
          <td><span class="editable-field" contenteditable="true"></span></td>
          <td class="center"><span class="editable-field" contenteditable="true"></span></td>
          <td class="center"><span class="editable-field" contenteditable="true"></span></td>
          <td><span class="editable-field" contenteditable="true"></span></td>
          <td class="center"><span class="editable-field" contenteditable="true"></span></td>
          <td class="center"><span class="editable-field" contenteditable="true"></span></td>
          <td class="center"><span class="editable-field" contenteditable="true"></span></td>
        </tr>
        <tr>
          <td class="center"><span class="editable-field" contenteditable="true">4</span></td>
          <td class="center"><span class="editable-field" contenteditable="true"></span></td>
          <td><span class="editable-field" contenteditable="true"></span></td>
          <td><span class="editable-field" contenteditable="true"></span></td>
          <td class="center"><span class="editable-field" contenteditable="true"></span></td>
          <td class="center"><span class="editable-field" contenteditable="true"></span></td>
          <td><span class="editable-field" contenteditable="true"></span></td>
          <td class="center"><span class="editable-field" contenteditable="true"></span></td>
          <td class="center"><span class="editable-field" contenteditable="true"></span></td>
          <td class="center"><span class="editable-field" contenteditable="true"></span></td>
        </tr>
        <tr style="font-weight: bold; background-color: #f8fafc;">
          <td colspan="7" style="text-align: right; padding-right: 8px;">ИТОГО:</td>
          <td class="center"><span class="editable-field" contenteditable="true" data-field="t4_totTons">${v('t4_totTons')}</span></td>
          <td class="center"><span class="editable-field" contenteditable="true" data-field="t4_totKm">${v('t4_totKm')}</span></td>
          <td class="center"><span class="editable-field" contenteditable="true" data-field="t4_totKmCargo">${v('t4_totKmCargo')}</span></td>
        </tr>
      </tbody>
    </table>

    <!-- ТАБЛИЦА 5 И ТАБЛИЦА 6: РЯДОМ ДРУГ С ДРУГОМ В АЛЬБОМНОМ ВИДЕ -->
    <div style="display: flex; justify-content: space-between; gap: 6px; margin-bottom: 3px;">
      
      <!-- ТАБЛИЦА 5: РЕЗУЛЬТАТЫ РАБОТЫ АВТОМОБИЛЯ И ПРИЦЕПОВ (ГРАФЫ 37-46) -->
      <div style="width: 58%;">
        <div style="font-weight: bold; font-size: 6.8pt; text-transform: uppercase; margin-bottom: 1px;">
          Результаты работы автомобиля и прицепов:
        </div>
        <table class="pl-table">
          <thead>
            <tr>
              <th colspan="4" style="width: 38%;" class="col-header">Расход горючего, л</th>
              <th colspan="3" style="width: 32%;" class="col-header">Время в наряде, ч, мин</th>
              <th colspan="3" style="width: 30%;" class="col-header">Объем работы</th>
            </tr>
            <tr>
              <th class="col-header" style="font-size: 5.7pt;">по норме</th>
              <th class="col-header" style="font-size: 5.7pt;">факт</th>
              <th class="col-header" style="font-size: 5.7pt;">эконом.</th>
              <th class="col-header" style="font-size: 5.7pt;">перерасх.</th>
              <th class="col-header" style="font-size: 5.7pt;">всего</th>
              <th class="col-header" style="font-size: 5.7pt;">в движ.</th>
              <th class="col-header" style="font-size: 5.7pt;">в простое</th>
              <th class="col-header" style="font-size: 5.7pt;">езд.</th>
              <th class="col-header" style="font-size: 5.7pt;">тонн</th>
              <th class="col-header" style="font-size: 5.7pt;">ткм</th>
            </tr>
            <tr>
              <th class="col-num">37</th>
              <th class="col-num">38</th>
              <th class="col-num">39</th>
              <th class="col-num">40</th>
              <th class="col-num">41</th>
              <th class="col-num">42</th>
              <th class="col-num">43</th>
              <th class="col-num">44</th>
              <th class="col-num">45</th>
              <th class="col-num">46</th>
            </tr>
          </thead>
          <tbody>
            <tr class="center">
              <td><span class="editable-field" contenteditable="true" data-field="t5_normFuel" style="font-weight: bold;">${v('t5_normFuel')}</span></td>
              <td><span class="editable-field" contenteditable="true" data-field="t5_actFuel" style="font-weight: bold;">${v('t5_actFuel')}</span></td>
              <td><span class="editable-field" contenteditable="true" data-field="t5_savedFuel" style="font-weight: bold; color: #047857;">${v('t5_savedFuel')}</span></td>
              <td><span class="editable-field" contenteditable="true" data-field="t5_overFuel">${v('t5_overFuel')}</span></td>
              <td><span class="editable-field" contenteditable="true" data-field="t5_timeTotal">${v('t5_timeTotal')}</span></td>
              <td><span class="editable-field" contenteditable="true" data-field="t5_timeMotion">${v('t5_timeMotion')}</span></td>
              <td><span class="editable-field" contenteditable="true" data-field="t5_timeIdle">${v('t5_timeIdle')}</span></td>
              <td><span class="editable-field" contenteditable="true" data-field="t5_trips" style="font-weight: bold;">${v('t5_trips')}</span></td>
              <td><span class="editable-field" contenteditable="true" data-field="t5_tons" style="font-weight: bold;">${v('t5_tons')}</span></td>
              <td><span class="editable-field" contenteditable="true" data-field="t5_tkm" style="font-weight: bold;">${v('t5_tkm')}</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ТАБЛИЦА 6: РАСЧЕТ ЗАРАБОТНОЙ ПЛАТЫ ВОДИТЕЛЮ (ГРАФЫ 47-51) -->
      <div style="width: 41%;">
        <div style="font-weight: bold; font-size: 6.8pt; text-transform: uppercase; margin-bottom: 1px;">
          Расчет заработной платы водителю:
        </div>
        <table class="pl-table">
          <thead>
            <tr>
              <th style="width: 20%;" class="col-header">За время</th>
              <th style="width: 20%;" class="col-header">За км / ткм</th>
              <th style="width: 20%;" class="col-header">Экспедир.</th>
              <th style="width: 20%;" class="col-header">Суточные/Премия</th>
              <th style="width: 20%;" class="col-header">ИТОГО</th>
            </tr>
            <tr>
              <th class="col-num">47</th>
              <th class="col-num">48</th>
              <th class="col-num">49</th>
              <th class="col-num">50</th>
              <th class="col-num">51</th>
            </tr>
          </thead>
          <tbody>
            <tr class="center">
              <td><span class="editable-field" contenteditable="true" data-field="t6_timePay">${v('t6_timePay')}</span></td>
              <td><span class="editable-field" contenteditable="true" data-field="t6_mileagePay" style="font-weight: bold;">${v('t6_mileagePay')}</span></td>
              <td><span class="editable-field" contenteditable="true" data-field="t6_forwardPay">${v('t6_forwardPay')}</span></td>
              <td><span class="editable-field" contenteditable="true" data-field="t6_dailyPay">${v('t6_dailyPay')}</span></td>
              <td><span class="editable-field" contenteditable="true" data-field="t6_totalPay" style="font-weight: bold; font-size: 7.8pt; color: #047857;">${v('t6_totalPay')}</span></td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>

    <!-- ПОДПИСИ РАСЧЕТОВ И ОСОБЫЕ ОТМЕТКИ -->
    <div style="border: 1px solid #000; padding: 3px 6px; font-size: 6.8pt; line-height: 1.25;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
        <div>
          Расчет произвел (таксировщик): _________________ / <span class="editable-field" contenteditable="true" data-field="t6_taxFio" style="font-weight: bold;">${v('t6_taxFio')}</span> /
        </div>
        <div>
          Бухгалтер: _________________ / <span class="editable-field" contenteditable="true" data-field="t6_buhFio">${v('t6_buhFio')}</span> /
        </div>
      </div>
      <div style="border-top: 1px solid #000; padding-top: 2px;">
        <b>Особые отметки (ГИБДД, заказчик, состояние дорог, температура, заправка):</b><br>
        <span class="editable-field" contenteditable="true" data-field="specialNotes" style="width: 100%; display: block; min-height: 14px;">
          ${v('specialNotes')}
        </span>
      </div>
    </div>

  </div>

  <script>
    const defaultData = ${defaultDataJson};

    // Очистить все редактируемые поля (Пустой бланк)
    function clearAllFields() {
      if (!confirm('Очистить все поля бланка? Документ станет абсолютно чистым для ручного заполнения.')) return;
      document.querySelectorAll('.editable-field').forEach(el => {
        el.innerText = '';
      });
    }

    // Заполнить / восстановить исходные данные
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
