const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  const { data, error } = await supabase.from('service_order_works').select('*').limit(3);
  console.log('Sample service_order_works:', data);
}

run().catch(console.error);
