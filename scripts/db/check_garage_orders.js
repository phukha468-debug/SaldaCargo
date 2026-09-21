const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  console.log('--- 1. Querying all service_orders in work/draft/in_progress ---');
  const { data: orders, error: errOrders } = await supabase
    .from('service_orders')
    .select(
      'id, order_number, status, lifecycle_status, created_at, updated_at, asset_id, client_vehicle_id, mechanic_id, total_amount, asset:assets(short_name, reg_number)',
    )
    .order('order_number', { ascending: false });

  console.log(`Total service_orders: ${orders ? orders.length : 0}`);
  if (orders) {
    const activeOrders = orders.filter(
      (o) =>
        o.status !== 'completed' && o.status !== 'cancelled' && o.lifecycle_status !== 'cancelled',
    );
    console.log(`Active (not completed/cancelled) count: ${activeOrders.length}`);
    console.log('\nActive Service Orders details:');
    activeOrders.forEach((o) => {
      console.log(
        `НЗ-${o.order_number} | id:${o.id} | status:${o.status} | lifecycle:${o.lifecycle_status} | created:${o.created_at} | total:${o.total_amount} ₽ | asset:${o.asset ? o.asset.short_name : 'no asset'}`,
      );
    });
  }

  console.log('\n--- 2. Checking users for Макс, Артём, Роман Радикович ---');
  const { data: users } = await supabase.from('users').select('id, name, phone, roles, is_active');
  const targetNames = ['макс', 'артём', 'артем', 'роман'];
  const matchedUsers = (users || []).filter((u) =>
    targetNames.some((tn) => u.name.toLowerCase().includes(tn)),
  );
  console.log('Matched users in database:', matchedUsers);
}

run().catch(console.error);
