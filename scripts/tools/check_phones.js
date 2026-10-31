const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  const { data: cps } = await supabase
    .from('counterparties')
    .select('id, name, phone, notes, is_active')
    .or('name.ilike.%плитк%,name.ilike.%пензин%');
  console.log(cps);

  // Check if any order descriptions mention a phone
  const { data: orders } = await supabase
    .from('trip_orders')
    .select('description')
    .eq('counterparty_id', 'b4741830-5b39-4841-bff5-f3b0ca77c066')
    .not('description', 'is', null);

  const phones = orders.map((o) => o.description).filter((d) => /\d{7,11}/.test(d));
  console.log('Phones in order descriptions:', phones);
}

run();
