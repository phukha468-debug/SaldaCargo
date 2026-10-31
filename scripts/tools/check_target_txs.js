const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  const orderIds = [
    '6a1729b5-fdd3-4208-825c-e282683e4dc2',
    '5efb38a9-533f-495e-9116-d0e0b2801dc6',
    'b47332c6-bd3c-4db0-82ee-ec8c59e73ce8',
    'd765ce5d-532f-42e7-ae97-eee729da1114',
  ];

  const { data: txs, error } = await supabase
    .from('transactions')
    .select('*')
    .in('trip_order_id', orderIds);

  console.log('Transactions linked directly by trip_order_id:', txs);

  // Also check transactions by description containing 49(2), 50(2), 832, 844, 852
  const { data: txs2 } = await supabase
    .from('transactions')
    .select('id, amount, direction, description, trip_order_id, counterparty_id, created_at')
    .or('description.ilike.%49(2)%,description.ilike.%50(2)%,description.ilike.%832%');

  console.log('Transactions matching 49(2), 50(2), 832:', txs2);
}

run();
