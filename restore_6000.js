const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: users } = await supabase.from('users').select('id, name').ilike('name', '%Никифоров%');
  const userId = users[0].id;

  // get category_id of trip 363
  const { data: refTx } = await supabase.from('transactions')
    .select('category_id')
    .eq('description', 'ЗП: Никифоров Д.В. — рейс №363')
    .single();

  const categoryId = refTx.category_id;
  
  // insert 6000 tx
  const { data: newTx, error } = await supabase.from('transactions')
    .insert({
      direction: 'expense',
      amount: '6000.00',
      category_id: categoryId,
      description: 'ЗП: Никифоров Д.В. — рейс №369',
      related_user_id: userId,
      settlement_status: 'pending',
      lifecycle_status: 'approved',
      from_wallet_id: null, // payroll doesn't have wallet until settled
      to_wallet_id: null,
      created_by: userId // or admin
    })
    .select()
    .single();

  if (error) {
    console.error('Error inserting 6000 tx:', error);
  } else {
    console.log('Successfully restored 6000 tx:', newTx);
  }
}

main().catch(console.error);
