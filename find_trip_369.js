const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: trips } = await supabase.from('trips')
    .select('*')
    .eq('trip_number', 369)
    .single();
    
  console.log('Trip 369:', trips);
  
  // also check if there are cancelled transactions for Nikiforov with 6000
  const { data: users } = await supabase.from('users').select('id, name').ilike('name', '%Никифоров%');
  const userId = users[0].id;
  
  const { data: allTxs } = await supabase.from('transactions')
    .select('id, amount, description, created_at, lifecycle_status, settlement_status')
    .eq('related_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
    
  console.log('All Txs (including cancelled maybe, if I filter it? Oh, my previous query fetched all lifecycle_status):');
  allTxs.forEach(t => {
    if (t.amount === '6000.00' || t.amount === 6000 || t.description.includes('369')) {
       console.log('MATCH:', t);
    }
  });
}

main().catch(console.error);
