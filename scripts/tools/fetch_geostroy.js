const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  const cpId = '83db41b2-c050-4013-a878-bda2ab5c226e';

  // Orders
  const { data: orders, error: oErr } = await supabase
    .from('trip_orders')
    .select(
      'id, amount, description, payment_method, settlement_status, lifecycle_status, invoice_number, invoice_date, invoice_status, invoice_paid_at, created_at, trip_id',
    )
    .eq('counterparty_id', cpId)
    .neq('lifecycle_status', 'cancelled')
    .order('created_at', { ascending: true });

  console.log('Orders total:', orders?.length);

  // Transactions
  const { data: txs, error: tErr } = await supabase
    .from('transactions')
    .select(
      'id, direction, amount, category_id, to_wallet_id, counterparty_id, trip_order_id, settlement_status, lifecycle_status, transaction_date, description, created_at',
    )
    .eq('counterparty_id', cpId)
    .neq('lifecycle_status', 'cancelled')
    .order('transaction_date', { ascending: true });

  console.log('Txs total:', txs?.length);

  console.log('\n--- ALL ORDERS ---');
  orders.forEach((o) => {
    console.log(
      `Order ${o.invoice_number || 'NO_INV'} | date: ${o.invoice_date || o.created_at.slice(0, 10)} | amt: ${o.amount} | settlement: ${o.settlement_status} | inv_status: ${o.invoice_status} | paid_at: ${o.invoice_paid_at} | desc: ${o.description}`,
    );
  });

  console.log('\n--- ALL TRANSACTIONS (PAYMENTS) ---');
  txs.forEach((t) => {
    console.log(
      `Tx | date: ${t.transaction_date.slice(0, 10)} | dir: ${t.direction} | amt: ${t.amount} | desc: ${t.description}`,
    );
  });
}
run();
