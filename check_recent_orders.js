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
      'id, order_number, status, lifecycle_status, created_at, updated_at, machine_type, client_vehicle_brand, client_vehicle_reg, problem_description, assigned_mechanic_id, second_mechanic_id',
    )
    .gte('order_number', 80)
    .order('order_number', { ascending: false });

  console.log('--- Orders >= 80 ---');
  orders.forEach((o) => {
    console.log(
      `НЗ-${o.order_number} | id:${o.id} | status:${o.status} | lifecycle:${o.lifecycle_status} | created:${o.created_at} | desc:${o.problem_description}`,
    );
  });
}

run().catch(console.error);
