const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  const { data: order } = await supabase
    .from('trip_orders')
    .select('invoice_status')
    .eq('id', 'da21b137-b330-45fa-883e-5788a189f46a') // Existing TK501 order
    .single();

  console.log('Existing TK501 order invoice_status:', order);
}

run();
