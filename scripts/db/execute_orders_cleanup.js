const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  console.log('--- 1. Cancelling stale active orders (all except order_number = 94) ---');

  // Get all active orders except 94
  const { data: staleOrders, error: fetchErr } = await supabase
    .from('service_orders')
    .select('id, order_number, status, lifecycle_status, problem_description')
    .neq('order_number', 94)
    .in('status', ['created', 'in_progress'])
    .neq('lifecycle_status', 'cancelled');

  if (fetchErr) {
    console.error('Error fetching stale orders:', fetchErr);
    return;
  }

  console.log(`Found ${staleOrders.length} stale active orders to cancel:`);
  staleOrders.forEach((o) =>
    console.log(`- НЗ-${o.order_number} (${o.id}): ${o.problem_description}`),
  );

  const idsToCancel = staleOrders.map((o) => o.id);
  if (idsToCancel.length > 0) {
    const { data: updated, error: updateErr } = await supabase
      .from('service_orders')
      .update({
        status: 'cancelled',
        lifecycle_status: 'cancelled',
        cancelled_reason: 'Отмена неактуального зависшего наряда при чистке Гаража',
      })
      .in('id', idsToCancel)
      .select();

    if (updateErr) {
      console.error('Error updating orders:', updateErr);
    } else {
      console.log(`Successfully cancelled ${updated.length} stale orders.`);
    }
  }

  // Verify remaining active orders
  const { data: remainingActive } = await supabase
    .from('service_orders')
    .select('id, order_number, status, lifecycle_status, problem_description')
    .in('status', ['created', 'in_progress'])
    .neq('lifecycle_status', 'cancelled');

  console.log(`\nRemaining active orders count: ${remainingActive ? remainingActive.length : 0}`);
  remainingActive.forEach((o) =>
    console.log(`Active: НЗ-${o.order_number} - ${o.problem_description}`),
  );
}

run().catch(console.error);
