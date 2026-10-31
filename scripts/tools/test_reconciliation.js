const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function testList() {
  const cpId = '83db41b2-c050-4013-a878-bda2ab5c226e';

  // All orders from 02.09.2026
  // List from original act:
  const originalRows = [
    {
      date: '02.09.26',
      docLeft: 'Приход (28 от 02.09.2026)',
      docRight: 'Акт / Счёт № 28 от 02.09.2026',
      debitRight: 40000,
      creditRight: 0,
    },
    {
      date: '06.09.26',
      docLeft: 'Приход (29 от 06.09.2026)',
      docRight: 'Акт / Счёт № 29 от 06.09.2026',
      debitRight: 50000,
      creditRight: 0,
    },
    {
      date: '07.09.26',
      docLeft: 'Приход (30 от 07.09.2026)',
      docRight: 'Акт / Счёт № 30 от 07.09.2026',
      debitRight: 40000,
      creditRight: 0,
    },
    {
      date: '10.09.26',
      docLeft: 'Приход (31 от 10.09.2026)',
      docRight: 'Акт / Счёт № 31 от 10.09.2026',
      debitRight: 50000,
      creditRight: 0,
    },
    {
      date: '11.09.26',
      docLeft: 'Оплата (930 от 11.09.2026)',
      docRight: 'Оплата (п/п 930 от 11.09.2026)',
      debitRight: 0,
      creditRight: 130000,
    },
    {
      date: '12.09.26',
      docLeft: 'Приход (32 от 12.09.2026)',
      docRight: 'Акт / Счёт № 32 от 12.09.2026',
      debitRight: 30000,
      creditRight: 0,
    },
    {
      date: '14.09.26',
      docLeft: 'Приход (33 от 14.09.2026)',
      docRight: 'Акт / Счёт № 33 от 14.09.2026',
      debitRight: 30000,
      creditRight: 0,
    },
    {
      date: '14.09.26',
      docLeft: 'Приход (34 от 14.09.2026)',
      docRight: 'Акт / Счёт № 34 от 14.09.2026',
      debitRight: 40000,
      creditRight: 0,
    },
    {
      date: '14.09.26',
      docLeft: 'Оплата (960 от 14.09.2026)',
      docRight: 'Оплата (п/п 960 от 14.09.2026)',
      debitRight: 0,
      creditRight: 80000,
    },
    {
      date: '15.09.26',
      docLeft: 'Приход (35 от 15.09.2026)',
      docRight: 'Акт / Счёт № 35 от 15.09.2026',
      debitRight: 50000,
      creditRight: 0,
    },
    {
      date: '17.09.26',
      docLeft: 'Приход (36 от 17.09.2026)',
      docRight: 'Акт / Счёт № 36 от 17.09.2026',
      debitRight: 30000,
      creditRight: 0,
    },
    {
      date: '18.09.26',
      docLeft: 'Приход (37 от 18.09.2026)',
      docRight: 'Акт / Счёт № 37 от 18.09.2026',
      debitRight: 40000,
      creditRight: 0,
    },
    {
      date: '19.09.26',
      docLeft: 'Приход (38 от 19.09.2026)',
      docRight: 'Акт / Счёт № 38 от 19.09.2026',
      debitRight: 50000,
      creditRight: 0,
    },
    {
      date: '21.09.26',
      docLeft: 'Приход (39 от 21.09.2026)',
      docRight: 'Акт / Счёт № 39 от 21.09.2026',
      debitRight: 30000,
      creditRight: 0,
    },
    {
      date: '22.09.26',
      docLeft: 'Оплата от 22.09.2026',
      docRight: 'Оплата от 22.09.2026 (счета 33–38)',
      debitRight: 0,
      creditRight: 240000,
    },
    {
      date: '24.09.26',
      docLeft: 'Приход (40 от 24.09.2026)',
      docRight: 'Акт / Счёт № 40 от 24.09.2026',
      debitRight: 50000,
      creditRight: 0,
    },
    {
      date: '30.09.26',
      docLeft: 'Оплата от 30.09.2026',
      docRight: 'Оплата от 30.09.2026 (счета 39, 40)',
      debitRight: 0,
      creditRight: 80000,
    },
    {
      date: '28.09.26',
      docLeft: 'Приход (41 от 28.09.2026)',
      docRight: 'Акт / Счёт № 41 от 28.09.2026',
      debitRight: 50000,
      creditRight: 0,
    },
    {
      date: '01.10.26',
      docLeft: 'Приход (43 от 01.10.2026)',
      docRight: 'Акт / Счёт № 43 от 01.10.2026',
      debitRight: 15000,
      creditRight: 0,
    },
    {
      date: '02.10.26',
      docLeft: 'Приход (42 от 02.10.2026)',
      docRight: 'Акт / Счёт № 42 от 02.10.2026',
      debitRight: 40000,
      creditRight: 0,
    },
    {
      date: '06.10.26',
      docLeft: 'Приход (44 от 06.10.2026)',
      docRight: 'Акт / Счёт № 44 от 06.10.2026',
      debitRight: 50000,
      creditRight: 0,
    },
    {
      date: '07.10.26',
      docLeft: 'Приход (45 от 07.10.2026)',
      docRight: 'Акт / Счёт № 45 от 07.10.2026',
      debitRight: 30000,
      creditRight: 0,
    },
    {
      date: '09.10.26',
      docLeft: 'Приход (46 от 09.10.2026)',
      docRight: 'Акт / Счёт № 46 от 09.10.2026',
      debitRight: 50000,
      creditRight: 0,
    },
  ];

  // Now subsequent rows:
  const newRows = [
    {
      date: '09.10.26',
      docLeft: 'Оплата от 09.10.2026',
      docRight: 'Оплата от 09.10.2026 (счета 41–44)',
      debitRight: 0,
      creditRight: 155000,
    },
    {
      date: '13.10.26',
      docLeft: 'Приход (47 от 13.10.2026)',
      docRight: 'Акт / Счёт № 47 от 13.10.2026',
      debitRight: 40000,
      creditRight: 0,
    },
    {
      date: '14.10.26',
      docLeft: 'Оплата от 14.10.2026',
      docRight: 'Оплата от 14.10.2026 (счета 45–47)',
      debitRight: 0,
      creditRight: 120000,
    },
    {
      date: '14.10.26',
      docLeft: 'Приход (от 14.10.2026)',
      docRight: 'Акт от 14.10.2026 (рейс 826)',
      debitRight: 6000,
      creditRight: 0,
    },
    {
      date: '14.10.26',
      docLeft: 'Оплата от 14.10.2026',
      docRight: 'Оплата от 14.10.2026',
      debitRight: 0,
      creditRight: 6000,
    },
    {
      date: '15.10.26',
      docLeft: 'Приход (от 15.10.2026)',
      docRight: 'Акт от 15.10.2026 (погрузка/разгрузка)',
      debitRight: 4000,
      creditRight: 0,
    },
    {
      date: '15.10.26',
      docLeft: 'Оплата от 15.10.2026',
      docRight: 'Оплата от 15.10.2026',
      debitRight: 0,
      creditRight: 4000,
    },
    {
      date: '16.10.26',
      docLeft: 'Приход (48 от 16.10.2026)',
      docRight: 'Акт / Счёт № 48 от 16.10.2026',
      debitRight: 50000,
      creditRight: 0,
    },
    {
      date: '17.10.26',
      docLeft: 'Приход (49 от 17.10.2026)',
      docRight: 'Акт / Счёт № 49 от 17.10.2026',
      debitRight: 30000,
      creditRight: 0,
    }, // 26000+4000
    {
      date: '18.10.26',
      docLeft: 'Приход (50 от 18.10.2026)',
      docRight: 'Акт / Счёт № 50 от 18.10.2026',
      debitRight: 30000,
      creditRight: 0,
    }, // 26000+4000
    {
      date: '19.10.26',
      docLeft: 'Оплата от 19.10.2026',
      docRight: 'Оплата от 19.10.2026 (счета 48–50)',
      debitRight: 0,
      creditRight: 110000,
    },
    {
      date: '19.10.26',
      docLeft: 'Приход (51 от 19.10.2026)',
      docRight: 'Акт / Счёт № 51 от 19.10.2026',
      debitRight: 40000,
      creditRight: 0,
    },
    {
      date: '22.10.26',
      docLeft: 'Приход (53 от 22.10.2026)',
      docRight: 'Акт / Счёт № 53 от 22.10.2026',
      debitRight: 50000,
      creditRight: 0,
    },
    {
      date: '22.10.26',
      docLeft: 'Приход (54 от 22.10.2026)',
      docRight: 'Акт / Счёт № 54 от 22.10.2026',
      debitRight: 50000,
      creditRight: 0,
    },
    {
      date: '23.10.26',
      docLeft: 'Приход (52 от 23.10.2026)',
      docRight: 'Акт / Счёт № 52 от 23.10.2026',
      debitRight: 18000,
      creditRight: 0,
    },
    {
      date: '23.10.26',
      docLeft: 'Приход (55 от 23.10.2026)',
      docRight: 'Акт / Счёт № 55 от 23.10.2026',
      debitRight: 50000,
      creditRight: 0,
    },
    {
      date: '25.10.26',
      docLeft: 'Приход (от 25.10.2026)',
      docRight: 'Акт от 25.10.2026 (Карпинск-Шайтанка)',
      debitRight: 4000,
      creditRight: 0,
    },
  ];

  const allRows = [...originalRows, ...newRows];
  let totDebRight = 0;
  let totCredRight = 0;
  allRows.forEach((r) => {
    totDebRight += r.debitRight;
    totCredRight += r.creditRight;
  });
  console.log('Total Debit IP:', totDebRight);
  console.log('Total Credit IP:', totCredRight);
  console.log('Balance (Debt):', totDebRight - totCredRight);
}
testList();
