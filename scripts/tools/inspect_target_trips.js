const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  const tripIds = ['844', '852', '832'];

  const { data: trips } = await supabase
    .from('trips')
    .select(
      `
      id,
      trip_number,
      status,
      lifecycle_status,
      driver:users!trips_driver_id_fkey(name),
      asset:assets(short_name, reg_number),
      trip_orders(
        id,
        counterparty_id,
        counterparty:counterparties(name),
        amount,
        driver_pay,
        loader_pay,
        loader2_pay,
        loaders_data,
        direction,
        description,
        invoice_number,
        invoice_date,
        settlement_status,
        lifecycle_status
      )
    `,
    )
    .in('trip_number', [832, 844, 852, 895, 912]);

  console.log(JSON.stringify(trips, null, 2));
}

run();
