const fs = require('fs');
const path = require('path');

const rows = [
  // 1. Предыдущий период из акта от 09.10.2026
  {
    date: '02.09.26',
    docLeft: 'Приход (28 от 02.09.2026)',
    docRight: 'Акт / Счёт № 28 от 02.09.2026',
    debitRight: 40000,
    creditRight: 0,
    unpaid: false,
  },
  {
    date: '06.09.26',
    docLeft: 'Приход (29 от 06.09.2026)',
    docRight: 'Акт / Счёт № 29 от 06.09.2026',
    debitRight: 50000,
    creditRight: 0,
    unpaid: false,
  },
  {
    date: '07.09.26',
    docLeft: 'Приход (30 от 07.09.2026)',
    docRight: 'Акт / Счёт № 30 от 07.09.2026',
    debitRight: 40000,
    creditRight: 0,
    unpaid: false,
  },
  {
    date: '10.09.26',
    docLeft: 'Приход (31 от 10.09.2026)',
    docRight: 'Акт / Счёт № 31 от 10.09.2026',
    debitRight: 50000,
    creditRight: 0,
    unpaid: false,
  },
  {
    date: '11.09.26',
    docLeft: 'Оплата (930 от 11.09.2026)',
    docRight: 'Оплата (п/п 930 от 11.09.2026)',
    debitRight: 0,
    creditRight: 130000,
    isPay: true,
  },
  {
    date: '12.09.26',
    docLeft: 'Приход (32 от 12.09.2026)',
    docRight: 'Акт / Счёт № 32 от 12.09.2026',
    debitRight: 30000,
    creditRight: 0,
    unpaid: false,
  },
  {
    date: '14.09.26',
    docLeft: 'Приход (33 от 14.09.2026)',
    docRight: 'Акт / Счёт № 33 от 14.09.2026',
    debitRight: 30000,
    creditRight: 0,
    unpaid: false,
  },
  {
    date: '14.09.26',
    docLeft: 'Приход (34 от 14.09.2026)',
    docRight: 'Акт / Счёт № 34 от 14.09.2026',
    debitRight: 40000,
    creditRight: 0,
    unpaid: false,
  },
  {
    date: '14.09.26',
    docLeft: 'Оплата (960 от 14.09.2026)',
    docRight: 'Оплата (п/п 960 от 14.09.2026)',
    debitRight: 0,
    creditRight: 80000,
    isPay: true,
  },
  {
    date: '15.09.26',
    docLeft: 'Приход (35 от 15.09.2026)',
    docRight: 'Акт / Счёт № 35 от 15.09.2026',
    debitRight: 50000,
    creditRight: 0,
    unpaid: false,
  },
  {
    date: '17.09.26',
    docLeft: 'Приход (36 от 17.09.2026)',
    docRight: 'Акт / Счёт № 36 от 17.09.2026',
    debitRight: 30000,
    creditRight: 0,
    unpaid: false,
  },
  {
    date: '18.09.26',
    docLeft: 'Приход (37 от 18.09.2026)',
    docRight: 'Акт / Счёт № 37 от 18.09.2026',
    debitRight: 40000,
    creditRight: 0,
    unpaid: false,
  },
  {
    date: '19.09.26',
    docLeft: 'Приход (38 от 19.09.2026)',
    docRight: 'Акт / Счёт № 38 от 19.09.2026',
    debitRight: 50000,
    creditRight: 0,
    unpaid: false,
  },
  {
    date: '21.09.26',
    docLeft: 'Приход (39 от 21.09.2026)',
    docRight: 'Акт / Счёт № 39 от 21.09.2026',
    debitRight: 30000,
    creditRight: 0,
    unpaid: false,
  },
  {
    date: '22.09.26',
    docLeft: 'Оплата от 22.09.2026',
    docRight: 'Оплата от 22.09.2026 (счета 33–38)',
    debitRight: 0,
    creditRight: 240000,
    isPay: true,
  },
  {
    date: '24.09.26',
    docLeft: 'Приход (40 от 24.09.2026)',
    docRight: 'Акт / Счёт № 40 от 24.09.2026',
    debitRight: 50000,
    creditRight: 0,
    unpaid: false,
  },
  {
    date: '30.09.26',
    docLeft: 'Оплата от 30.09.2026',
    docRight: 'Оплата от 30.09.2026 (счета 39, 40)',
    debitRight: 0,
    creditRight: 80000,
    isPay: true,
  },
  {
    date: '28.09.26',
    docLeft: 'Приход (41 от 28.09.2026)',
    docRight: 'Акт / Счёт № 41 от 28.09.2026',
    debitRight: 50000,
    creditRight: 0,
    unpaid: false,
  },
  {
    date: '01.10.26',
    docLeft: 'Приход (43 от 01.10.2026)',
    docRight: 'Акт / Счёт № 43 от 01.10.2026',
    debitRight: 15000,
    creditRight: 0,
    unpaid: false,
  },
  {
    date: '02.10.26',
    docLeft: 'Приход (42 от 02.10.2026)',
    docRight: 'Акт / Счёт № 42 от 02.10.2026',
    debitRight: 40000,
    creditRight: 0,
    unpaid: false,
  },
  {
    date: '06.10.26',
    docLeft: 'Приход (44 от 06.10.2026)',
    docRight: 'Акт / Счёт № 44 от 06.10.2026',
    debitRight: 50000,
    creditRight: 0,
    unpaid: false,
  },
  {
    date: '07.10.26',
    docLeft: 'Приход (45 от 07.10.2026)',
    docRight: 'Акт / Счёт № 45 от 07.10.2026',
    debitRight: 30000,
    creditRight: 0,
    unpaid: false,
  },
  {
    date: '09.10.26',
    docLeft: 'Приход (46 от 09.10.2026)',
    docRight: 'Акт / Счёт № 46 от 09.10.2026',
    debitRight: 50000,
    creditRight: 0,
    unpaid: false,
  },

  // 2. Новые операции после 09.10.2026
  {
    date: '09.10.26',
    docLeft: 'Оплата от 09.10.2026',
    docRight: 'Оплата от 09.10.2026 (счета 41–44)',
    debitRight: 0,
    creditRight: 155000,
    isPay: true,
  },
  {
    date: '13.10.26',
    docLeft: 'Приход (47 от 13.10.2026)',
    docRight: 'Акт / Счёт № 47 от 13.10.2026',
    debitRight: 40000,
    creditRight: 0,
    unpaid: false,
  },
  {
    date: '14.10.26',
    docLeft: 'Оплата от 14.10.2026',
    docRight: 'Оплата от 14.10.2026 (счета 45–47)',
    debitRight: 0,
    creditRight: 120000,
    isPay: true,
  },
  {
    date: '14.10.26',
    docLeft: 'Приход (от 14.10.2026)',
    docRight: 'Акт от 14.10.2026 (рейс 826)',
    debitRight: 6000,
    creditRight: 0,
    unpaid: false,
  },
  {
    date: '14.10.26',
    docLeft: 'Оплата от 14.10.2026',
    docRight: 'Оплата от 14.10.2026',
    debitRight: 0,
    creditRight: 6000,
    isPay: true,
  },
  {
    date: '15.10.26',
    docLeft: 'Приход (от 15.10.2026)',
    docRight: 'Акт от 15.10.2026 (погрузо-разгрузочные работы)',
    debitRight: 4000,
    creditRight: 0,
    unpaid: false,
  },
  {
    date: '15.10.26',
    docLeft: 'Оплата от 15.10.2026',
    docRight: 'Оплата от 15.10.2026',
    debitRight: 0,
    creditRight: 4000,
    isPay: true,
  },
  {
    date: '16.10.26',
    docLeft: 'Приход (48 от 16.10.2026)',
    docRight: 'Акт / Счёт № 48 от 16.10.2026',
    debitRight: 50000,
    creditRight: 0,
    unpaid: false,
  },
  {
    date: '17.10.26',
    docLeft: 'Приход (49/1 от 17.10.2026)',
    docRight: 'Акт / Счёт № 49(1) от 17.10.2026',
    debitRight: 26000,
    creditRight: 0,
    unpaid: false,
  },
  {
    date: '17.10.26',
    docLeft: 'Приход (49/2 от 17.10.2026)',
    docRight: 'Акт / Счёт № 49(2) от 17.10.2026',
    debitRight: 4000,
    creditRight: 0,
    unpaid: false,
  },
  {
    date: '19.10.26',
    docLeft: 'Приход (50/1 от 19.10.2026)',
    docRight: 'Акт / Счёт № 50(1) от 19.10.2026',
    debitRight: 26000,
    creditRight: 0,
    unpaid: false,
  },
  {
    date: '19.10.26',
    docLeft: 'Приход (50/2 от 19.10.2026)',
    docRight: 'Акт / Счёт № 50(2) от 19.10.2026',
    debitRight: 4000,
    creditRight: 0,
    unpaid: false,
  },
  {
    date: '19.10.26',
    docLeft: 'Оплата от 19.10.2026',
    docRight: 'Оплата от 19.10.2026 (счета 48–50)',
    debitRight: 0,
    creditRight: 110000,
    isPay: true,
  },

  // Неоплаченные на сегодняшний день:
  {
    date: '19.10.26',
    docLeft: 'Приход (51 от 19.10.2026)',
    docRight: 'Акт / Счёт № 51 от 19.10.2026',
    debitRight: 40000,
    creditRight: 0,
    unpaid: true,
  },
  {
    date: '22.10.26',
    docLeft: 'Приход (53 от 22.10.2026)',
    docRight: 'Акт / Счёт № 53 от 22.10.2026',
    debitRight: 50000,
    creditRight: 0,
    unpaid: true,
  },
  {
    date: '22.10.26',
    docLeft: 'Приход (54 от 22.10.2026)',
    docRight: 'Акт / Счёт № 54 от 22.10.2026',
    debitRight: 50000,
    creditRight: 0,
    unpaid: true,
  },
  {
    date: '23.10.26',
    docLeft: 'Приход (52 от 23.10.2026)',
    docRight: 'Акт / Счёт № 52 от 23.10.2026',
    debitRight: 18000,
    creditRight: 0,
    unpaid: true,
  },
  {
    date: '23.10.26',
    docLeft: 'Приход (55 от 23.10.2026)',
    docRight: 'Акт / Счёт № 55 от 23.10.2026',
    debitRight: 50000,
    creditRight: 0,
    unpaid: true,
  },
  {
    date: '24.10.26',
    docLeft: 'Приход (от 24.10.2026)',
    docRight: 'Акт от 24.10.2026 (Карпинск-Шайтанка)',
    debitRight: 4000,
    creditRight: 0,
    unpaid: true,
  },
];

