const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  const { data: trips } = await supabase
    .from('trips')
    .select(
      `
      id,
      trip_number,
      trip_orders (
        id,
        counterparty_id,
        counterparty:counterparties(name),
        amount,
        driver_pay,
        driver_car_pay,
        driver_loader_pay,
        loader_pay,
        loader2_pay,
        loaders_data,
        direction,
        description,
        invoice_number,
        invoice_date,
        invoice_status,
        invoice_paid_at,
        settlement_status,
        lifecycle_status
      )
    `,
    )
    .in('trip_number', [844, 852])
    .order('trip_number', { ascending: true });

  console.log(JSON.stringify(trips, null, 2));
}

run();
