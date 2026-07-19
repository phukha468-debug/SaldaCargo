const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: users } = await supabase.from('users').select('id, name').ilike('name', '%Никифоров%');
  if (users && users.length > 0) {
    const userId = users[0].id;
    const { data: trips } = await supabase.from('trips')
      .select('id, trip_number, driver_salary, started_at, status')
      .eq('driver_id', userId)
      .order('started_at', { ascending: false })
      .limit(10);
    
    console.log('Recent trips for', users[0].name, ':\n');
    trips.forEach(t => {
      console.log(`${t.id} | ${t.trip_number} | ${t.started_at} | Salary: ${t.driver_salary} | Status: ${t.status}`);
    });
  }
}

main().catch(console.error);
