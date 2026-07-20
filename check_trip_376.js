const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function main() {
  const { data: orders } = await supabase
    .from('trip_orders')
    .select(
      `id, amount, payment_method, created_at, description,
           counterparty:counterparties(id, name, phone, email),
           trip:trips!inner(trip_number, started_at, lifecycle_status)`,
    )
    .eq('settlement_status', 'pending')
    .eq('lifecycle_status', 'approved')
    .order('created_at', { ascending: true });

  const grouped = new Map();
  for (const order of orders ?? []) {
    const hasCounterparty = !!order.counterparty?.id;
    const hasDescription = !hasCounterparty && !!order.description?.trim();
    const groupKey = hasCounterparty
      ? order.counterparty.id
      : hasDescription
        ? `__individual__${order.id}`
        : '__unknown__';
    if (
      groupKey === '30fef3ce-2bf2-48fa-9b6e-5d1b7b94459a' ||
      order.counterparty?.name?.includes('Частное')
    ) {
      console.log('Found order for Частное лицо:', order);
    }

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, { count: 0, total: 0 });
    }
    grouped.get(groupKey).count++;
    grouped.get(groupKey).total += parseFloat(order.amount);
  }

  console.log('Group for Частное лицо:', grouped.get('30fef3ce-2bf2-48fa-9b6e-5d1b7b94459a'));
}

main().catch(console.error);
