const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function fullAudit() {
  const cpId = '83db41b2-c050-4013-a878-bda2ab5c226e';

  const { data: orders } = await supabase
    .from('trip_orders')
    .select('*, trips(trip_number, started_at, ended_at)')
    .eq('counterparty_id', cpId)
    .neq('lifecycle_status', 'cancelled')
    .order('created_at', { ascending: true });

  console.log('=== ВСЕ ЗАКАЗЫ С 01.09.2026 ===');
  const sepOrders = orders.filter(
    (o) => (o.invoice_date || o.created_at.slice(0, 10)) >= '2026-09-02',
  );
  sepOrders.forEach((o) => {
    const d = o.invoice_date || o.created_at.slice(0, 10);
    console.log(
      `${d} | № ${o.invoice_number || 'б/н'} | ${o.amount} ₽ | status: ${o.settlement_status}/${o.invoice_status} | desc: ${o.description}`,
    );
  });

  const { data: manuals } = await supabase
    .from('manual_receivables')
    .select('*')
    .eq('counterparty_id', cpId);
  console.log('Manual receivables:', manuals);
}

fullAudit();
