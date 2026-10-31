const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  const ids = ['b664daff-af77-42ad-a290-7cfd95d1140f', '8b0cf3d1-d1e8-49ff-aa0d-c09ed1e8c7df'];
  const { data: txs } = await supabase
    .from('transactions')
    .select('id, amount, description, photo_url, transaction_date')
    .in('id', ids);

  console.log('Transactions metadata:');
  txs.forEach((t) => {
    console.log(t.id, t.amount, t.description);
    try {
      console.log('meta:', JSON.parse(t.photo_url));
    } catch {
      console.log('photo_url:', t.photo_url);
    }
  });
}

run();
