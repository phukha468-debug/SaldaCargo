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
      'id, amount, invoice_number, invoice_date, invoice_paid_at, description, settlement_status, trip:trips(trip_number)',
    )
    .eq('counterparty_id', '83db41b2-c050-4013-a878-bda2ab5c226e')
    .not('invoice_paid_at', 'is', null)
    .order('invoice_paid_at', { ascending: false });

  console.log(`Paid orders count: ${orders?.length}`);
  console.log(orders);
}

run();
