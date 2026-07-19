const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: users } = await supabase.from('users').select('id, name').ilike('name', '%Никифоров%');
  if (users && users.length > 0) {
    const userId = users[0].id;
    
    // Set the 3 transactions back to completed
    const idsToComplete = [
      'cc115c19-f13e-434a-a931-3f32b73917b7',
      '4b14c634-c707-4354-9420-65c3e7af7a08',
      '6ff6d01f-a7dc-4990-b795-28d21f4bde7c'
    ];
    await supabase.from('transactions').update({ settlement_status: 'completed' }).in('id', idsToComplete);
    console.log('Restored 9750 to completed');

    const { data: trips, error } = await supabase.from('trips')
      .select('*')
      .eq('driver_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (error) {
      console.log('Error fetching trips:', error);
    } else {
      console.log('Recent trips:\n', trips.map(t => ({ id: t.id, no: t.trip_number, status: t.status, created: t.created_at })));
    }
    
    const { data: txs } = await supabase.from('transactions')
      .select('id, amount, description, created_at, lifecycle_status, settlement_status')
      .eq('related_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
      
    console.log('Recent transactions:\n', txs);
  }
}

main().catch(console.error);
