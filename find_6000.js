const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: users } = await supabase.from('users').select('id, name').ilike('name', '%Никифоров%');
  if (users && users.length > 0) {
    const userId = users[0].id;
    const { data: txs } = await supabase.from('transactions')
      .select('id, amount, description, created_at, updated_at, settlement_status, category_id, direction, lifecycle_status')
      .eq('related_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    console.log('All recent transactions for', users[0].name, ':\n');
    txs.forEach(t => {
      console.log(`${t.id} | ${t.created_at} | ${t.updated_at} | ${t.amount} | ${t.settlement_status} | ${t.lifecycle_status} | ${t.description}`);
    });
  }
}

main().catch(console.error);
