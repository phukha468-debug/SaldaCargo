const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function fixStatuses() {
  console.log('--- Fixing Service Order Statuses in Supabase ---');

  // 1. Order H3-88: Client order completed, waiting for payment (payment_received = false)
  const { data: o88, error: err88 } = await supabase
    .from('service_orders')
    .update({
      lifecycle_status: 'approved',
      status: 'completed',
      payment_received: false,
      cancelled_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('order_number', 88)
    .select('order_number, status, lifecycle_status, payment_received');

  if (err88) console.error('Error updating order 88:', err88);
  else console.log('Updated order 88:', o88);

  // 2. Orders with completed works / paid mechanics / income transactions that were erroneously set to cancelled
  const { data: allOrders, error: fetchErr } = await supabase
    .from('service_orders')
    .select(
      'id, order_number, status, lifecycle_status, payment_received, machine_type, works:service_order_works(id, status, salary_paid), txs:transactions(id, direction, amount)',
    );

  if (fetchErr) {
    console.error('Error fetching orders:', fetchErr);
    return;
  }

  const idsToApprove = [];
  allOrders.forEach((o) => {
    if (o.order_number === 88) return;

    const hasCompletedWorks = (o.works || []).some(
      (w) => w.status === 'completed' || w.salary_paid,
    );
    const hasTransactions = (o.txs || []).length > 0;

    if (o.lifecycle_status === 'cancelled' && (hasCompletedWorks || hasTransactions)) {
      idsToApprove.push(o.id);
      console.log(
        `Will fix order НЗ-${o.order_number} (type: ${o.machine_type}) -> approved & completed`,
      );
    }
  });

  if (idsToApprove.length > 0) {
    const { data: updated, error: updateErr } = await supabase
      .from('service_orders')
      .update({
        lifecycle_status: 'approved',
        status: 'completed',
        payment_received: true,
        cancelled_reason: null,
        updated_at: new Date().toISOString(),
      })
      .in('id', idsToApprove)
      .select('order_number, lifecycle_status, status, payment_received');

    if (updateErr) console.error('Error updating orders:', updateErr);
    else console.log(`Successfully fixed ${updated.length} completed orders.`);
  }

  console.log('--- Done fixing statuses ---');
}

fixStatuses().catch(console.error);
