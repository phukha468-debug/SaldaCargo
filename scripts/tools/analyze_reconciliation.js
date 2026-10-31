const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function checkDetails() {
  const cpId = '83db41b2-c050-4013-a878-bda2ab5c226e';

  // 1. All orders
  const { data: orders } = await supabase
    .from('trip_orders')
    .select('*, trips(trip_number, started_at, ended_at)')
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

  console.log('--- ALL TRANSACTIONS WITH DATES AND DETAILS ---');
  for (const t of txs) {
    console.log(
      JSON.stringify({
        id: t.id,
        date: t.transaction_date,
        amount: t.amount,
        desc: t.description,
        settlement_status: t.settlement_status,
        lifecycle_status: t.lifecycle_status,
      }),
    );
  }

  console.log('\n--- ALL ORDERS FROM SEPTEMBER 2026 ONWARDS ---');
  for (const o of orders) {
    const d = o.invoice_date || o.created_at.slice(0, 10);
    if (d >= '2026-09-01') {
      console.log(
        JSON.stringify({
          id: o.id,
          invoice_number: o.invoice_number,
          date: d,
          amount: o.amount,
          desc: o.description,
          settlement_status: o.settlement_status,
          inv_status: o.invoice_status,
          paid_at: o.invoice_paid_at,
        }),
      );
    }
  }

  // Check before 2026-09-02
  console.log('\n--- BALANCE BEFORE 2026-09-02 ---');
  const ordersBefore = orders.filter(
    (o) => (o.invoice_date || o.created_at.slice(0, 10)) < '2026-09-02',
  );
  const txsBefore = txs.filter((t) => t.transaction_date.slice(0, 10) < '2026-09-02');
  const sumOrdersBefore = ordersBefore.reduce((acc, o) => acc + Number(o.amount), 0);
  const sumTxsBefore = txsBefore.reduce((acc, t) => acc + Number(t.amount), 0);
  console.log(
    'Orders before 02.09.2026:',
    sumOrdersBefore,
    'Txs before 02.09.2026:',
    sumTxsBefore,
    'Diff:',
    sumOrdersBefore - sumTxsBefore,
  );
}

checkDetails();
