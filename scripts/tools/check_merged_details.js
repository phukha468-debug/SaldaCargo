const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  const ids = [
    'b4741830-5b39-4841-bff5-f3b0ca77c066', // Леха Плитка
    '92bcddf3-48d6-4482-83ef-53d87f60e558', // Пензин Алексей
    'c0e62ec8-105a-42ac-bdad-c171621f6c8a', // Леша плитка
    '708695d4-fc0c-41af-b9c2-6090864ab13c', // ИП Волчков
    '1612d08a-99b9-4a5e-b393-ac0f57ba0e10', // Плитка Алексей
  ];

  // 1. Orders
  const { data: orders } = await supabase
    .from('trip_orders')
    .select(
      `
      id,
      counterparty_id,
      amount,
      description,
      invoice_number,
      payment_method,
      settlement_status,
      lifecycle_status,
      created_at,
      trip:trips(trip_number, started_at, driver:users!trips_driver_id_fkey(name), asset:assets(short_name, reg_number))
    `,
    )
    .in('counterparty_id', ids)
    .order('created_at', { ascending: false });

  console.log(`Total orders found: ${orders?.length}`);
  orders?.forEach((o) => {
    console.log({
      orderId: o.id,
      cpId: o.counterparty_id,
      trip: o.trip?.trip_number,
      driver: o.trip?.driver?.name,
      asset: o.trip?.asset?.short_name || o.trip?.asset?.reg_number,
      amount: o.amount,
      desc: o.description,
      date: o.created_at,
      status: o.settlement_status,
    });
  });

  // 2. Transactions
  const { data: txs } = await supabase
    .from('transactions')
    .select('*')
    .in('counterparty_id', ids)
    .order('created_at', { ascending: false });

  console.log(`\nTotal transactions found: ${txs?.length}`);
  txs?.forEach((t) => {
    console.log({
      id: t.id,
      cpId: t.counterparty_id,
      amount: t.amount,
      dir: t.direction,
      desc: t.description,
      date: t.transaction_date,
      photo: t.photo_url,
    });
  });

  // 3. Vehicles
  const { data: vehs } = await supabase
    .from('client_vehicles')
    .select('*')
    .in('counterparty_id', ids);
  console.log(`\nVehicles:`, vehs);

  // 4. Service orders
  const { data: svcs } = await supabase
    .from('service_orders')
    .select('*')
    .in('counterparty_id', ids);
  console.log(`\nService orders:`, svcs);
}

run();
