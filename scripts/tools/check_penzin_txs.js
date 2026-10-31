const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  const { data: txs } = await supabase
    .from('transactions')
    .select('*')
    .or(
      'description.ilike.%96%,description.ilike.%530%,description.ilike.%пензин%,amount.eq.39500',
    );

  console.log('Transactions matching 96, 530, пензин or 39500:');
  console.log(txs);
}

run();
