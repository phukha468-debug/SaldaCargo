const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  const cpId = '83db41b2-c050-4013-a878-bda2ab5c226e';
  const { data: txs } = await supabase
    .from('transactions')
    .select('*')
    .eq('counterparty_id', cpId)
    .order('transaction_date', { ascending: false });

  console.log(`Geostroy transactions (${txs?.length}):`);
  txs.forEach((t) => {
    console.log({
      id: t.id,
      amount: t.amount,
      direction: t.direction,
      date: t.transaction_date,
      desc: t.description,
      status: t.settlement_status,
      lifecycle: t.lifecycle_status,
    });
  });
}

run();