function fmt(n) {
  if (!n) return '—';
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

let totalDebLeft = 0; // payments
let totalCredLeft = 0; // services
let totalDebRight = 0; // services
let totalCredRight = 0; // payments

rows.forEach((r) => {
  totalDebRight += r.debitRight;
  totalCredRight += r.creditRight;
  totalDebLeft += r.creditRight; // for client: Deb = payments, Cred = services
  totalCredLeft += r.debitRight;
});

const saldo = totalDebRight - totalCredRight;

const tableRowsHtml = rows
  .map((r, idx) => {
    const debLeftStr = fmt(r.creditRight);
    const credLeftStr = fmt(r.debitRight);
    const debRightStr = fmt(r.debitRight);
    const credRightStr = fmt(r.creditRight);

    const isBold = r.isPay;
    const isUnpaid = r.unpaid;

    const rightStyle = isUnpaid
      ? 'color: #b45309; font-weight: bold;'
      : isBold
        ? 'font-weight: bold;'
        : '';
    const leftStyle = isBold ? 'font-weight: bold;' : '';

    return `
    <tr>
      <td class="text-center">${r.date}</td>
      <td class="${leftStyle}">${r.docLeft}</td>
      <td class="text-right ${leftStyle}">${debLeftStr}</td>
      <td class="text-right ${leftStyle}">${credLeftStr}</td>
      <td class="text-center">${r.date}</td>
      <td class="${rightStyle}">${r.docRight}</td>
      <td class="text-right ${rightStyle}">${debRightStr}</td>
      <td class="text-right ${rightStyle}">${credRightStr}</td>
    </tr>
  `;
  })
  .join('');

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Акт сверки — ООО "ГЕОСТРОЙИНДУСТРИЯ" и ИП Нигамедьянов А.С.</title>
<style>
  @page {
    size: A4 portrait;
    margin: 8mm 8mm 8mm 8mm;
  }
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  body {
    font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
    color: #111827;
    background: #ffffff;
    font-size: 8.5pt;
    line-height: 1.25;
  }
  .act-title {
    text-align: center;
    font-size: 11pt;
    font-weight: bold;
    text-transform: uppercase;
    margin-bottom: 2px;
  }
  .act-period {
    text-align: center;
    font-size: 8.5pt;
    margin-bottom: 2px;
  }
  .act-parties {
    text-align: center;
    font-size: 8.5pt;
    font-weight: bold;
    margin-bottom: 6px;
  }
  .preamble {
    text-align: justify;
    font-size: 7.5pt;
    color: #374151;
    margin-bottom: 6px;
    line-height: 1.2;
  }
  table.reconciliation {
    width: 100%;
    border-collapse: collapse;
    font-size: 7pt;
    margin-bottom: 6px;
  }
  table.reconciliation th, table.reconciliation td {
    border: 1px solid #cbd5e1;
    padding: 2.2px 3.5px;
  }
  table.reconciliation th {
    background-color: #f1f5f9;
    font-weight: bold;
    text-align: center;
  }
  .party-header {
    background-color: #e2e8f0 !important;
    font-weight: bold;
    font-size: 7.5pt;
    text-align: center;
    padding: 3px !important;
  }
  .sub-header {
    background-color: #f8fafc;
    font-size: 6.5pt;
    font-weight: bold;
  }
  .text-center { text-align: center; }
  .text-right { text-align: right; white-space: nowrap; }
  .bold { font-weight: bold; }
  .totals-row {
    background-color: #f8fafc;
    font-weight: bold;
    border-top: 1.5px solid #64748b;
  }
  .saldo-row {
    background-color: #f1f5f9;
    font-weight: bold;
    border-bottom: 1.5px solid #64748b;
  }
  .summary-card {
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    background-color: #f8fafc;
    padding: 6px 10px;
    margin-top: 6px;
    margin-bottom: 10px;
    font-size: 7.5pt;
    line-height: 1.35;
  }
  .summary-card .debt-lead {
    font-weight: bold;
    color: #0f172a;
    margin-bottom: 2px;
  }
  .summary-card .debt-words {
    color: #475569;
    font-style: italic;
    margin-bottom: 4px;
  }
  .summary-card .unpaid-list {
    color: #0f172a;
    font-weight: 500;
  }
  .signatures {
    width: 100%;
    margin-top: 14px;
    display: flex;
    justify-content: space-between;
    page-break-inside: avoid;
  }
  .sign-col {
    width: 48%;
    font-size: 8pt;
  }
  .sign-col .org-name {
    font-weight: bold;
    margin-bottom: 14px;
  }
  .sign-col .role-line {
    display: flex;
    align-items: flex-end;
    margin-bottom: 10px;
  }
  .sign-col .line {
    flex: 1;
    border-bottom: 1px solid #111827;
    margin: 0 6px;
    height: 12px;
  }
  .sign-col .mp {
    margin-top: 6px;
    color: #475569;
    font-weight: bold;
    font-size: 7.5pt;
  }
  @media print {
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
</style>
</head>
<body>

  <div class="act-title">АКТ СВЕРКИ</div>
  <div class="act-period">взаимных расчетов за период: 02.09.2026 - 29.10.2026</div>
  <div class="act-parties">
    между ООО "ГЕОСТРОЙИНДУСТРИЯ" (ИНН 7415089601)<br>
    и ИП Нигамедьянов Александр Сергеевич (ИНН 660704814106)
  </div>

  <div class="preamble">
    Мы, нижеподписавшиеся, Директор ООО "ГЕОСТРОЙИНДУСТРИЯ" Ефременко Арсений Викторович, с одной стороны, и ИП Нигамедьянов Александр Сергеевич, с другой стороны, составили настоящий акт сверки в том, что состояние взаимных расчетов по данным учета следующее:
  </div>

  <table class="reconciliation">
    <thead>
      <tr>
        <th colspan="4" class="party-header">По данным ООО "ГЕОСТРОЙИНДУСТРИЯ", руб.</th>
        <th colspan="4" class="party-header">По данным ИП Нигамедьянов Александр Сергеевич, руб.</th>
      </tr>
      <tr class="sub-header">
        <th style="width: 46px;">Дата</th>
        <th>Документ</th>
        <th style="width: 58px;">Дебет</th>
        <th style="width: 58px;">Кредит</th>
        <th style="width: 46px;">Дата</th>
        <th>Документ</th>
        <th style="width: 58px;">Дебет</th>
        <th style="width: 58px;">Кредит</th>
      </tr>
    </thead>
    <tbody>
      <tr class="saldo-row">
        <td colspan="3" class="bold">Сальдо начальное на 02.09.2026</td>
        <td class="text-right bold">0,00</td>
        <td colspan="2" class="bold">Сальдо начальное на 02.09.2026</td>
        <td class="text-right bold">0,00</td>
        <td class="text-center bold">—</td>
      </tr>
      ${tableRowsHtml}
      <tr class="totals-row">
        <td colspan="2" class="bold">Обороты за период</td>
        <td class="text-right bold">${fmt(totalDebLeft)}</td>
        <td class="text-right bold">${fmt(totalCredLeft)}</td>
        <td colspan="2" class="bold">Обороты за период</td>
        <td class="text-right bold">${fmt(totalDebRight)}</td>
        <td class="text-right bold">${fmt(totalCredRight)}</td>
      </tr>
      <tr class="saldo-row">
        <td colspan="3" class="bold">Сальдо конечное на 29.10.2026</td>
        <td class="text-right bold">${fmt(saldo)}</td>
        <td colspan="2" class="bold">Сальдо конечное на 29.10.2026</td>
        <td class="text-right bold">${fmt(saldo)}</td>
        <td class="text-center bold">—</td>
      </tr>
    </tbody>
  </table>

  <div class="summary-card">
    <div class="debt-lead">
      По данным учета сторон на 29 октября 2026 года задолженность в пользу ИП Нигамедьянов Александр Сергеевич составляет ${fmt(saldo)} руб
    </div>
    <div class="debt-words">
      (Двести двенадцать тысяч рублей 00 копеек).
    </div>
    <div class="unpaid-list">
      <b>Неоплаченные счета:</b> № 51 (40 000 ₽), № 53 (50 000 ₽), № 54 (50 000 ₽), № 52 (18 000 ₽), № 55 (50 000 ₽), рейс б/н от 24.10.2026 (4 000 ₽).
    </div>
  </div>

  <div class="signatures">
    <div class="sign-col">
      <div class="org-name">От ООО "ГЕОСТРОЙИНДУСТРИЯ"</div>
      <div class="role-line">
        <span>Директор</span>
        <span class="line"></span>
        <span>(Ефременко А. В.)</span>
      </div>
      <div class="mp">М.П.</div>
    </div>
    <div class="sign-col">
      <div class="org-name">От ИП Нигамедьянов Александр Сергеевич</div>
      <div class="role-line">
        <span>ИП</span>
        <span class="line"></span>
        <span>(Нигамедьянов А. С.)</span>
      </div>
      <div class="mp">М.П.</div>
    </div>
  </div>

</body>
</html>
`;

fs.writeFileSync(
  path.join('c:\\salda\\docs\\reconciliation', 'akt-sverki-geostroy-2026-10-29.html'),
  html,
  'utf8',
);
console.log('HTML generated successfully.');
