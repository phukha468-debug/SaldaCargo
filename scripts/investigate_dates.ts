
import { createAdminClient } from '../apps/miniapp/lib/supabase/admin';

async function investigateDates() {
  const supabase = createAdminClient();
  
  // Find Farukh
  const { data: users } = await (supabase.from('users') as any)
    .select('id, name')
    .ilike('name', '%Фарух%');

  if (!users || users.length === 0) return;
  const farukhId = users[0].id;

  // Find payroll transactions
  const { data: txns } = await (supabase.from('transactions') as any)
    .select(`
      id, amount, description, created_at, transaction_date, trip_id,
      trip:trips(trip_number, created_at, started_at)
    `)
    .eq('related_user_id', farukhId)
    .in('category_id', ['d79213ee-3bc6-4433-b58a-ca7ea1040d00', '18792fa8-fda8-472d-8e04-e19d2c6c053c'])
    .order('created_at', { ascending: false });

  console.log('Transactions for Farukh:');
  txns?.forEach((t: any) => {
    console.log(`Tx #${t.id}:`);
    console.log(`  Amount: ${t.amount}`);
    console.log(`  Desc: ${t.description}`);
    console.log(`  Tx Created At: ${t.created_at}`);
    console.log(`  Tx Date: ${t.transaction_date}`);
    console.log(`  Trip #${t.trip?.trip_number}`);
    console.log(`  Trip Created At: ${t.trip?.created_at}`);
    console.log(`  Trip Started At: ${t.trip?.started_at}`);
  });
}

investigateDates();
