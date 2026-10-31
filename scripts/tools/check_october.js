const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function checkOctober() {
  const cpId = '83db41b2-c050-4013-a878-bda2ab5c226e';

  // 1. Orders
  const { data: orders } = await supabase
    .from('trip_orders')
    .select('*')
    .eq('counterparty_id', cpId)
    .neq('lifecycle_status', 'cancelled')
    .order('created_at', { ascending: true });

  // 2. Transactions
  const { data: txs } = await supabase
    .from('transactions')
    .select('*')
    .eq('counterparty_id', cpId)
    .neq('lifecycle_status', 'cancelled')
    .order('transaction_date', { ascending: true });

  // Let's check balance strictly before 2026-10-01
  // In the original act (which went up to 09.10):
  // Up to 30.09.2026:
  // Invoices up to 30.09:
  // 02.09 №28: 40 000
  // 06.09 №29: 50 000
  // 07.09 №30: 40 000
  // 10.09 №31: 50 000
  // 12.09 №32: 30 000
  // 14.09 №33: 30 000
  // 14.09 №34: 40 000
  // 15.09 №35: 50 000
  // 17.09 №36: 30 000
  // 18.09 №37: 40 000
  // 19.09 №38: 50 000
  // 21.09 №39: 30 000
  // 24.09 №40: 50 000
  // 28.09 №41: 50 000
  // Sum of services up to 30.09: 580 000
  // Payments up to 30.09:
  // 11.09: 130 000
  // 14.09: 80 000
  // 22.09: 240 000
  // 30.09: 80 000
  // Sum of payments up to 30.09: 530 000
  // Difference at 01.10.2026 morning: 580 000 - 530 000 = 50 000 ₽ (это как раз счёт № 41 от 28.09.2026 на 50 000 ₽!).

  console.log('Balance at 01.10.2026 morning: 50 000 ₽ (счёт № 41 от 28.09.2026)');

  console.log('\n--- ALL OCTOBER ORDERS ---');
  orders.forEach((o) => {
    const d = o.invoice_date || o.created_at.slice(0, 10);
    if (d >= '2026-10-01') {
      console.log(d, o.invoice_number, o.amount, o.description);
    }
  });

  console.log('\n--- ALL OCTOBER TXS ---');
  txs.forEach((t) => {
    const d = t.transaction_date.slice(0, 10);
    if (d >= '2026-10-01') {
      console.log(d, t.amount, t.description);
    }
  });
}

checkOctober();
