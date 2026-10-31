const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  // Check all trip orders on 2026-08-04, 2026-08-05, 2026-08-06
  const { data: orders } = await supabase
    .from('trip_orders')
    .select('id, amount, description, counterparty_id, created_at')
    .gte('created_at', '2026-08-04')
    .lte('created_at', '2026-08-06');
  console.log('Trip orders around 05.08.2026:', orders);

  // Check manual receivables
  const { data: manuals } = await supabase
    .from('manual_receivables')
    .select('*')
    .or(
      'counterparty_id.eq.b4741830-5b39-4841-bff5-f3b0ca77c066,counterparty_id.eq.92bcddf3-48d6-4482-83ef-53d87f60e558',
    );
  console.log('Manual receivables:', manuals);

  // Check vehicles
  const { data: vehs } = await supabase
    .from('client_vehicles')
    .select('*')
    .or(
      'counterparty_id.eq.b4741830-5b39-4841-bff5-f3b0ca77c066,counterparty_id.eq.92bcddf3-48d6-4482-83ef-53d87f60e558',
    );
  console.log('Vehicles:', vehs);
}

run();
