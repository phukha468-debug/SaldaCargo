const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function generateData() {
  const cpId = '83db41b2-c050-4013-a878-bda2ab5c226e';

  // 1. All trip orders
  const { data: orders } = await supabase
    .from('trip_orders')
    .select('*, trips(trip_number, started_at, ended_at, driver_id, asset_id)')
    .eq('counterparty_id', cpId)
    .neq('lifecycle_status', 'cancelled')
    .order('created_at', { ascending: true });

  // 2. All transactions
  const { data: txs } = await supabase
    .from('transactions')
    .select('*')
    .eq('counterparty_id', cpId)
    .neq('lifecycle_status', 'cancelled')
    .order('transaction_date', { ascending: true });

  console.log('Orders total:', orders.length, 'Txs total:', txs.length);

  // Let's filter operations for the period 02.09.2026 to 29.10.2026
  // In the original act, operations from 02.09.2026 to 09.10.2026 were:
  // 02.09.26 № 28: 40 000
  // 06.09.26 № 29: 50 000
  // 07.09.26 № 30: 40 000
  // 10.09.26 № 31: 50 000
  // 11.09.26 Оплата 930: 130 000
  // 12.09.26 № 32: 30 000
  // 14.09.26 № 33: 30 000
  // 14.09.26 № 34: 40 000
  // 14.09.26 Оплата 960: 80 000
  // 15.09.26 № 35: 50 000
  // 17.09.26 № 36: 30 000
  // 18.09.26 № 37: 40 000
  // 19.09.26 № 38: 50 000
  // 21.09.26 № 39: 30 000
  // 22.09.26 Оплата (счета 33-38): 240 000
  // 24.09.26 № 40: 50 000
  // 30.09.26 Оплата (счета 39, 40): 80 000
  // 28.09.26 № 41: 50 000
  // 01.10.26 № 43: 15 000
  // 02.10.26 № 42: 40 000
  // 06.10.26 № 44: 50 000
  // 07.10.26 № 45: 30 000
  // 09.10.26 № 46: 50 000

  // Now, what came after 09.10.2026:
  // Payments:
  // - 09.10.2026: 155 000 (счета 41, 43, 42, 44)
  // - 14.10.2026: 120 000 (счета 45, 46, 47)
  // - 14.10.2026: 6 000 (погашение долга/услуги)
  // - 15.10.2026: 4 000 (погрузо-разгрузочные работы)
  // - 19.10.2026: 110 000 (счета 48, 49(1,2), 50(1,2))

  // Invoices/Acts:
  // - 13.10.2026: № 47: 40 000 (Карпинск-Шайтанка)
  // - 14.10.2026: Долг / Услуга погрузки/разгрузки (?): 6 000
  // - 15.10.2026: Погрузо-разгрузочные работы (без авто): 4 000
  // - 16.10.2026: № 48: 50 000
  // - 17.10.2026: № 49: 30 000 (26 000 + 4 000) или № 49(1) 26 000 и № 49(2) 4 000
  // - 19.10.2026: № 50: 30 000 (26 000 + 4 000) или № 50(1) 26 000 и № 50(2) 4 000
  // - 19.10.2026: № 51: 40 000
  // - 22.10.2026: № 53: 50 000
  // - 22.10.2026: № 54: 50 000
  // - 23.10.2026: № 52: 18 000
  // - 23.10.2026: № 55: 50 000
  // - 25.10.2026: Акт б/н (или рейс 24.10): 4 000

  // Let's inspect each order after 09.10.2026 in full detail!
  const ordersAfterOct9 = orders.filter((o) => {
    const d = o.invoice_date || o.created_at.slice(0, 10);
    return d > '2026-10-09' || (d === '2026-10-09' && o.invoice_number !== '46');
  });

  console.log('\n--- ORDERS AFTER OCT 9 ---');
  ordersAfterOct9.forEach((o) => {
    console.log(JSON.stringify(o, null, 2));
  });

  const txsAfterOct9 = txs.filter((t) => t.transaction_date.slice(0, 10) >= '2026-10-09');
  console.log('\n--- TXS ON OR AFTER OCT 9 ---');
  txsAfterOct9.forEach((t) => {
    console.log(JSON.stringify(t, null, 2));
  });
}

generateData();
