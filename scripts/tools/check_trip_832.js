const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  const { data: trip } = await supabase
    .from('trips')
    .select('*, trip_orders(*)')
    .eq('trip_number', 832)
    .single();

  console.log(trip);
}

run();
