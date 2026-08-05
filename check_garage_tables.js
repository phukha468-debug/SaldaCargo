const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  console.log('--- Inspecting tables ---');
  // Check repair_requests, service_orders, sto_orders etc.
  const tables = [
    'service_orders',
    'repair_requests',
    'work_catalog',
    'service_order_works',
    'sto_clients',
    'client_vehicles',
  ];
  for (const t of tables) {
    const { data, count, error } = await supabase.from(t).select('*', { count: 'exact' }).limit(5);
    console.log(`Table '${t}': count=${count}, err=`, error ? error.message : 'none');
    if (data && data.length > 0) {
      console.log(`Sample from ${t}:`, data[0]);
    }
  }
}

run().catch(console.error);
