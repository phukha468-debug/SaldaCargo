const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  const { data: cps, error } = await supabase
    .from('counterparties')
    .select('*')
    .or('name.ilike.%плитк%,name.ilike.%пензин%,notes.ilike.%плитк%,notes.ilike.%пензин%');

  console.log('Counterparties matching плитка or пензин:');
  console.log(cps);
}

run();
