const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  const { data: orders } = await supabase
    .from('service_orders')
    .select(
      'id, order_number, status, lifecycle_status, created_at, machine_type, client_vehicle_brand, client_vehicle_reg, problem_description',
    )
    .order('order_number', { ascending: false });

  console.log(`Total orders: ${orders.length}`);
  console.log('\n--- ALL ORDERS ---');
  orders.forEach((o) => {
    const isActive =
      (o.status === 'created' || o.status === 'in_progress') && o.lifecycle_status !== 'cancelled';
    console.log(
      `[${isActive ? 'ACTIVE' : '      '}] НЗ-${o.order_number} | status: ${o.status} | lifecycle: ${o.lifecycle_status} | created: ${o.created_at.slice(0, 10)} | ${o.machine_type} ${o.client_vehicle_brand || ''} ${o.client_vehicle_reg || ''} | desc: ${o.problem_description || '—'}`,
    );
  });
}

run().catch(console.error);
