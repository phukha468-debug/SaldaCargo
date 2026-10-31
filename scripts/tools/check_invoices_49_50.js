const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  const { data: orders } = await supabase
    .from('trip_orders')
    .select(
      'id, trip_id, amount, invoice_number, invoice_date, invoice_status, invoice_paid_at, description, counterparty:counterparties(name)',
    )
    .or('invoice_number.ilike.%49%,invoice_number.ilike.%50%');

  console.log('Orders with invoice 49 or 50:');
  console.log(orders);

  const { data: txs } = await supabase
    .from('transactions')
    .select('id, amount, direction, description, transaction_date')
    .or('description.ilike.%49%,description.ilike.%50%');
  console.log('Transactions with 49 or 50:');
  console.log(txs);
}

run();
