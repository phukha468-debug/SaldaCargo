const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  const { data: svcs } = await supabase
    .from('service_orders')
    .select('*')
    .or(
      'client_vehicle_id.eq.167ed8aa-d70b-4716-ab24-b5c7f76bce43,counterparty_id.eq.b4741830-5b39-4841-bff5-f3b0ca77c066,counterparty_id.eq.92bcddf3-48d6-4482-83ef-53d87f60e558',
    );

  console.log('Service orders:', svcs);
}

run();
