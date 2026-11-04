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
    orgName: data.organization.name || 'ИП Нигамедьянов Александр Сергеевич',
    orgAddress: `${data.organization.address}${data.organization.phone ? ', тел. ' + data.organization.phone : ''}`,
    transType: 'Коммерческая перевозка',
    transComm: 'Междугородное',
    vehBrand: data.vehicle.brand || 'ГАЗ Валдай',
    vehReg: data.vehicle.regNumber || 'О 188 ТА 196',
    vehGarage: data.vehicle.garageNumber || '096',
    trailBrand: data.vehicle.trailerBrand || '—',
    trailReg: data.vehicle.trailerRegNumber || '—',
    trailGarage: data.vehicle.trailerGarageNumber || '—',
    driverFio: data.driver.fio || 'Насртдинов В.А.',
    driverTab: data.driver.tabNumber || '096',
    driverLic: licenseFull,
    driverClass: data.driver.licenseClass || 'C, CE',

    // Таблица 1 (Работа водителя и автомобиля - правый верх)
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

    // Таблица 2 (Движение горючего - под Таблицей 1)
    t2_fuelBrand: data.vehicle.fuelType || 'ДТ',
    t2_fuelCode: data.vehicle.fuelCode || '03',
    t2_fuelGiven: String(fuelGiven),
    t2_fuelStart: String(fuelStart),
    t2_fuelEnd: isCompleted ? String(fuelEnd) : '',
    t2_fuelReturn: '0',
    t2_fuelCoeff: '—',
    t2_specTime: '—',
    t2_engTime: isCompleted ? '08 ч 30 мин' : '—',

    // Предрейсовый контроль
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
    t3_dispSig: data.dispatchAndControl.dispatcherFio || 'Шахмаев',

    // Таблица 4 (Последовательность выполнения)
    t4_tnDoc: `ТН № ${data.number}`,
    t4_from: data.assignment.loadingAddress || 'г. Заречный, промзона БЗСК',
    t4_to: data.assignment.unloadingAddress || 'г. В. Салда, ул. Парковая, 1',
    t4_arr: data.assignment.arrivalPlanned || '09:30',
    t4_dep: data.assignment.departurePlanned || '16:30',
    t4_cargo: data.assignment.cargoName || 'Металлопрокат',
    t4_tons: weightTonsFormatted,
    t4_kmTot: String(distance),
    t4_kmCargo: String(distance),

    // Таблица 5 (Результаты работы ТС)
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

    // Таблица 6 (Расчет зарплаты)
    t6_timePay: data.salary?.timePay || '1 500 ₽',
    t6_mileagePay: data.salary?.mileagePay || '4 200 ₽',
    t6_forwardPay: data.salary?.forwardingPay || '800 ₽',
    t6_dailyPay: data.salary?.dailyPay || '1 000 ₽',
    t6_totalPay: data.salary?.totalPay || '7 500 ₽',

    // Подписи и отметки
    retDriverSig: data.driver.fio || 'Насртдинов В.А.',
    retMechSig: data.dispatchAndControl.mechanicFio || 'Нигомедьянов Р.Р.',
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
  <title>Путевой лист № ${v('number') || '______'} от ${v('day')} ${v('month')} 20${v('year')} г. (Альбомный A4, 1 страница)</title>
  <style>
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page {
      size: A4 landscape;
      margin: 4mm 6mm 4mm 6mm;
    }
    html, body {
      margin: 0;
      padding: 0;
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      font-size: 6.8pt;
      line-height: 1.15;
      color: #000;
      background: #1e293b;
    }
    body {
      padding: 10px 0;
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
      padding: 6px 13px;
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
    
    /* ЕДИНАЯ СТРАНИЦА А4 АЛЬБОМНАЯ */
    .pl-page {
      width: 297mm;
      height: 202mm;
      max-height: 202mm;
      margin: 0 auto;
      background: #fff;
      padding: 4mm 6mm 4mm 6mm;
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.35);
      position: relative;
      overflow: hidden;
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

    /* Интерактивные редактируемые поля */
    .editable-field {
      display: inline-block;
      min-width: 12px;
      min-height: 1.1em;
      padding: 0 1.5px;
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

    /* Таблицы формы 4-С */
    table.pl-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #000;
      table-layout: fixed;
      margin-bottom: 2px;
    }
    table.pl-table td, table.pl-table th {
      border: 1px solid #000;
      padding: 1px 2.5px;
      vertical-align: middle;
      font-size: 6.4pt;
      line-height: 1.05;
    }
    th.center, td.center {
      text-align: center;
    }
    .col-header {
      background-color: #fff;
      font-weight: bold;
      text-align: center;
      font-size: 6.2pt;
    }
    .col-num {
      text-align: center;
      font-size: 5.6pt;
      font-weight: normal;
      background-color: #f8fafc;
      padding: 0.5px !important;
    }

    .sub-hint {
      display: block;
      font-size: 5pt;
      color: #334155;
      text-align: center;
      line-height: 1;
      margin-top: 0.5px;
    }
    .dotted-box {
      border: 1px dashed #475569;
      text-align: center;
      font-size: 5.8pt;
      color: #334155;
      padding: 2px;
      line-height: 1.1;
    }
    .code-grid {
      border-collapse: collapse;
      border: 1px solid #000;
      margin-left: auto;
    }
    .code-grid td, .code-grid th {
      border: 1px solid #000;
      padding: 0.5px 3px;
      font-size: 5.8pt;
      text-align: center;
    }
  </style>
</head>
<body>

  <!-- Верхняя плашка управления (скрывается при печати) -->
  <div class="print-hide">
    <div style="display: flex; align-items: center; gap: 10px;">
      <span style="font-size: 17px;">📋</span>
      <div>
        <div style="font-weight: 700; font-size: 13.5px;">Путевой лист грузового автомобиля № 4-С (ОКУД 0345004) — 1 страница (Альбомная копия оригинала)</div>
        <div style="font-size: 11px; color: #94a3b8;">
          Строго 1 лист: справа вверху «Работа автомобиля», под ней «Движение горючего». Слева реквизиты, снизу задание и расчеты.
        </div>
      </div>
    </div>
    <div class="btn-group">
      <button class="btn btn-secondary" onclick="resetDefaultData()" title="Восстановить образец данных рейса">
        <span>📄 Заполненный образец</span>
      </button>
      <button class="btn btn-danger" onclick="clearAllFields()" title="Очистить все поля для печати чистого бланка">
        <span>⬜ Очистить (Пустой бланк)</span>
      </button>
      <button class="btn btn-primary" onclick="window.print()" title="Распечатать или сохранить в PDF (Ровно 1 лист)">
        <span>🖨️ Печать / PDF (1 лист)</span>
      </button>
    </div>
  </div>

  <!-- ========================================================================= -->
  <!-- ЕДИНСТВЕННАЯ СТРАНИЦА: ПУТЕВОЙ ЛИСТ № 4-С (ОКУД 0345004)                  -->
  <!-- ========================================================================= -->
  <div class="pl-page" id="page1">
    
    <!-- ВЕРХНЯЯ ПОЛОВИНА ЛИСТА: РАЗДЕЛЕНИЕ НА ЛЕВЫЙ И ПРАВЫЙ БЛОКИ (50% / 50%) -->
    <div style="display: flex; justify-content: space-between; gap: 6px; margin-bottom: 2px;">
      
      <!-- ЛЕВЫЙ БЛОК: Штамп, Организация, Заголовок, Автомобиль, Водитель -->
      <div style="width: 48.5%; font-size: 6.6pt; line-height: 1.18;">
        
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2px;">
          <!-- Штамп организации -->
          <div class="dotted-box" style="width: 48mm; height: 13mm; display: flex; align-items: center; justify-content: center;">
            Место для штампа организации
          </div>
          <!-- Организация -->
          <div style="width: calc(100% - 50mm); padding-left: 5px;">
            <div>
              Организация: <span class="editable-field" contenteditable="true" data-field="orgName" style="border-bottom: 1px solid #000; font-weight: bold; width: 75%;">${v('orgName')}</span>
            </div>
            <div style="margin-top: 1px;">
              Адрес, тел.: <span class="editable-field" contenteditable="true" data-field="orgAddress" style="border-bottom: 1px solid #000; width: 78%;">${v('orgAddress')}</span>
            </div>
          </div>
        </div>

        <!-- Заголовок документа -->
        <div style="text-align: center; margin: 2px 0;">
          <div style="font-size: 9.5pt; font-weight: 900; letter-spacing: 0.5px;">
            ПУТЕВОЙ ЛИСТ № <span class="editable-field" contenteditable="true" data-field="number" style="border-bottom: 1.5px solid #000; min-width: 50px; font-size: 9.5pt;">${v('number')}</span>
          </div>
          <div style="font-size: 7.8pt; font-weight: bold; margin-top: 0.5px;">
            грузового автомобиля серия <span class="editable-field" contenteditable="true" data-field="series" style="border-bottom: 1px solid #000; min-width: 25px;">${v('series')}</span>
            &nbsp;«<span class="editable-field" contenteditable="true" data-field="day" style="min-width: 16px;">${v('day')}</span>»
            <span class="editable-field" contenteditable="true" data-field="month" style="border-bottom: 1px solid #000; min-width: 65px;">${v('month')}</span>
            20<span class="editable-field" contenteditable="true" data-field="year" style="min-width: 16px;">${v('year')}</span> г.
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 6.3pt; margin-top: 1.5px;">
            <div>Вид перевозки: <span class="editable-field" contenteditable="true" data-field="transType" style="border-bottom: 1px solid #000; font-weight: bold;">${v('transType')}</span></div>
            <div>Вид сообщения: <span class="editable-field" contenteditable="true" data-field="transComm" style="border-bottom: 1px solid #000; font-weight: bold;">${v('transComm')}</span></div>
          </div>
        </div>

        <!-- Данные автомобиля и водителя -->
        <div style="border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 1.5px 0; margin-top: 2px;">
          <div style="display: flex; justify-content: space-between;">
            <div style="width: 48%;">
              Автомобиль <span class="editable-field" contenteditable="true" data-field="vehBrand" style="border-bottom: 1px solid #000; width: 70%; font-weight: bold;">${v('vehBrand')}</span>
            </div>
            <div style="width: 32%;">
              госномер <span class="editable-field" contenteditable="true" data-field="vehReg" style="border-bottom: 1px solid #000; width: 60%; font-weight: bold; font-family: monospace;">${v('vehReg')}</span>
            </div>
            <div style="width: 18%; text-align: right;">
              Гар. № <span class="editable-field" contenteditable="true" data-field="vehGarage" style="border-bottom: 1px solid #000; width: 45%; font-weight: bold;">${v('vehGarage')}</span>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; margin-top: 0.5px;">
            <div style="width: 48%;">
              Прицеп <span class="editable-field" contenteditable="true" data-field="trailBrand" style="border-bottom: 1px solid #000; width: 80%;">—</span>
            </div>
            <div style="width: 32%;">
              госномер <span class="editable-field" contenteditable="true" data-field="trailReg" style="border-bottom: 1px solid #000; width: 60%;">—</span>
            </div>
            <div style="width: 18%; text-align: right;">
              Гар. № <span class="editable-field" contenteditable="true" data-field="trailGarage" style="border-bottom: 1px solid #000; width: 45%;">—</span>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; margin-top: 0.5px;">
            <div style="width: 48%;">
              Водитель <span class="editable-field" contenteditable="true" data-field="driverFio" style="border-bottom: 1px solid #000; width: 78%; font-weight: bold;">${v('driverFio')}</span>
            </div>
            <div style="width: 24%;">
              Таб. № <span class="editable-field" contenteditable="true" data-field="driverTab" style="border-bottom: 1px solid #000; width: 50%; font-weight: bold;">${v('driverTab')}</span>
            </div>
            <div style="width: 26%; text-align: right;">
              Класс <span class="editable-field" contenteditable="true" data-field="driverClass" style="border-bottom: 1px solid #000; width: 60%; font-weight: bold;">${v('driverClass')}</span>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; margin-top: 0.5px;">
            <div style="width: 60%;">
              Удостоверение № <span class="editable-field" contenteditable="true" data-field="driverLic" style="border-bottom: 1px solid #000; width: 68%; font-weight: bold; font-family: monospace;">${v('driverLic')}</span>
            </div>
            <div style="width: 38%; text-align: right;">
              Лиценз. карт. <span class="editable-field" contenteditable="true" data-field="driverCard" style="border-bottom: 1px solid #000; width: 55%;">Стандартная</span>
            </div>
          </div>
        </div>

      </div>

      <!-- ПРАВЫЙ БЛОК: Коды, Таблица 1 (Работа ТС), под ней Таблица 2 (Движение горючего) -->
      <div style="width: 51%;">
        
        <!-- Верх правого блока: легенда и коды ОКУД -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
          <div style="font-size: 5.5pt; line-height: 1.1;">
            Типовая межотраслевая форма № 4-С<br>
            Утв. пост. Госкомстата РФ от 28.11.97 № 78
          </div>
          <table class="code-grid">
            <tr>
              <td style="padding: 0 4px;">Форма по ОКУД</td>
              <td style="font-weight: bold; font-family: monospace; font-size: 7pt; padding: 0 4px;">0345004</td>
              <td style="padding: 0 4px;">ОКПО</td>
              <td style="font-weight: bold; font-family: monospace; padding: 0 4px;"><span class="editable-field" contenteditable="true" data-field="okpo">${v('okpo')}</span></td>
            </tr>
          </table>
        </div>

        <!-- 1. ТАБЛИЦА: РАБОТА ВОДИТЕЛЯ И АВТОМОБИЛЯ (ВЕРХНЯЯ ПРАВАЯ ЧАСТЬ) -->
        <div style="font-weight: bold; font-size: 6.4pt; text-transform: uppercase; margin-bottom: 0.5px;">
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
              <th class="col-header" style="font-size: 5.3pt;">дата</th>
              <th class="col-header" style="font-size: 5.3pt;">ч, мин</th>
              <th class="col-header" style="font-size: 5.3pt;">дата</th>
              <th class="col-header" style="font-size: 5.3pt;">ч, мин</th>
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

        <!-- 2. ТАБЛИЦА: ДВИЖЕНИЕ ГОРЮЧЕГО (СТРОГО ПОД РАБОТОЙ АВТОМОБИЛЯ) -->
        <div style="font-weight: bold; font-size: 6.4pt; text-transform: uppercase; margin: 1px 0 0.5px 0;">
          2. Движение горючего (горюче-смазочных материалов)
        </div>
        <table class="pl-table">
          <thead>
            <tr>
              <th rowspan="2" style="width: 12%;" class="col-header">Горючее</th>
              <th rowspan="2" style="width: 7%;" class="col-header">Код</th>
              <th rowspan="2" style="width: 10%;" class="col-header">Выдано, л</th>
              <th colspan="2" style="width: 22%;" class="col-header">Остаток, л</th>
              <th rowspan="2" style="width: 8%;" class="col-header">Сдано, л</th>
              <th rowspan="2" style="width: 11%;" class="col-header">Коэфф.</th>
              <th colspan="2" style="width: 30%;" class="col-header">Время работы, ч, мин</th>
            </tr>
            <tr>
              <th class="col-header" style="font-size: 5.3pt;">выезд</th>
              <th class="col-header" style="font-size: 5.3pt;">возвр.</th>
              <th class="col-header" style="font-size: 5.3pt;">спецобор.</th>
              <th class="col-header" style="font-size: 5.3pt;">двигателя</th>
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
          </tbody>
        </table>

      </div>

    </div>

    <!-- ПОЛОСА ПРЕДРЕЙСОВОГО КОНТРОЛЯ МИНТРАНСА РФ № 390 И ВЫДАЧИ ЗАДАНИЯ -->
    <div style="border: 1px solid #000; padding: 1.5px 5px; margin-bottom: 2px; font-size: 6.4pt; line-height: 1.15;">
      <div style="display: flex; justify-content: space-between; gap: 8px;">
        <!-- Медосмотр -->
        <div style="width: 50%; border-right: 1px solid #000; padding-right: 6px;">
          <b>Медицинский осмотр (Приказ Минтранса № 390):</b> Водитель по состоянию здоровья к управлению допущен.<br>
          Дата: <span class="editable-field" contenteditable="true" data-field="medDate" style="font-weight: bold;">${v('medDate')}</span>
          Время: <span class="editable-field" contenteditable="true" data-field="medTime" style="font-weight: bold;">${v('medTime')}</span>&nbsp;&nbsp;
          Медработник: _________________ / <span class="editable-field" contenteditable="true" data-field="medFio" style="font-weight: bold;">${v('medFio')}</span> /
        </div>
        <!-- Техосмотр -->
        <div style="width: 50%; padding-left: 2px;">
          <b>Контроль технического состояния ТС (Приказ Минтранса № 390):</b> Выпуск на линию разрешен. Автомобиль исправен.<br>
          Дата: <span class="editable-field" contenteditable="true" data-field="techDate" style="font-weight: bold;">${v('techDate')}</span>
          Время: <span class="editable-field" contenteditable="true" data-field="techTime" style="font-weight: bold;">${v('techTime')}</span>&nbsp;&nbsp;
          Контролер (механик): _________________ / <span class="editable-field" contenteditable="true" data-field="techFio" style="font-weight: bold;">${v('techFio')}</span> /
        </div>
      </div>
      <div style="border-top: 1px dashed #000; margin-top: 1.5px; padding-top: 1px; display: flex; justify-content: space-between;">
        <div>
          Выдать горючего: <span class="editable-field" contenteditable="true" data-field="fuelDispVal" style="font-weight: bold; border-bottom: 1px solid #000; min-width: 30px;">${v('fuelDispVal')}</span> л.
          Диспетчер: _________________ / <span class="editable-field" contenteditable="true" data-field="fuelDispFio">${v('fuelDispFio')}</span> /
        </div>
        <div>
          Автомобиль в исправном состоянии принял. Водитель: _________________ / <span class="editable-field" contenteditable="true" data-field="driverAcceptFio">${v('driverAcceptFio')}</span> /
        </div>
      </div>
    </div>

    <!-- ТАБЛИЦА 3: ЗАДАНИЕ ВОДИТЕЛЮ (ГРАФЫ 17-26 НА ВСЮ ШИРИНУ ЛИСТА) -->
    <div style="font-weight: bold; font-size: 6.6pt; text-transform: uppercase; margin-bottom: 0.5px;">
      3. Задание водителю:
    </div>
    <table class="pl-table">
      <thead>
        <tr>
          <th rowspan="2" style="width: 21%;" class="col-header">В чье распоряжение (Заказчик)</th>
          <th colspan="2" style="width: 10%;" class="col-header">Время, ч, мин</th>
          <th rowspan="2" style="width: 17%;" class="col-header">Пункт погрузки (адрес)</th>
          <th rowspan="2" style="width: 17%;" class="col-header">Пункт разгрузки (адрес)</th>
          <th rowspan="2" style="width: 13%;" class="col-header">Наименование груза</th>
          <th rowspan="2" style="width: 5%;" class="col-header">Ездок</th>
          <th rowspan="2" style="width: 5%;" class="col-header">Расст., км</th>
          <th rowspan="2" style="width: 5%;" class="col-header">Тонн</th>
          <th rowspan="2" style="width: 7%;" class="col-header">Задание выдал</th>
        </tr>
        <tr>
          <th class="col-header" style="font-size: 5.3pt;">прибытия</th>
          <th class="col-header" style="font-size: 5.3pt;">убытия</th>
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

    <!-- ТАБЛИЦА 4: ПОСЛЕДОВАТЕЛЬНОСТЬ ВЫПОЛНЕНИЯ ЗАДАНИЯ (ГРАФЫ 27-36) -->
    <div style="font-weight: bold; font-size: 6.6pt; text-transform: uppercase; margin: 1px 0 0.5px 0;">
      4. Последовательность выполнения задания:
    </div>
    <table class="pl-table">
      <thead>
        <tr>
          <th rowspan="2" style="width: 4%;" class="col-header">№ ездки</th>
          <th rowspan="2" style="width: 14%;" class="col-header">Номера прилож. тов. док.</th>
          <th rowspan="2" style="width: 16%;" class="col-header">Откуда (пункт погрузки)</th>
          <th rowspan="2" style="width: 16%;" class="col-header">Куда (пункт разгрузки)</th>
          <th colspan="2" style="width: 10%;" class="col-header">Время, ч, мин</th>
          <th rowspan="2" style="width: 15%;" class="col-header">Наименование груза</th>
          <th rowspan="2" style="width: 7%;" class="col-header">Масса, т</th>
          <th colspan="2" style="width: 18%;" class="col-header">Пробег, км</th>
        </tr>
        <tr>
          <th class="col-header" style="font-size: 5.3pt;">прибытия</th>
          <th class="col-header" style="font-size: 5.3pt;">убытия</th>
          <th class="col-header" style="font-size: 5.3pt;">всего</th>
          <th class="col-header" style="font-size: 5.3pt;">с грузом</th>
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
          <td class="center"><span class="editable-field" contenteditable="true" data-field="t4_tnDoc" style="font-weight: bold;">1</span></td>
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
      </tbody>
    </table>

    <!-- НИЖНЯЯ ЧАСТЬ: РЕЗУЛЬТАТЫ РАБОТЫ ТС (58%) И РАСЧЕТ ЗАРПЛАТЫ (41%) БОК О БОК -->
    <div style="display: flex; justify-content: space-between; gap: 6px; margin-bottom: 2px;">
      
      <!-- ТАБЛИЦА 5: РЕЗУЛЬТАТЫ РАБОТЫ АВТОМОБИЛЯ И ПРИЦЕПОВ (ГРАФЫ 37-46) -->
      <div style="width: 58%;">
        <div style="font-weight: bold; font-size: 6.4pt; text-transform: uppercase; margin-bottom: 0.5px;">
          5. Результаты работы автомобиля и прицепов:
        </div>
        <table class="pl-table">
          <thead>
            <tr>
              <th colspan="4" style="width: 38%;" class="col-header">Расход горючего, л</th>
              <th colspan="3" style="width: 32%;" class="col-header">Время в наряде, ч, мин</th>
              <th colspan="3" style="width: 30%;" class="col-header">Объем работы</th>
            </tr>
            <tr>
              <th class="col-header" style="font-size: 5.3pt;">по норме</th>
              <th class="col-header" style="font-size: 5.3pt;">факт</th>
              <th class="col-header" style="font-size: 5.3pt;">эконом.</th>
              <th class="col-header" style="font-size: 5.3pt;">перерасх.</th>
              <th class="col-header" style="font-size: 5.3pt;">всего</th>
              <th class="col-header" style="font-size: 5.3pt;">в движ.</th>
              <th class="col-header" style="font-size: 5.3pt;">в простое</th>
              <th class="col-header" style="font-size: 5.3pt;">езд.</th>
              <th class="col-header" style="font-size: 5.3pt;">тонн</th>
              <th class="col-header" style="font-size: 5.3pt;">ткм</th>
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
        <div style="font-weight: bold; font-size: 6.4pt; text-transform: uppercase; margin-bottom: 0.5px;">
          6. Расчет заработной платы водителю:
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
              <td><span class="editable-field" contenteditable="true" data-field="t6_totalPay" style="font-weight: bold; font-size: 7.5pt; color: #047857;">${v('t6_totalPay')}</span></td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>

    <!-- ПОДПИСИ ПРИ ВОЗВРАЩЕНИИ И ОСОБЫЕ ОТМЕТКИ -->
    <div style="border: 1px solid #000; padding: 2px 5px; font-size: 6.4pt; line-height: 1.2;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <b>При возвращении:</b> Сдал водитель: _________________ / <span class="editable-field" contenteditable="true" data-field="retDriverSig">${v('retDriverSig')}</span> /
          &nbsp;&nbsp;&nbsp;&nbsp;Принял механик: _________________ / <span class="editable-field" contenteditable="true" data-field="retMechSig">${v('retMechSig')}</span> /
        </div>
        <div>
          Таксировщик: ____________ / <span class="editable-field" contenteditable="true" data-field="t6_taxFio">${v('t6_taxFio')}</span> /
          &nbsp;&nbsp;Бухгалтер: ____________ / <span class="editable-field" contenteditable="true" data-field="t6_buhFio">${v('t6_buhFio')}</span> /
        </div>
      </div>
      <div style="border-top: 1px solid #000; margin-top: 1.5px; padding-top: 1px;">
        <b>Особые отметки:</b> <span class="editable-field" contenteditable="true" data-field="specialNotes" style="width: 88%;">
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
